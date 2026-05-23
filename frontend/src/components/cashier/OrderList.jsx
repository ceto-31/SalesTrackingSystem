// src/components/cashier/OrderList.jsx
// Cashier's own orders — read-only kitchen status (preparing / completed / cancelled).
// Adds: search, cancelled status reflection, multi-select unpaid orders w/ live total.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getCashierOrders, markOrderPaid } from '../../services/api'
import CustomerName from '../shared/CustomerName'

function fmtMoney(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function orderNum(order) {
  return order.daily_seq > 0 ? order.daily_seq : order.id
}

function OrderTypeBadge({ orderType }) {
  if (!orderType) return null
  const takeout = orderType === 'takeout'
  return (
    <span className={`badge ${takeout ? 'bg-primary' : 'bg-info text-dark'}`}>
      <i className={`bi ${takeout ? 'bi-bag' : 'bi-shop'} me-1`} />
      {takeout ? 'Takeout' : 'Dine-in'}
    </span>
  )
}

function orderSummaryLine(order, unpaid) {
  const type = order.order_type === 'takeout' ? 'Takeout' : 'Dine-in'
  const items = (order.items ?? []).reduce(
    (s, it) => s + Math.max(0, it.quantity - (it.cancelled_quantity || 0)),
    0,
  )
  const pay = unpaid ? 'Unpaid' : 'Paid'
  return `${type} · ${items} item${items !== 1 ? 's' : ''} · ${pay}`
}

const STATUS_META = {
  preparing: { label: 'Preparing', icon: 'bi-fire',          cls: 'bg-warning text-dark' },
  completed: { label: 'Completed', icon: 'bi-check-circle',  cls: 'bg-success'           },
  paid:      { label: 'Paid',      icon: 'bi-check-circle',  cls: 'bg-success'           },
  unpaid:    { label: 'Unpaid',    icon: 'bi-clock',         cls: 'bg-warning text-dark' },
  cancelled: { label: 'Cancelled', icon: 'bi-x-circle',      cls: 'bg-danger'            },
}

export default function OrderList() {
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all') // 'all' | 'unpaid' | 'paid'
  const [selected,  setSelected]  = useState(() => new Set())

  // Pay modal: { ids: number[], total: number } or null
  const [payModal,  setPayModal]  = useState(null)
  const [tendered,  setTendered]  = useState('')
  const [paying,    setPaying]    = useState(false)
  const [payError,  setPayError]  = useState('')

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const { data } = await getCashierOrders()
      if (Array.isArray(data)) {
        setOrders(data)
      } else {
        setOrders([])
        setError(`Failed to load orders. ${data?.error || 'Unexpected response.'}`)
      }
    } catch {
      setError('Failed to load orders.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const isUnpaid = (o) => o.status !== 'cancelled' && (o.amount_paid === null || o.amount_paid === undefined)
  const isPaid   = (o) => o.status !== 'cancelled' && o.amount_paid !== null && o.amount_paid !== undefined
  const isExactPayment = (o) =>
    isPaid(o) && Math.abs(Number(o.amount_paid) - Number(o.total_amount || 0)) < 0.005

  const filteredOrders = useMemo(() => {
    let list = orders
    if (filter === 'unpaid') list = list.filter(isUnpaid)
    if (filter === 'paid')   list = list.filter(isPaid)

    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((o) =>
      String(o.id).includes(q) ||
      String(o.daily_seq ?? '').includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q),
    )
  }, [orders, search, filter])

  const unpaidOrders = useMemo(
    () => orders.filter(isUnpaid),
    [orders],
  )

  const unpaidTotalAll = useMemo(
    () => unpaidOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
    [unpaidOrders],
  )

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectionTotal = useMemo(() => {
    return orders
      .filter((o) => selected.has(o.id) && isUnpaid(o))
      .reduce((s, o) => s + Number(o.total_amount || 0), 0)
  }, [orders, selected])

  const selectionCount = useMemo(() => {
    return orders.filter((o) => selected.has(o.id) && isUnpaid(o)).length
  }, [orders, selected])

  const openPayModal = (ids, total) => {
    setTendered('')
    setPayError('')
    setPayModal({ ids, total })
  }

  const closePayModal = () => {
    if (paying) return
    setPayModal(null)
    setTendered('')
    setPayError('')
  }

  const tenderedNum = parseFloat(tendered)
  const payTotal    = payModal?.total ?? 0
  const payChange   = Number.isFinite(tenderedNum) ? tenderedNum - payTotal : 0
  const payValid    = Number.isFinite(tenderedNum) && tenderedNum >= payTotal
  const payIsExact  = payValid && Math.abs(tenderedNum - payTotal) < 0.005

  /** Apply payment for one or more orders (exact amount per order). */
  const applyPayment = async (ids) => {
    const totalsById = new Map(orders.map((o) => [o.id, Number(o.total_amount || 0)]))
    const paidIds = []
    for (const id of ids) {
      const amount = totalsById.get(id) ?? 0
      if (amount <= 0) continue
      await markOrderPaid(id, amount)
      paidIds.push({ id, amount })
    }
    setOrders((prev) =>
      prev.map((o) => {
        const hit = paidIds.find((p) => p.id === o.id)
        return hit ? { ...o, amount_paid: hit.amount } : o
      }),
    )
    setSelected(new Set())
    setPayModal(null)
    setTendered('')
  }

  /** One-tap: customer paid the exact total (no change). */
  const payExact = async (ids) => {
    if (paying || ids.length === 0) return
    setPaying(true)
    setPayError('')
    try {
      await applyPayment(ids)
    } catch (e) {
      setPayError(e?.response?.data?.error || 'Failed to mark as paid.')
    } finally {
      setPaying(false)
    }
  }

  const submitPayment = async () => {
    if (!payModal || !payValid || paying) return
    setPaying(true)
    setPayError('')
    try {
      const totalsById = new Map(orders.map((o) => [o.id, Number(o.total_amount || 0)]))
      const paidIds = []
      for (const id of payModal.ids) {
        const due = totalsById.get(id) ?? 0
        // Single-order modal: record actual tendered. Bulk: exact per order.
        const amount = payModal.ids.length === 1 ? tenderedNum : due
        await markOrderPaid(id, amount)
        paidIds.push({ id, amount })
      }
      setOrders((prev) =>
        prev.map((o) => {
          const hit = paidIds.find((p) => p.id === o.id)
          return hit ? { ...o, amount_paid: hit.amount } : o
        }),
      )
      setSelected(new Set())
      setPayModal(null)
      setTendered('')
    } catch (e) {
      setPayError(e?.response?.data?.error || 'Failed to mark as paid.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div style={selectionCount > 0 ? { paddingBottom: 96 } : undefined}>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-list-ul me-2 text-primary" /> My Orders
        </h4>
        <div className="d-flex gap-2 flex-wrap">
          {unpaidOrders.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-outline-success btn-sm"
                disabled={paying}
                onClick={() => payExact(unpaidOrders.map((o) => o.id))}
              >
                <i className="bi bi-check2-circle me-1" />
                All Exact ({unpaidOrders.length})
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() =>
                  openPayModal(
                    unpaidOrders.map((o) => o.id),
                    unpaidTotalAll,
                  )
                }
              >
                <i className="bi bi-cash-stack me-1" />
                Pay All ({unpaidOrders.length})
              </button>
            </>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={() => fetchOrders({ silent: true })}>
            <i className="bi bi-arrow-clockwise me-1" /> Refresh
          </button>
        </div>
      </div>

      {unpaidOrders.length > 0 && (
        <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="small mb-0">
            <i className="bi bi-exclamation-circle me-1" />
            <strong>{unpaidOrders.length}</strong> unpaid order(s) — total{' '}
            <strong>₱{unpaidTotalAll.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
          </span>
          <button
            type="button"
            className="btn btn-outline-success btn-sm"
            disabled={paying}
            onClick={() => payExact(unpaidOrders.map((o) => o.id))}
          >
            <i className="bi bi-check2-circle me-1" /> Exact Amount
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() =>
              openPayModal(
                unpaidOrders.map((o) => o.id),
                unpaidTotalAll,
              )
            }
          >
            <i className="bi bi-cash-coin me-1" /> With Change
          </button>
        </div>
      )}

      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Order filter">
        {[
          { key: 'all',    label: 'All' },
          { key: 'unpaid', label: 'Unpaid' },
          { key: 'paid',   label: 'Paid' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`btn ${filter === key ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {key === 'unpaid' && unpaidOrders.length > 0 && (
              <span className="badge bg-light text-dark ms-1">{unpaidOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="input-group input-group-sm mb-3" style={{ maxWidth: 360 }}>
        <span className="input-group-text bg-white">
          <i className="bi bi-search" />
        </span>
        <input
          type="search"
          className="form-control"
          placeholder="Search by #order, queue #, or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search orders"
        />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-receipt fs-1 d-block mb-2" />
          {orders.length === 0
            ? 'No orders yet.'
            : filter === 'unpaid'
              ? 'No unpaid orders.'
              : filter === 'paid'
                ? 'No paid orders.'
                : 'No orders match your search.'}
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredOrders.map((order) => {
            const meta       = STATUS_META[order.status] ?? STATUS_META.preparing
            const cancelled  = order.status === 'cancelled'
            const unpaid     = isUnpaid(order)
            const isChecked  = selected.has(order.id)
            return (
              <div
                key={order.id}
                className={`card border-0 shadow-sm ${cancelled ? 'bg-light' : ''}`}
                style={cancelled ? { opacity: 0.85 } : undefined}
              >
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-2 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {unpaid && (
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={isChecked}
                          onChange={() => toggleSelect(order.id)}
                          aria-label={`Select unpaid order #${orderNum(order)}`}
                        />
                      )}
                      <span className="fw-bold fs-5">#{orderNum(order)}</span>
                      <span className="text-muted small">
                        {new Date(order.created_at).toLocaleString('en-PH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <OrderTypeBadge orderType={order.order_type} />
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {!cancelled && order.amount_paid !== null && order.amount_paid !== undefined && (
                        <>
                          <span className="badge bg-success">Paid</span>
                          {isExactPayment(order) && (
                            <span className="badge bg-success bg-opacity-75">Exact</span>
                          )}
                        </>
                      )}
                      {!cancelled && unpaid && (
                        <span className="badge bg-warning text-dark">Unpaid</span>
                      )}
                      <span className={`badge fs-6 ${meta.cls}`}>
                        <i className={`bi ${meta.icon} me-1`} />
                        {meta.label}
                      </span>
                      {!cancelled && (
                        <span className="order-card-total">
                          ₱{fmtMoney(order.total_amount)}
                        </span>
                      )}
                    </div>
                  </div>

                  <CustomerName name={order.customer_name} />

                  {!cancelled && (
                    <div className="small text-muted mb-2">
                      {orderSummaryLine(order, unpaid)}
                    </div>
                  )}

                  {order.notes && (
                    <div
                      className="d-flex align-items-start gap-2 small mb-3 px-2 py-2 rounded"
                      style={{
                        background: '#fff7fa',
                        color: '#b02a5b',
                        border: '1px solid rgba(214,51,108,.25)',
                      }}
                    >
                      <i className="bi bi-sticky-fill mt-1" />
                      <div style={{ wordBreak: 'break-word' }}>{order.notes}</div>
                    </div>
                  )}

                  <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                    {unpaid && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          disabled={paying}
                          onClick={() => payExact([order.id])}
                          title="Customer paid exact amount — no change"
                        >
                          <i className="bi bi-check2-circle me-1" />
                          Exact ₱{fmtMoney(order.total_amount)}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => openPayModal([order.id], Number(order.total_amount || 0))}
                        >
                          <i className="bi bi-cash-coin me-1" /> With Change
                        </button>
                      </>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="small text-muted">
                          <th className="ps-0 border-0 fw-normal">Item</th>
                          <th className="border-0 fw-normal d-none d-sm-table-cell">Variety</th>
                          <th className="text-center border-0 fw-normal">Qty</th>
                          <th className="text-end border-0 fw-normal d-none d-md-table-cell">Unit</th>
                          <th className="text-end border-0 pe-0 fw-normal">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items ?? []).map((item) => {
                          const activeQty = Math.max(0, item.quantity - (item.cancelled_quantity || 0))
                          const lineCancelled = activeQty === 0
                          return (
                            <tr key={item.item_id}>
                              <td
                                className="ps-0 border-0"
                                style={{ textDecoration: lineCancelled ? 'line-through' : 'none' }}
                              >
                                {item.name}
                              </td>
                              <td className="text-muted border-0 small d-none d-sm-table-cell">{item.variety}</td>
                              <td className="text-center border-0">×{activeQty}</td>
                              <td className="text-end border-0 small d-none d-md-table-cell">
                                ₱{fmtMoney(item.unit_price)}
                              </td>
                              <td className="text-end border-0 pe-0">
                                ₱{fmtMoney(item.unit_price * activeQty)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="fw-bold border-top">
                          <td colSpan={3} className="ps-0">Total</td>
                          <td
                            className="text-end pe-0 text-primary"
                            style={{ textDecoration: cancelled ? 'line-through' : 'none' }}
                          >
                            ₱{fmtMoney(order.total_amount)}
                          </td>
                        </tr>
                        {order.amount_paid !== null && order.amount_paid !== undefined && !cancelled && (
                          <tr className="small text-muted">
                            <td colSpan={3} className="ps-0">
                              {isExactPayment(order) ? 'Paid exact' : 'Tendered · Change'}
                            </td>
                            <td className="text-end pe-0">
                              ₱{fmtMoney(order.amount_paid)}
                              {!isExactPayment(order) && (
                                <>
                                  {' · '}
                                  ₱{fmtMoney(Math.max(0, Number(order.amount_paid) - Number(order.total_amount)))}
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky bottom bar — live combined total of selected unpaid orders */}
      {selectionCount > 0 && (
        <div
          className="position-fixed start-0 end-0 bg-white border-top shadow-lg"
          style={{
            bottom: 0,
            zIndex: 1030,
            padding: '0.6rem 0.9rem calc(0.6rem + env(safe-area-inset-bottom)) 0.9rem',
          }}
        >
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="flex-grow-1">
              <div className="small text-muted lh-1">
                <i className="bi bi-check2-square me-1" />
                Selected: {selectionCount} unpaid order(s)
              </div>
              <div className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>
                Total: ₱{selectionTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              disabled={paying}
              onClick={() => {
                const ids = orders
                  .filter((o) => selected.has(o.id) && isUnpaid(o))
                  .map((o) => o.id)
                payExact(ids)
              }}
            >
              <i className="bi bi-check2-circle me-1" /> Exact
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => {
                const ids = orders
                  .filter((o) => selected.has(o.id) && isUnpaid(o))
                  .map((o) => o.id)
                openPayModal(ids, selectionTotal)
              }}
            >
              <i className="bi bi-cash-coin me-1" /> With Change
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSelected(new Set())}
            >
              <i className="bi bi-x-lg me-1" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Payment modal — single or bulk */}
      {payModal && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: 'rgba(0,0,0,.45)', zIndex: 1050 }}
            onClick={closePayModal}
          />
          <div
            className="position-fixed top-50 start-50 translate-middle bg-white rounded shadow-lg"
            style={{ zIndex: 1060, width: 'min(420px, 92vw)', padding: '1rem 1.1rem' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-cash-coin me-2 text-primary" />
                Mark {payModal.ids.length > 1 ? `${payModal.ids.length} orders` : 'order'} as paid
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={closePayModal}
                aria-label="Close"
                disabled={paying}
              />
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">Total due</span>
              <span className="fw-bold fs-5 text-primary">
                ₱{payTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {payModal.ids.length === 1 ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline-success w-100 mb-3"
                  disabled={paying}
                  onClick={() => payExact(payModal.ids)}
                >
                  <i className="bi bi-check2-circle me-1" />
                  Paid exact — ₱{payTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </button>

                <p className="small text-muted mb-2">Or enter cash tendered if customer needs change:</p>
                <label htmlFor="pay-tendered" className="form-label small fw-semibold mb-1">
                  Cash tendered
                </label>
                <div className="input-group mb-2">
                  <span className="input-group-text">₱</span>
                  <input
                    id="pay-tendered"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                {tendered !== '' && (
                  <div
                    className={`d-flex justify-content-between align-items-center mb-2 ${
                      payValid ? (payIsExact ? 'text-primary' : 'text-success') : 'text-danger'
                    }`}
                  >
                    <span>
                      {!payValid ? 'Insufficient' : payIsExact ? 'Exact amount — no change' : 'Change'}
                    </span>
                    <span className="fw-bold">
                      {payValid
                        ? payIsExact
                          ? '₱0.00'
                          : `₱${Math.max(0, payChange).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="small text-muted mb-3">
                Each order will be marked paid at its exact total (no change).
              </p>
            )}

            {payError && <div className="alert alert-danger py-2 small mb-2">{payError}</div>}

            <div className="d-flex gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary flex-grow-1"
                onClick={closePayModal}
                disabled={paying}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success flex-grow-1"
                onClick={() =>
                  payModal.ids.length === 1 ? submitPayment() : payExact(payModal.ids)
                }
                disabled={
                  paying ||
                  (payModal.ids.length === 1 && !payValid)
                }
              >
                {paying ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" /> Saving…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1" />
                    {payModal.ids.length === 1 ? 'Confirm Paid' : `Confirm Exact (${payModal.ids.length})`}
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

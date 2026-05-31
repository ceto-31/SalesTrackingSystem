// src/components/cashier/OrderList.jsx
// Cashier's own orders — pay, partial pay, edit preparing orders.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getCashierOrders, markOrderPaid, payOrderItems } from '../../services/api'
import CustomerName from '../shared/CustomerName'
import EditOrderModal, { activeQty, unpaidQty } from './EditOrderModal'

function fmtMoney(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function orderNum(order) {
  return order.daily_seq > 0 ? order.daily_seq : order.id
}

function paymentStatus(order) {
  if (order.payment_status) return order.payment_status
  if (order.status === 'cancelled') return 'cancelled'
  if (order.amount_paid !== null && order.amount_paid !== undefined) return 'paid'
  return 'unpaid'
}

function dueAmount(order) {
  const rem = order.remaining_total
  if (rem !== undefined && rem !== null) return Number(rem)
  return Number(order.total_amount || 0)
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

function orderSummaryLine(order, ps) {
  const type = order.order_type === 'takeout' ? 'Takeout' : 'Dine-in'
  const items = (order.items ?? []).reduce((s, it) => s + activeQty(it), 0)
  const pay =
    ps === 'paid' ? 'Paid' : ps === 'partial' ? 'Partially paid' : 'Unpaid'
  return `${type} · ${items} item${items !== 1 ? 's' : ''} · ${pay}`
}

const STATUS_META = {
  preparing: { label: 'Preparing', icon: 'bi-fire',          cls: 'bg-warning text-dark' },
  completed: { label: 'Completed', icon: 'bi-check-circle',  cls: 'bg-success'           },
  paid:      { label: 'Paid',      icon: 'bi-check-circle',  cls: 'bg-success'           },
  unpaid:    { label: 'Unpaid',    icon: 'bi-clock',         cls: 'bg-warning text-dark' },
  cancelled: { label: 'Cancelled', icon: 'bi-x-circle',      cls: 'bg-danger'            },
}

const PAYMENT_BADGE = {
  unpaid:  { label: 'Unpaid',  cls: 'bg-warning text-dark' },
  partial: { label: 'Partial', cls: 'bg-info text-dark'    },
  paid:    { label: 'Paid',    cls: 'bg-success'           },
}

export default function OrderList() {
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState('all')
  const [selected,     setSelected]     = useState(() => new Set())
  const [payModal,     setPayModal]     = useState(null)
  const [tendered,     setTendered]     = useState('')
  const [payNote,      setPayNote]      = useState('')
  const [paying,       setPaying]       = useState(false)
  const [payError,     setPayError]     = useState('')
  const [editOrder,    setEditOrder]    = useState(null)
  const [partialModal, setPartialModal] = useState(null)
  const [partialSel,   setPartialSel]   = useState({})
  const [partialTendered, setPartialTendered] = useState('')
  const [partialNote,  setPartialNote]  = useState('')

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

  const isUnpaid  = (o) => paymentStatus(o) === 'unpaid'
  const isPartial = (o) => paymentStatus(o) === 'partial'
  const isPaid    = (o) => paymentStatus(o) === 'paid'
  const hasBalance = (o) => isUnpaid(o) || isPartial(o)
  const isExactPayment = (o) =>
    isPaid(o) && Math.abs(Number(o.amount_paid) - Number(o.total_amount || 0)) < 0.005
  const canEdit = (o) =>
    o.status === 'preparing' && paymentStatus(o) !== 'paid' && paymentStatus(o) !== 'cancelled'

  const filteredOrders = useMemo(() => {
    let list = orders
    if (filter === 'unpaid') list = list.filter((o) => hasBalance(o))
    if (filter === 'paid')   list = list.filter(isPaid)

    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((o) =>
      String(o.id).includes(q) ||
      String(o.daily_seq ?? '').includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q),
    )
  }, [orders, search, filter])

  const unpaidOrders = useMemo(() => orders.filter(hasBalance), [orders])

  const unpaidTotalAll = useMemo(
    () => unpaidOrders.reduce((s, o) => s + dueAmount(o), 0),
    [unpaidOrders],
  )

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectionTotal = useMemo(
    () => orders
      .filter((o) => selected.has(o.id) && hasBalance(o))
      .reduce((s, o) => s + dueAmount(o), 0),
    [orders, selected],
  )

  const selectionCount = useMemo(
    () => orders.filter((o) => selected.has(o.id) && hasBalance(o)).length,
    [orders, selected],
  )

  const openPayModal = (ids, total) => {
    setTendered('')
    setPayNote('')
    setPayError('')
    setPayModal({ ids, total })
  }

  const closePayModal = () => {
    if (paying) return
    setPayModal(null)
    setTendered('')
    setPayNote('')
    setPayError('')
  }

  const openPartialModal = (order) => {
    const sel = {}
    for (const it of order.items ?? []) {
      const u = unpaidQty(it)
      if (u > 0) sel[it.item_id] = u
    }
    setPartialSel(sel)
    setPartialTendered('')
    setPartialNote('')
    setPayError('')
    setPartialModal(order)
  }

  const closePartialModal = () => {
    if (paying) return
    setPartialModal(null)
    setPartialSel({})
    setPartialTendered('')
    setPartialNote('')
    setPayError('')
  }

  const partialSelectedTotal = useMemo(() => {
    if (!partialModal) return 0
    let t = 0
    for (const it of partialModal.items ?? []) {
      const q = partialSel[it.item_id] || 0
      if (q > 0) t += q * Number(it.unit_price)
    }
    return t
  }, [partialModal, partialSel])

  const partialTenderedNum = parseFloat(partialTendered)
  const partialValid =
    partialSelectedTotal > 0 &&
    Number.isFinite(partialTenderedNum) &&
    partialTenderedNum >= partialSelectedTotal

  const tenderedNum = parseFloat(tendered)
  const payTotal    = payModal?.total ?? 0
  const payChange   = Number.isFinite(tenderedNum) ? tenderedNum - payTotal : 0
  const payValid    = Number.isFinite(tenderedNum) && tenderedNum >= payTotal
  const payIsExact  = payValid && Math.abs(tenderedNum - payTotal) < 0.005

  const mergeOrderUpdate = (updated) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
    )
  }

  const applyPayment = async (ids, note = '') => {
    const dueById = new Map(orders.map((o) => [o.id, dueAmount(o)]))
    for (const id of ids) {
      const amount = dueById.get(id) ?? 0
      if (amount <= 0 && !isPartial(orders.find((o) => o.id === id))) continue
      await markOrderPaid(id, amount, note)
    }
    await fetchOrders({ silent: true })
    setSelected(new Set())
    setPayModal(null)
    setTendered('')
    setPayNote('')
  }

  const payExact = async (ids, note = '') => {
    if (paying || ids.length === 0) return
    setPaying(true)
    setPayError('')
    try {
      await applyPayment(ids, note)
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
      const dueById = new Map(orders.map((o) => [o.id, dueAmount(o)]))
      for (const id of payModal.ids) {
        const due = dueById.get(id) ?? 0
        const amount = payModal.ids.length === 1 ? tenderedNum : due
        await markOrderPaid(id, amount, payNote.trim())
      }
      await fetchOrders({ silent: true })
      setSelected(new Set())
      setPayModal(null)
      setTendered('')
      setPayNote('')
    } catch (e) {
      setPayError(e?.response?.data?.error || 'Failed to mark as paid.')
    } finally {
      setPaying(false)
    }
  }

  const submitPartialPayment = async () => {
    if (!partialModal || !partialValid || paying) return
    setPaying(true)
    setPayError('')
    try {
      const items = Object.entries(partialSel)
        .filter(([, q]) => q > 0)
        .map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity }))
      const { data } = await payOrderItems(
        partialModal.id,
        items,
        partialTenderedNum,
        partialNote.trim(),
      )
      if (data?.order) mergeOrderUpdate(data.order)
      else await fetchOrders({ silent: true })
      closePartialModal()
    } catch (e) {
      setPayError(e?.response?.data?.error || 'Failed to record payment.')
    } finally {
      setPaying(false)
    }
  }

  const togglePartialItem = (itemId, maxQty) => {
    setPartialSel((prev) => {
      const next = { ...prev }
      if (next[itemId]) {
        delete next[itemId]
      } else {
        next[itemId] = maxQty
      }
      return next
    })
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
                  openPayModal(unpaidOrders.map((o) => o.id), unpaidTotalAll)
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
            <strong>{unpaidOrders.length}</strong> order(s) with balance — total due{' '}
            <strong>₱{fmtMoney(unpaidTotalAll)}</strong>
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
            onClick={() => openPayModal(unpaidOrders.map((o) => o.id), unpaidTotalAll)}
          >
            <i className="bi bi-cash-coin me-1" /> With Change
          </button>
        </div>
      )}

      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Order filter">
        {[
          { key: 'all',    label: 'All' },
          { key: 'unpaid', label: 'Has balance' },
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
              ? 'No orders with balance.'
              : filter === 'paid'
                ? 'No paid orders.'
                : 'No orders match your search.'}
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredOrders.map((order) => {
            const meta      = STATUS_META[order.status] ?? STATUS_META.preparing
            const cancelled = order.status === 'cancelled'
            const ps        = paymentStatus(order)
            const payBadge  = PAYMENT_BADGE[ps]
            const balance   = dueAmount(order)
            const unpaid    = hasBalance(order)
            const isChecked = selected.has(order.id)
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
                          aria-label={`Select order #${orderNum(order)}`}
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
                      {!cancelled && payBadge && (
                        <>
                          <span className={`badge ${payBadge.cls}`}>{payBadge.label}</span>
                          {isExactPayment(order) && (
                            <span className="badge bg-success bg-opacity-75">Exact</span>
                          )}
                        </>
                      )}
                      <span className={`badge fs-6 ${meta.cls}`}>
                        <i className={`bi ${meta.icon} me-1`} />
                        {meta.label}
                      </span>
                      {!cancelled && (
                        <span className="order-card-total">
                          ₱{fmtMoney(order.total_amount)}
                          {isPartial(order) && (
                            <span className="small text-muted ms-1">
                              (₱{fmtMoney(balance)} due)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <CustomerName name={order.customer_name} />

                  {!cancelled && (
                    <div className="small text-muted mb-2">
                      {orderSummaryLine(order, ps)}
                    </div>
                  )}

                  {order.notes && (
                    <div
                      className="d-flex align-items-start gap-2 small mb-2 px-2 py-2 rounded"
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

                  {order.payment_note && (
                    <div
                      className="d-flex align-items-start gap-2 small mb-3 px-2 py-2 rounded"
                      style={{
                        background: '#f0f9ff',
                        color: '#0369a1',
                        border: '1px solid rgba(3,105,161,.2)',
                      }}
                    >
                      <i className="bi bi-cash-coin mt-1" />
                      <div style={{ wordBreak: 'break-word' }}>{order.payment_note}</div>
                    </div>
                  )}

                  <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
                    {canEdit(order) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setEditOrder(order)}
                      >
                        <i className="bi bi-pencil-square me-1" /> Edit order
                      </button>
                    )}
                    {unpaid && balance > 0 && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info"
                          onClick={() => openPartialModal(order)}
                        >
                          <i className="bi bi-ui-checks me-1" /> Pay selected items
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          disabled={paying}
                          onClick={() => payExact([order.id])}
                          title="Pay remaining balance exactly"
                        >
                          <i className="bi bi-check2-circle me-1" />
                          Exact ₱{fmtMoney(balance)}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => openPayModal([order.id], balance)}
                        >
                          <i className="bi bi-cash-coin me-1" /> With change
                        </button>
                      </>
                    )}
                  </div>

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
                          const act = activeQty(item)
                          const paid = item.paid_quantity || 0
                          const lineCancelled = act === 0
                          return (
                            <tr key={item.item_id}>
                              <td
                                className="ps-0 border-0"
                                style={{ textDecoration: lineCancelled ? 'line-through' : 'none' }}
                              >
                                {item.name}
                                {paid > 0 && act > 0 && (
                                  <span className="badge bg-success ms-1" style={{ fontSize: '0.65rem' }}>
                                    {paid} paid
                                  </span>
                                )}
                              </td>
                              <td className="text-muted border-0 small d-none d-sm-table-cell">{item.variety}</td>
                              <td className="text-center border-0">×{act}</td>
                              <td className="text-end border-0 small d-none d-md-table-cell">
                                ₱{fmtMoney(item.unit_price)}
                              </td>
                              <td className="text-end border-0 pe-0">
                                ₱{fmtMoney(item.unit_price * act)}
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
                        {isPartial(order) && (
                          <tr className="small">
                            <td colSpan={3} className="ps-0 text-info">Paid so far</td>
                            <td className="text-end pe-0 text-info">
                              ₱{fmtMoney(order.paid_total ?? 0)}
                            </td>
                          </tr>
                        )}
                        {unpaid && balance > 0 && (
                          <tr className="small fw-semibold">
                            <td colSpan={3} className="ps-0">Balance due</td>
                            <td className="text-end pe-0 text-warning">₱{fmtMoney(balance)}</td>
                          </tr>
                        )}
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
                Selected: {selectionCount} order(s)
              </div>
              <div className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>
                Due: ₱{fmtMoney(selectionTotal)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              disabled={paying}
              onClick={() => {
                const ids = orders.filter((o) => selected.has(o.id) && hasBalance(o)).map((o) => o.id)
                payExact(ids)
              }}
            >
              <i className="bi bi-check2-circle me-1" /> Exact
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => {
                const ids = orders.filter((o) => selected.has(o.id) && hasBalance(o)).map((o) => o.id)
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

      {payModal && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: 'rgba(0,0,0,.45)', zIndex: 1050 }}
            onClick={closePayModal}
          />
          <div
            className="position-fixed top-50 start-50 translate-middle bg-white rounded-3 shadow-lg"
            style={{ zIndex: 1060, width: 'min(440px, 94vw)', padding: '1rem 1.1rem' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-cash-coin me-2 text-primary" />
                Pay {payModal.ids.length > 1 ? `${payModal.ids.length} orders` : 'order'}
              </h5>
              <button type="button" className="btn-close" onClick={closePayModal} disabled={paying} />
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">Amount due</span>
              <span className="fw-bold fs-5 text-primary">₱{fmtMoney(payTotal)}</span>
            </div>

            {payModal.ids.length === 1 && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-success w-100 mb-3"
                  disabled={paying}
                  onClick={() => payExact(payModal.ids, payNote.trim())}
                >
                  <i className="bi bi-check2-circle me-1" />
                  Paid exact — ₱{fmtMoney(payTotal)}
                </button>

                <p className="small text-muted mb-2">Or enter cash tendered for change:</p>
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
                    <span>{!payValid ? 'Insufficient' : payIsExact ? 'Exact — no change' : 'Change'}</span>
                    <span className="fw-bold">
                      {payValid
                        ? payIsExact
                          ? '₱0.00'
                          : `₱${fmtMoney(Math.max(0, payChange))}`
                        : '—'}
                    </span>
                  </div>
                )}

                <label htmlFor="pay-note" className="form-label small fw-semibold mb-1">
                  Payment note <span className="text-muted fw-normal">(optional)</span>
                </label>
                <textarea
                  id="pay-note"
                  className="form-control form-control-sm mb-2"
                  rows={2}
                  maxLength={255}
                  placeholder="e.g. Split bill — Juan paid first"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </>
            )}

            {payModal.ids.length > 1 && (
              <p className="small text-muted mb-3">
                Each order will be marked paid at its remaining balance.
              </p>
            )}

            {payError && <div className="alert alert-danger py-2 small mb-2">{payError}</div>}

            <div className="d-flex gap-2 mt-3">
              <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={closePayModal} disabled={paying}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success flex-grow-1"
                onClick={() => (payModal.ids.length === 1 ? submitPayment() : payExact(payModal.ids))}
                disabled={paying || (payModal.ids.length === 1 && !payValid)}
              >
                {paying ? (
                  <><span className="spinner-border spinner-border-sm me-1" /> Saving…</>
                ) : (
                  <><i className="bi bi-check-lg me-1" />
                    {payModal.ids.length === 1 ? 'Confirm paid' : `Confirm exact (${payModal.ids.length})`}
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {partialModal && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: 'rgba(0,0,0,.45)', zIndex: 1050 }}
            onClick={closePartialModal}
          />
          <div
            className="position-fixed top-50 start-50 translate-middle bg-white rounded-3 shadow-lg d-flex flex-column"
            style={{ zIndex: 1060, width: 'min(480px, 94vw)', maxHeight: '90vh' }}
          >
            <div className="px-3 pt-3 pb-2 border-bottom flex-shrink-0">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">
                  <i className="bi bi-ui-checks me-2 text-info" />
                  Pay selected items
                </h5>
                <button type="button" className="btn-close" onClick={closePartialModal} disabled={paying} />
              </div>
              <p className="small text-muted mb-0 mt-1">
                Order #{orderNum(partialModal)} — pick which items the customer pays now.
              </p>
            </div>

            <div className="px-3 py-2 overflow-auto flex-grow-1">
              {(partialModal.items ?? []).map((item) => {
                const u = unpaidQty(item)
                if (u <= 0) return null
                const checked = Boolean(partialSel[item.item_id])
                const selQty = partialSel[item.item_id] || 0
                return (
                  <div
                    key={item.item_id}
                    className={`d-flex align-items-center gap-2 p-2 mb-2 rounded border ${
                      checked ? 'border-info bg-info bg-opacity-10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input mt-0 flex-shrink-0"
                      checked={checked}
                      onChange={() => togglePartialItem(item.item_id, u)}
                    />
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{item.name}</div>
                      <div className="small text-muted">
                        ₱{fmtMoney(item.unit_price)} · {u} unpaid
                      </div>
                    </div>
                    {checked && u > 1 && (
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={selQty <= 1}
                          onClick={() =>
                            setPartialSel((p) => ({ ...p, [item.item_id]: selQty - 1 }))
                          }
                        >
                          −
                        </button>
                        <span className="px-1 fw-bold">{selQty}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={selQty >= u}
                          onClick={() =>
                            setPartialSel((p) => ({ ...p, [item.item_id]: selQty + 1 }))
                          }
                        >
                          +
                        </button>
                      </div>
                    )}
                    {checked && (
                      <span className="fw-bold text-primary small">
                        ₱{fmtMoney(selQty * item.unit_price)}
                      </span>
                    )}
                  </div>
                )
              })}

              <div className="d-flex justify-content-between align-items-center py-2 border-top mt-2">
                <span className="text-muted">Selected total</span>
                <span className="fw-bold fs-5 text-primary">₱{fmtMoney(partialSelectedTotal)}</span>
              </div>

              <label className="form-label small fw-semibold mb-1">Cash tendered</label>
              <div className="input-group mb-2">
                <span className="input-group-text">₱</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={partialTendered}
                  onChange={(e) => setPartialTendered(e.target.value)}
                  placeholder={partialSelectedTotal > 0 ? fmtMoney(partialSelectedTotal) : '0.00'}
                />
                {partialSelectedTotal > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setPartialTendered(String(partialSelectedTotal))}
                  >
                    Exact
                  </button>
                )}
              </div>

              <label className="form-label small fw-semibold mb-1">
                Payment note <span className="text-muted fw-normal">(optional)</span>
              </label>
              <textarea
                className="form-control form-control-sm mb-2"
                rows={2}
                maxLength={255}
                placeholder="e.g. Customer will pay sisig later"
                value={partialNote}
                onChange={(e) => setPartialNote(e.target.value)}
              />

              {payError && <div className="alert alert-danger py-2 small">{payError}</div>}
            </div>

            <div className="px-3 py-3 border-top flex-shrink-0">
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={closePartialModal} disabled={paying}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-info text-white flex-grow-1"
                  onClick={submitPartialPayment}
                  disabled={paying || !partialValid}
                >
                  {paying ? (
                    <><span className="spinner-border spinner-border-sm me-1" /> Saving…</>
                  ) : (
                    <><i className="bi bi-check-lg me-1" /> Record payment</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={(updated) => {
            mergeOrderUpdate(updated)
            setEditOrder(null)
          }}
        />
      )}
    </div>
  )
}

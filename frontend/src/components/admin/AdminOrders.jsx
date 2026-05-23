// src/components/admin/AdminOrders.jsx
// Admin kitchen workflow: Preparing / Completed / Cancelled tabs.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAdminOrders,
  completeOrder,
  reopenOrder,
  adjustOrderItemCancel,
  restoreOrder,
} from '../../services/api'
import CustomerName from '../shared/CustomerName'

const POLL_MS = 15000

function fmtMoney(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function orderNum(order) {
  return order.daily_seq > 0 ? order.daily_seq : order.id
}

function isPaid(order) {
  return order.amount_paid !== null && order.amount_paid !== undefined
}

function isExactPayment(order, total) {
  return isPaid(order) && Math.abs(Number(order.amount_paid) - total) < 0.005
}

function OrderTypeBadge({ orderType }) {
  if (!orderType) return null
  const takeout = orderType === 'takeout'
  return (
    <span
      className={`badge ${takeout ? 'bg-primary' : 'bg-info text-dark'}`}
      style={{ fontSize: '0.85rem' }}
    >
      <i className={`bi ${takeout ? 'bi-bag' : 'bi-shop'} me-1`} />
      {takeout ? 'Takeout' : 'Dine-in'}
    </span>
  )
}

function PaymentBadge({ order }) {
  if (order.status === 'cancelled') return null
  if (isPaid(order)) {
    return <span className="badge bg-success">Paid</span>
  }
  return <span className="badge bg-warning text-dark">Unpaid</span>
}

function OrderCard({
  order,
  canEdit,
  highlightPreparing,
  onAction, actionLabel, actionIcon, actionClass, actionDisabled,
  onAdjust,
  busyItemId,
  fullyCancelled,
}) {
  const items = order.items ?? []
  const activeItemCount = items.reduce(
    (s, it) => s + Math.max(0, it.quantity - (it.cancelled_quantity ?? 0)),
    0,
  )
  const liveTotal = items.reduce((s, it) => {
    const active = Math.max(0, it.quantity - (it.cancelled_quantity ?? 0))
    return s + active * it.unit_price
  }, 0)

  return (
    <div
      className={`card border-0 shadow-sm${highlightPreparing ? ' order-card-preparing' : ''}`}
    >
      <div className="card-body">
        {/* Row 1: order # · time · type · status · total */}
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="fw-bold fs-5">#{orderNum(order)}</span>
            <span className="text-muted small">{fmtTime(order.created_at)}</span>
            <OrderTypeBadge orderType={order.order_type} />
            <PaymentBadge order={order} />
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {fullyCancelled ? (
              <span className="badge bg-danger">
                <i className="bi bi-x-octagon me-1" />
                Cancelled
              </span>
            ) : (
              <span className={`badge ${order.status === 'preparing' ? 'bg-warning text-dark' : 'bg-success'}`}>
                <i className={`bi ${order.status === 'preparing' ? 'bi-fire' : 'bi-check-circle'} me-1`} />
                {order.status === 'preparing' ? 'Preparing' : 'Completed'}
              </span>
            )}
            {!fullyCancelled && (
              <span className="order-card-total">₱{fmtMoney(liveTotal)}</span>
            )}
          </div>
        </div>

        {/* Row 2: customer name (hero + avatar) */}
        <CustomerName name={order.customer_name} />

        {/* Row 3: cashier · item count */}
        <div className="small text-muted mb-2">
          <i className="bi bi-cash-coin me-1" />
          Cashier: {order.cashier_name}
          <span className="mx-2">·</span>
          {activeItemCount} item{activeItemCount !== 1 ? 's' : ''}
        </div>

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
            <div style={{ wordBreak: 'break-word' }}>
              <span className="fw-semibold me-1">Notes:</span>
              {order.notes}
            </div>
          </div>
        )}

        <ul className="list-unstyled mb-3 d-flex flex-column gap-2">
          {items.map((item) => {
            const cancelledQty = item.cancelled_quantity ?? 0
            const activeQty    = Math.max(0, item.quantity - cancelledQty)
            const lineTotal    = activeQty * item.unit_price
            const isLineFullyCancelled = cancelledQty >= item.quantity && item.quantity > 0
            const busy = busyItemId === item.item_id

            return (
              <li
                key={item.item_id}
                className="d-flex align-items-center flex-wrap gap-2 px-2 py-2 rounded"
                style={{ background: isLineFullyCancelled ? '#f1f3f5' : '#fff7fa' }}
              >
                <div className="flex-grow-1 min-w-0" style={{ minWidth: 0, flexBasis: 0 }}>
                  <div
                    className="fw-bold text-truncate"
                    style={{ textDecoration: isLineFullyCancelled ? 'line-through' : 'none' }}
                  >
                    {item.name}
                    {cancelledQty > 0 && (
                      <span className="badge bg-danger ms-2 align-middle">
                        {cancelledQty} cancelled
                      </span>
                    )}
                  </div>
                  {item.variety && (
                    <div className="small text-muted text-truncate">{item.variety}</div>
                  )}
                </div>

                <div className="text-end flex-shrink-0" style={{ minWidth: 130 }}>
                  <div className="fw-bold text-dark" style={{ fontSize: '1.05rem', lineHeight: 1.2 }}>
                    ₱{fmtMoney(item.unit_price)} <span className="text-muted">×</span> {activeQty}
                    {cancelledQty > 0 && (
                      <span className="text-danger ms-1 small">(of {item.quantity})</span>
                    )}
                  </div>
                  <div
                    className="text-primary small"
                    style={{ textDecoration: isLineFullyCancelled ? 'line-through' : 'none' }}
                  >
                    ₱{fmtMoney(lineTotal)}
                  </div>
                </div>

                {canEdit && (
                  <div className="btn-group btn-group-sm flex-shrink-0 ms-auto" role="group">
                    <button
                      className="btn btn-outline-secondary"
                      title="Restore one"
                      disabled={busy || cancelledQty === 0}
                      onClick={() => onAdjust(item.item_id, -1)}
                    >
                      <i className="bi bi-arrow-counterclockwise" />
                    </button>
                    <button
                      className="btn btn-outline-danger"
                      title="Cancel one"
                      disabled={busy || activeQty === 0}
                      onClick={() => onAdjust(item.item_id, +1)}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="border-top pt-2 mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Total</span>
            <span className="fw-bold fs-5 text-primary">₱{fmtMoney(liveTotal)}</span>
          </div>
          {isPaid(order) && !fullyCancelled && (
            <div className="d-flex justify-content-between align-items-center small text-muted mt-1">
              <span>{isExactPayment(order, liveTotal) ? 'Paid exact' : 'Tendered · Change'}</span>
              <span>
                ₱{fmtMoney(order.amount_paid)}
                {!isExactPayment(order, liveTotal) && (
                  <>
                    {' · '}
                    ₱{fmtMoney(Math.max(0, Number(order.amount_paid) - liveTotal))}
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {actionLabel && (
          <button
            className={`btn btn-sm ${actionClass} w-100 w-sm-auto`}
            onClick={() => onAction(order.id)}
            disabled={actionDisabled}
          >
            <i className={`bi ${actionIcon} me-1`} />
            {actionLabel}
          </button>
        )}
        {actionDisabled && canEdit && (
          <div className="small text-muted mt-2">
            All items are cancelled — restore an item to complete this order, or it will appear in the Cancelled tab.
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const [tab,         setTab]         = useState('preparing')
  const [orders,      setOrders]      = useState([])
  const [tabCounts,   setTabCounts]   = useState({ preparing: 0, completed: 0, cancelled: 0 })
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [acting,      setActing]      = useState(0)
  const [busyItemId,  setBusyItemId]  = useState(0)

  const fetchTabCounts = useCallback(async () => {
    try {
      const [prep, comp, canc] = await Promise.all([
        getAdminOrders('preparing'),
        getAdminOrders('completed'),
        getAdminOrders('cancelled'),
      ])
      setTabCounts({
        preparing: Array.isArray(prep.data) ? prep.data.length : 0,
        completed: Array.isArray(comp.data) ? comp.data.length : 0,
        cancelled: Array.isArray(canc.data) ? canc.data.length : 0,
      })
    } catch {
      // non-fatal — tab labels keep last counts
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    setError('')
    try {
      const { data } = await getAdminOrders(tab)
      if (Array.isArray(data)) {
        setOrders(data)
      } else {
        setOrders([])
        setError(`Failed to load orders. ${data?.error || 'Unexpected response.'}`)
      }
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      setError(`Failed to load orders. [${status ?? 'network'}] ${detail}`)
    } finally {
      setLoading(false)
    }
  }, [tab])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchTabCounts()])
  }, [fetchOrders, fetchTabCounts])

  useEffect(() => {
    setLoading(true)
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    const t = setInterval(refreshAll, POLL_MS)
    return () => clearInterval(t)
  }, [refreshAll])

  const handleComplete = async (id) => {
    setActing(id)
    try {
      await completeOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      fetchTabCounts()
    } catch {
      alert('Failed to mark as completed.')
    } finally {
      setActing(0)
    }
  }

  const handleReopen = async (id) => {
    setActing(id)
    try {
      await reopenOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      fetchTabCounts()
    } catch {
      alert('Failed to reopen.')
    } finally {
      setActing(0)
    }
  }

  const handleRestore = async (id) => {
    setActing(id)
    try {
      await restoreOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      fetchTabCounts()
    } catch {
      alert('Failed to restore order.')
    } finally {
      setActing(0)
    }
  }

  const handleAdjust = async (orderId, itemId, delta) => {
    setBusyItemId(itemId)
    try {
      const { data } = await adjustOrderItemCancel(orderId, itemId, delta)
      setOrders((prev) => {
        const updated = prev.map((o) =>
          o.id !== orderId ? o : {
            ...o,
            items: (o.items ?? []).map((it) =>
              it.item_id === itemId
                ? { ...it, cancelled_quantity: data.cancelled_quantity }
                : it
            ),
          }
        )
        if (tab === 'preparing') {
          return updated.filter((o) => {
            const remaining = (o.items ?? []).reduce(
              (s, it) => s + Math.max(0, it.quantity - (it.cancelled_quantity ?? 0)),
              0,
            )
            return remaining > 0
          })
        }
        return updated
      })
      fetchTabCounts()
    } catch (err) {
      const detail = err?.response?.data?.error ?? 'Failed to update item.'
      alert(detail)
    } finally {
      setBusyItemId(0)
    }
  }

  const tabBtn = (key, icon, label) => (
    <li className="nav-item" key={key}>
      <button
        className={`nav-link ${tab === key ? 'active' : 'text-dark bg-white border'}`}
        onClick={() => setTab(key)}
      >
        <i className={`bi ${icon} me-1`} /> {label}
        <span className={`badge ms-2 ${tab === key ? 'bg-light text-dark' : 'bg-secondary'}`}>
          {tabCounts[key] ?? 0}
        </span>
      </button>
    </li>
  )

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if (String(o.id).includes(q)) return true
      if (String(o.daily_seq ?? '').includes(q)) return true
      if ((o.customer_name || '').toLowerCase().includes(q)) return true
      return false
    })
  }, [orders, search])

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-receipt-cutoff me-2 text-primary" />
          Kitchen Orders
        </h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={refreshAll}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </div>

      <ul className="nav nav-pills mb-3 gap-2 flex-wrap">
        {tabBtn('preparing', 'bi-fire', 'Preparing')}
        {tabBtn('completed', 'bi-check2-circle', 'Completed')}
        {tabBtn('cancelled', 'bi-x-octagon', 'Cancelled')}
      </ul>

      <div className="input-group input-group-sm mb-3" style={{ maxWidth: 320 }}>
        <span className="input-group-text bg-white">
          <i className="bi bi-search" />
        </span>
        <input
          type="search"
          className="form-control"
          placeholder="Search by #order or customer name…"
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
      ) : orders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox fs-1 d-block mb-2" />
          No {tab} orders.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-search fs-1 d-block mb-2" />
          No {tab} orders match “{search}”.
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredOrders.map((o) => {
            const remaining = (o.items ?? []).reduce(
              (s, it) => s + Math.max(0, it.quantity - (it.cancelled_quantity ?? 0)),
              0,
            )
            const fullyCancelled = remaining === 0

            if (tab === 'preparing') {
              return (
                <OrderCard
                  key={o.id}
                  order={o}
                  canEdit
                  highlightPreparing
                  onAction={handleComplete}
                  actionLabel={acting === o.id ? 'Completing…' : 'Mark Completed'}
                  actionIcon="bi-check2-square"
                  actionClass="btn-success"
                  actionDisabled={fullyCancelled || acting === o.id}
                  onAdjust={(itemId, delta) => handleAdjust(o.id, itemId, delta)}
                  busyItemId={busyItemId}
                  fullyCancelled={fullyCancelled}
                />
              )
            }
            if (tab === 'completed') {
              return (
                <OrderCard
                  key={o.id}
                  order={o}
                  canEdit={false}
                  highlightPreparing={false}
                  onAction={handleReopen}
                  actionLabel={acting === o.id ? 'Reopening…' : 'Reopen (back to Preparing)'}
                  actionIcon="bi-arrow-counterclockwise"
                  actionClass="btn-outline-secondary"
                  actionDisabled={acting === o.id}
                  onAdjust={() => {}}
                  busyItemId={0}
                  fullyCancelled={false}
                />
              )
            }
            return (
              <OrderCard
                key={o.id}
                order={o}
                canEdit={false}
                highlightPreparing={false}
                onAction={handleRestore}
                actionLabel={acting === o.id ? 'Restoring…' : 'Restore Order'}
                actionIcon="bi-arrow-counterclockwise"
                actionClass="btn-primary"
                actionDisabled={acting === o.id}
                onAdjust={() => {}}
                busyItemId={0}
                fullyCancelled
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

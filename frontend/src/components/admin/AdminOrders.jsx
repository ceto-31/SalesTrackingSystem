// src/components/admin/AdminOrders.jsx
// Admin kitchen workflow: Preparing / Completed / Cancelled tabs.
// Admin can cancel/restore individual quantities of a line item.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAdminOrders,
  completeOrder,
  reopenOrder,
  adjustOrderItemCancel,
  restoreOrder,
} from '../../services/api'

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

function OrderCard({
  order,
  canEdit,                   // true on preparing tab
  onAction, actionLabel, actionIcon, actionClass, actionDisabled,
  onAdjust,                  // (itemId, delta) => void
  busyItemId,
  fullyCancelled,
}) {
  const items = order.items ?? []
  const liveTotal = items.reduce((s, it) => {
    const active = Math.max(0, it.quantity - (it.cancelled_quantity ?? 0))
    return s + active * it.unit_price
  }, 0)

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="fw-bold">#{order.id}</span>
            <span className="text-muted small">{fmtTime(order.created_at)}</span>
            {order.order_type && (
              <span
                className={`badge ${
                  order.order_type === 'takeout' ? 'bg-primary' : 'bg-info text-dark'
                }`}
                style={{ fontSize: '0.85rem' }}
              >
                <i className={`bi ${order.order_type === 'takeout' ? 'bi-bag' : 'bi-shop'} me-1`} />
                {order.order_type === 'takeout' ? 'Takeout' : 'Dine-in'}
              </span>
            )}
          </div>
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
        </div>

        <div className="small text-muted mb-3">
          <i className="bi bi-person me-1" />
          {order.customer_name}
          <span className="mx-2">·</span>
          <i className="bi bi-cash-coin me-1" />
          Cashier: {order.cashier_name}
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
                className="d-flex align-items-center gap-2 px-2 py-2 rounded"
                style={{ background: isLineFullyCancelled ? '#f1f3f5' : '#fff7fa' }}
              >
                <div className="flex-grow-1 min-w-0">
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

                <div className="text-end" style={{ minWidth: 110 }}>
                  <div className="small text-muted">
                    ₱{fmtMoney(item.unit_price)} × {activeQty}
                    {cancelledQty > 0 && (
                      <span className="text-danger ms-1">
                        (of {item.quantity})
                      </span>
                    )}
                  </div>
                  <div
                    className="fw-bold text-primary"
                    style={{ textDecoration: isLineFullyCancelled ? 'line-through' : 'none' }}
                  >
                    ₱{fmtMoney(lineTotal)}
                  </div>
                </div>

                {canEdit && (
                  <div className="btn-group btn-group-sm" role="group">
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

        <div className="d-flex justify-content-between align-items-center border-top pt-2 mb-3">
          <span className="fw-bold">Total</span>
          <span className="fw-bold fs-5 text-primary">₱{fmtMoney(liveTotal)}</span>
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
  const [tab,         setTab]         = useState('preparing')   // preparing | completed | cancelled
  const [orders,      setOrders]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [acting,      setActing]      = useState(0)
  const [busyItemId,  setBusyItemId]  = useState(0)

  const fetchOrders = useCallback(async () => {
    setError('')
    try {
      const { data } = await getAdminOrders(tab)
      setOrders(data)
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      setError(`Failed to load orders. [${status ?? 'network'}] ${detail}`)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const t = setInterval(fetchOrders, POLL_MS)
    return () => clearInterval(t)
  }, [fetchOrders])

  const handleComplete = async (id) => {
    setActing(id)
    try {
      await completeOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
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
      // Order goes back to Preparing — drop from Cancelled list
      setOrders((prev) => prev.filter((o) => o.id !== id))
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
        // If on preparing tab and the order just became fully cancelled,
        // remove it (it will reappear on the Cancelled tab).
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
      </button>
    </li>
  )

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if (String(o.id).includes(q)) return true
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
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchOrders}>
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
            // Cancelled tab: read-only items, but can restore the whole order
            return (
              <OrderCard
                key={o.id}
                order={o}
                canEdit={false}
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


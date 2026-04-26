// src/components/admin/AdminOrders.jsx
// Admin kitchen workflow: see Preparing orders, mark them Completed,
// cancel individual items.

import React, { useState, useEffect, useCallback } from 'react'
import {
  getAdminOrders,
  completeOrder,
  reopenOrder,
  cancelOrderItem,
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
  onToggleCancel,            // (itemId, nextCancelled) => void
  busyItemId,
}) {
  const items = order.items ?? []
  const liveTotal = items.reduce(
    (s, it) => s + (it.is_cancelled ? 0 : it.unit_price * it.quantity),
    0,
  )

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <span className="fw-bold">#{order.id}</span>
            <span className="ms-2 text-muted small">{fmtTime(order.created_at)}</span>
          </div>
          <span className={`badge ${order.status === 'preparing' ? 'bg-warning text-dark' : 'bg-success'}`}>
            <i className={`bi ${order.status === 'preparing' ? 'bi-fire' : 'bi-check-circle'} me-1`} />
            {order.status === 'preparing' ? 'Preparing' : 'Completed'}
          </span>
        </div>

        <div className="small text-muted mb-3">
          <i className="bi bi-person me-1" />
          {order.customer_name}
          <span className="mx-2">·</span>
          <i className="bi bi-cash-coin me-1" />
          Cashier: {order.cashier_name}
        </div>

        <ul className="list-unstyled mb-3 d-flex flex-column gap-2">
          {items.map((item) => {
            const lineTotal = item.unit_price * item.quantity
            const cancelled = !!item.is_cancelled
            return (
              <li
                key={item.item_id}
                className={`d-flex align-items-center gap-2 px-2 py-2 rounded ${
                  cancelled ? 'bg-light opacity-75' : ''
                }`}
                style={{
                  textDecoration: cancelled ? 'line-through' : 'none',
                  background: cancelled ? undefined : '#fff7fa',
                }}
              >
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-bold text-truncate">
                    {item.name}
                    {cancelled && (
                      <span className="badge bg-danger ms-2 align-middle">Cancelled</span>
                    )}
                  </div>
                  {item.variety && (
                    <div className="small text-muted text-truncate">{item.variety}</div>
                  )}
                </div>

                <div className="text-end" style={{ minWidth: 110 }}>
                  <div className="small text-muted">
                    ₱{fmtMoney(item.unit_price)} × {item.quantity}
                  </div>
                  <div className="fw-bold text-primary">
                    ₱{fmtMoney(lineTotal)}
                  </div>
                </div>

                {canEdit && (
                  <button
                    className={`btn btn-sm ${
                      cancelled ? 'btn-outline-secondary' : 'btn-outline-danger'
                    }`}
                    title={cancelled ? 'Restore item' : 'Cancel item'}
                    disabled={busyItemId === item.item_id}
                    onClick={() => onToggleCancel(item.item_id, !cancelled)}
                  >
                    <i className={`bi ${cancelled ? 'bi-arrow-counterclockwise' : 'bi-x-lg'}`} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <div className="d-flex justify-content-between align-items-center border-top pt-2 mb-3">
          <span className="fw-bold">Total</span>
          <span className="fw-bold fs-5 text-primary">₱{fmtMoney(liveTotal)}</span>
        </div>

        <button
          className={`btn btn-sm ${actionClass} w-100 w-sm-auto`}
          onClick={() => onAction(order.id)}
          disabled={actionDisabled}
        >
          <i className={`bi ${actionIcon} me-1`} />
          {actionLabel}
        </button>
        {actionDisabled && canEdit && (
          <div className="small text-muted mt-2">
            All items are cancelled — restore an item to complete this order.
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const [tab,         setTab]         = useState('preparing')   // 'preparing' | 'completed'
  const [orders,      setOrders]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
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

  const handleToggleCancel = async (orderId, itemId, nextCancelled) => {
    setBusyItemId(itemId)
    // Optimistic update
    setOrders((prev) => prev.map((o) =>
      o.id !== orderId ? o : {
        ...o,
        items: (o.items ?? []).map((it) =>
          it.item_id === itemId ? { ...it, is_cancelled: nextCancelled ? 1 : 0 } : it
        ),
      }
    ))
    try {
      await cancelOrderItem(orderId, itemId, nextCancelled)
    } catch {
      alert('Failed to update item. Reverting.')
      // Revert
      setOrders((prev) => prev.map((o) =>
        o.id !== orderId ? o : {
          ...o,
          items: (o.items ?? []).map((it) =>
            it.item_id === itemId ? { ...it, is_cancelled: nextCancelled ? 0 : 1 } : it
          ),
        }
      ))
    } finally {
      setBusyItemId(0)
    }
  }

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

      <ul className="nav nav-pills mb-3 gap-2">
        <li className="nav-item">
          <button
            className={`nav-link ${tab === 'preparing' ? 'active' : 'text-dark bg-white border'}`}
            onClick={() => setTab('preparing')}
          >
            <i className="bi bi-fire me-1" /> Preparing
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === 'completed' ? 'active' : 'text-dark bg-white border'}`}
            onClick={() => setTab('completed')}
          >
            <i className="bi bi-check2-circle me-1" /> Completed
          </button>
        </li>
      </ul>

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
      ) : (
        <div className="d-flex flex-column gap-3">
          {orders.map((o) => {
            const allCancelled =
              (o.items ?? []).length > 0 &&
              (o.items ?? []).every((it) => it.is_cancelled)
            return tab === 'preparing' ? (
              <OrderCard
                key={o.id}
                order={o}
                canEdit
                onAction={handleComplete}
                actionLabel={acting === o.id ? 'Completing…' : 'Mark Completed'}
                actionIcon="bi-check2-square"
                actionClass="btn-success"
                actionDisabled={allCancelled || acting === o.id}
                onToggleCancel={(itemId, next) => handleToggleCancel(o.id, itemId, next)}
                busyItemId={busyItemId}
              />
            ) : (
              <OrderCard
                key={o.id}
                order={o}
                canEdit={false}
                onAction={handleReopen}
                actionLabel={acting === o.id ? 'Reopening…' : 'Reopen (back to Preparing)'}
                actionIcon="bi-arrow-counterclockwise"
                actionClass="btn-outline-secondary"
                actionDisabled={acting === o.id}
                onToggleCancel={() => {}}
                busyItemId={0}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

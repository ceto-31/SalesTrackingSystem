// src/components/admin/AdminOrders.jsx
// Admin kitchen workflow: see Preparing orders, mark them Completed.

import React, { useState, useEffect, useCallback } from 'react'
import { getAdminOrders, completeOrder, reopenOrder } from '../../services/api'

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

function OrderCard({ order, onAction, actionLabel, actionIcon, actionClass }) {
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

        <div className="small text-muted mb-2">
          <i className="bi bi-person me-1" />
          {order.customer_name}
          <span className="mx-2">·</span>
          <i className="bi bi-cash-coin me-1" />
          Cashier: {order.cashier_name}
        </div>

        <div className="table-responsive">
          <table className="table table-sm mb-2">
            <tbody>
              {(order.items ?? []).map((item) => (
                <tr key={item.item_id}>
                  <td className="ps-0 border-0">{item.name}</td>
                  <td className="text-muted border-0 small d-none d-sm-table-cell">{item.variety}</td>
                  <td className="text-center border-0">×{item.quantity}</td>
                  <td className="text-end border-0 pe-0">
                    ₱{fmtMoney(item.unit_price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-bold border-top">
                <td colSpan={3} className="ps-0">Total</td>
                <td className="text-end pe-0 text-primary">₱{fmtMoney(order.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <button
          className={`btn btn-sm ${actionClass} w-100 w-sm-auto`}
          onClick={() => onAction(order.id)}
        >
          <i className={`bi ${actionIcon} me-1`} />
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const [tab,     setTab]     = useState('preparing')   // 'preparing' | 'completed'
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [acting,  setActing]  = useState(0)

  const fetchOrders = useCallback(async () => {
    setError('')
    try {
      const { data } = await getAdminOrders(tab)
      setOrders(data)
    } catch {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  // Initial fetch on tab change
  useEffect(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  // Poll while mounted
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
          {orders.map((o) =>
            tab === 'preparing' ? (
              <OrderCard
                key={o.id}
                order={o}
                onAction={handleComplete}
                actionLabel={acting === o.id ? 'Completing…' : 'Mark Completed'}
                actionIcon="bi-check2-square"
                actionClass="btn-success"
              />
            ) : (
              <OrderCard
                key={o.id}
                order={o}
                onAction={handleReopen}
                actionLabel={acting === o.id ? 'Reopening…' : 'Reopen (back to Preparing)'}
                actionIcon="bi-arrow-counterclockwise"
                actionClass="btn-outline-secondary"
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

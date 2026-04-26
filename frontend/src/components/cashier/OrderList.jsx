// src/components/cashier/OrderList.jsx
// Cashier's own orders with paid/unpaid badge and status toggle.

import React, { useState, useEffect, useCallback } from 'react'
import { getCashierOrders, updateOrderStatus } from '../../services/api'

export default function OrderList() {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getCashierOrders()
      setOrders(data)
    } catch {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const toggleStatus = async (order) => {
    const next = order.status === 'paid' ? 'unpaid' : 'paid'
    try {
      await updateOrderStatus(order.id, next)
      setOrders((prev) =>
        prev.map((o) => o.id === order.id ? { ...o, status: next } : o)
      )
    } catch {
      alert('Failed to update order status.')
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-list-ul me-2 text-primary" /> My Orders
        </h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchOrders}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-receipt fs-1 d-block mb-2" />
          No orders yet.
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {orders.map((order) => (
            <div key={order.id} className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between mb-2 flex-wrap gap-2">
                  <div>
                    <span className="fw-bold">#{order.id}</span>
                    <span className="ms-2 text-muted small">
                      {new Date(order.created_at).toLocaleString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className={`badge fs-6 ${
                        order.status === 'paid'
                          ? 'bg-success'
                          : 'bg-warning text-dark'
                      }`}
                    >
                      {order.status === 'paid' ? (
                        <><i className="bi bi-check-circle me-1" />Paid</>
                      ) : (
                        <><i className="bi bi-clock me-1" />Unpaid</>
                      )}
                    </span>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => toggleStatus(order)}
                      title="Toggle status"
                    >
                      <i className="bi bi-arrow-repeat" />
                    </button>
                  </div>
                </div>

                <div className="small text-muted mb-2">
                  <i className="bi bi-person me-1" />
                  {order.customer_name}
                </div>

                {/* Items list */}
                <table className="table table-sm mb-0">
                  <tbody>
                    {(order.items ?? []).map((item) => (
                      <tr key={item.item_id}>
                        <td className="ps-0 border-0">{item.name}</td>
                        <td className="text-muted border-0 small">{item.variety}</td>
                        <td className="text-center border-0">×{item.quantity}</td>
                        <td className="text-end border-0 pe-0">
                          ₱{(item.unit_price * item.quantity).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="fw-bold border-top">
                      <td colSpan={3} className="ps-0">Total</td>
                      <td className="text-end pe-0 text-primary">
                        ₱{Number(order.total_amount).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

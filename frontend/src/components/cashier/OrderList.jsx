// src/components/cashier/OrderList.jsx
// Cashier's own orders — read-only kitchen status (preparing / completed / cancelled).
// Adds: search, cancelled status reflection, multi-select unpaid orders w/ live total.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getCashierOrders } from '../../services/api'

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
  const [selected,  setSelected]  = useState(() => new Set())

  const fetchOrders = useCallback(async () => {
    setLoading(true)
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
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) =>
      String(o.id).includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q),
    )
  }, [orders, search])

  const isUnpaid = (o) => o.status !== 'cancelled' && (o.amount_paid === null || o.amount_paid === undefined)

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

  return (
    <div style={selectionCount > 0 ? { paddingBottom: 96 } : undefined}>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-list-ul me-2 text-primary" /> My Orders
        </h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchOrders}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </div>

      <div className="input-group input-group-sm mb-3" style={{ maxWidth: 360 }}>
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
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-receipt fs-1 d-block mb-2" />
          {orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
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
                    <div className="d-flex align-items-center gap-2">
                      {unpaid && (
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={isChecked}
                          onChange={() => toggleSelect(order.id)}
                          aria-label={`Select unpaid order #${order.id}`}
                        />
                      )}
                      <div>
                        <span className="fw-bold">#{order.id}</span>
                        <span className="ms-2 text-muted small">
                          {new Date(order.created_at).toLocaleString('en-PH', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {!cancelled && order.amount_paid !== null && order.amount_paid !== undefined && (
                        <span className="badge bg-success">Paid</span>
                      )}
                      {!cancelled && unpaid && (
                        <span className="badge bg-warning text-dark">Unpaid</span>
                      )}
                      <span className={`badge fs-6 ${meta.cls}`}>
                        <i className={`bi ${meta.icon} me-1`} />
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  <div className="small text-muted mb-2">
                    <i className="bi bi-person me-1" />
                    {order.customer_name}
                  </div>

                  {/* Items list */}
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
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
                              <td className="text-end border-0 pe-0">
                                ₱{(item.unit_price * activeQty).toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                })}
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
                            ₱{Number(order.total_amount).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                        {order.amount_paid !== null && order.amount_paid !== undefined && !cancelled && (
                          <tr className="small text-muted">
                            <td colSpan={3} className="ps-0">Tendered · Change</td>
                            <td className="text-end pe-0">
                              ₱{Number(order.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              {' · '}
                              ₱{Math.max(0, Number(order.amount_paid) - Number(order.total_amount))
                                .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSelected(new Set())}
            >
              <i className="bi bi-x-lg me-1" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

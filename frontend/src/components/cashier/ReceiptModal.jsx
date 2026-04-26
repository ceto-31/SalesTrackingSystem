// src/components/cashier/ReceiptModal.jsx
// Unofficial digital receipt shown after a cashier sends an order.

import React, { useEffect } from 'react'

const SHOP_NAME = "Cherie's FoodHouse"

function fmtMoney(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function fmtDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ReceiptModal({ order, onClose }) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!order) return null

  const items = order.items ?? []
  const total = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow">
          <div className="modal-body p-4 font-monospace" style={{ fontSize: '0.92rem' }}>
            <div className="text-center mb-2">
              <div className="fw-bold fs-5" style={{ letterSpacing: '0.5px' }}>
                {SHOP_NAME}
              </div>
              <div className="small text-muted">Unofficial Receipt</div>
            </div>

            <div className="border-top border-bottom border-secondary-subtle border-2 my-2"
                 style={{ borderStyle: 'dashed !important' }} />

            <div className="d-flex justify-content-between small">
              <span>Order #</span>
              <span className="fw-bold">{order.id}</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span>Date</span>
              <span>{fmtDate(order.created_at)}</span>
            </div>
            {order.cashier_name && (
              <div className="d-flex justify-content-between small">
                <span>Cashier</span>
                <span>{order.cashier_name}</span>
              </div>
            )}
            <div className="d-flex justify-content-between small">
              <span>Customer</span>
              <span>{order.customer_name}</span>
            </div>
            {order.order_type && (
              <div className="d-flex justify-content-between small">
                <span>Type</span>
                <span className="fw-bold text-primary">
                  {order.order_type === 'takeout' ? 'Takeout' : 'Dine-in'}
                </span>
              </div>
            )}

            <div
              className="my-2"
              style={{ borderTop: '1px dashed #adb5bd' }}
            />

            <div className="d-flex flex-column gap-2 my-2">
              {items.map((it, idx) => (
                <div key={idx}>
                  <div className="fw-bold">{it.name}</div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">
                      ₱{fmtMoney(it.unit_price)} × {it.quantity}
                    </span>
                    <span>₱{fmtMoney(it.unit_price * it.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="my-2"
              style={{ borderTop: '1px dashed #adb5bd' }}
            />

            <div className="d-flex justify-content-between fw-bold fs-5">
              <span>TOTAL</span>
              <span className="text-primary">₱{fmtMoney(total)}</span>
            </div>

            <div
              className="my-2"
              style={{ borderTop: '1px dashed #adb5bd' }}
            />

            <div className="text-center small text-muted">
              Thank you for your order!
              <br />
              <em>Not for tax purposes</em>
            </div>
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-primary w-100" onClick={onClose}>
              <i className="bi bi-check2 me-1" />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// src/components/cashier/NewOrder.jsx
// Cashier: take a new order — pick products, set customer name, choose paid/unpaid.

import React, { useState, useEffect, useMemo } from 'react'
import { getProducts, createOrder } from '../../services/api'

export default function NewOrder() {
  const [products,      setProducts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [customerName,  setCustomerName]  = useState('')
  const [cart,          setCart]          = useState([])  // [{product, quantity}]
  const [status,        setStatus]        = useState('unpaid')
  const [submitting,    setSubmitting]    = useState(false)
  const [successMsg,    setSuccessMsg]    = useState('')
  const [filterVariety, setFilterVariety] = useState('All')

  useEffect(() => {
    getProducts()
      .then(({ data }) => setProducts(data))
      .catch(() => setError('Failed to load products.'))
      .finally(() => setLoading(false))
  }, [])

  const varieties = useMemo(() => {
    const all = [...new Set(products.map((p) => p.variety))].sort()
    return ['All', ...all]
  }, [products])

  const filtered = useMemo(() =>
    filterVariety === 'All'
      ? products
      : products.filter((p) => p.variety === filterVariety),
    [products, filterVariety]
  )

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const changeQty = (productId, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((i) => i.product.id === productId ? { ...i, quantity: qty } : i)
      )
    }
  }

  const total = useMemo(() =>
    cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [cart]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cart.length === 0) {
      alert('Add at least one product to the order.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createOrder(
        customerName,
        status,
        cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }))
      )
      setCart([])
      setCustomerName('')
      setStatus('unpaid')
      setSuccessMsg('Order placed successfully!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to place order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="row g-4" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* ── Product Grid ── */}
      <div className="col-lg-8">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="fw-bold mb-0">
            <i className="bi bi-grid me-2 text-primary" /> Products
          </h5>
          <div className="d-flex gap-1 flex-wrap">
            {varieties.map((v) => (
              <button
                key={v}
                className={`btn btn-sm ${filterVariety === v ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setFilterVariety(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="text-center py-5"><div className="spinner-border text-primary" /></div>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && (
          <div className="row g-3 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {filtered.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id)
              return (
                <div className="col-6 col-md-4 col-xl-3" key={p.id}>
                  <div
                    className={`card h-100 border-0 shadow-sm product-card ${inCart ? 'border border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => addToCart(p)}
                  >
                    {p.image ? (
                      <img
                        src={`/${p.image}`}
                        alt={p.name}
                        className="card-img-top"
                        style={{ height: 120, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="bg-light d-flex align-items-center justify-content-center"
                        style={{ height: 120 }}
                      >
                        <i className="bi bi-image fs-2 text-muted" />
                      </div>
                    )}
                    <div className="card-body p-2">
                      <div className="fw-semibold small text-truncate">{p.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.variety}</div>
                      <div className="fw-bold text-primary mt-1">
                        ₱{Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      {inCart && (
                        <span className="badge bg-primary position-absolute top-0 end-0 m-1">
                          ×{inCart.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Order Summary ── */}
      <div className="col-lg-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white fw-bold">
            <i className="bi bi-receipt me-2 text-primary" /> Order Summary
          </div>
          <div className="card-body d-flex flex-column p-3 overflow-auto">
            {successMsg && (
              <div className="alert alert-success py-2">{successMsg}</div>
            )}
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="mb-3">
              <label className="form-label fw-semibold small">Customer Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="text-center text-muted py-3 flex-grow-1">
                <i className="bi bi-cart3 fs-1 d-block mb-1" />
                Click a product to add it
              </div>
            ) : (
              <div className="flex-grow-1 overflow-auto mb-3">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="d-flex align-items-center mb-2 gap-2">
                    <div className="flex-grow-1 small fw-semibold text-truncate">
                      {product.name}
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        style={{ padding: '0 6px', lineHeight: '1.4' }}
                        onClick={() => changeQty(product.id, quantity - 1)}
                      >−</button>
                      <span className="px-1">{quantity}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        style={{ padding: '0 6px', lineHeight: '1.4' }}
                        onClick={() => changeQty(product.id, quantity + 1)}
                      >+</button>
                    </div>
                    <div className="small fw-semibold" style={{ minWidth: 70, textAlign: 'right' }}>
                      ₱{(product.price * quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-top pt-3">
              <div className="d-flex justify-content-between fw-bold mb-3">
                <span>Total</span>
                <span className="text-primary">
                  ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Paid / Unpaid toggle */}
              <div className="d-flex gap-2 mb-3">
                <button
                  type="button"
                  className={`btn flex-fill ${status === 'paid' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setStatus('paid')}
                >
                  <i className="bi bi-check-circle me-1" /> Paid
                </button>
                <button
                  type="button"
                  className={`btn flex-fill ${status === 'unpaid' ? 'btn-warning' : 'btn-outline-warning'}`}
                  onClick={() => setStatus('unpaid')}
                >
                  <i className="bi bi-clock me-1" /> Unpaid
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={submitting || cart.length === 0 || !customerName.trim()}
                >
                  {submitting
                    ? <span className="spinner-border spinner-border-sm me-2" />
                    : <i className="bi bi-send me-2" />
                  }
                  Place Order
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

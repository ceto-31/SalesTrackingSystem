// src/components/cashier/NewOrder.jsx
// Cashier: take a new order — pick products, set customer name, choose paid/unpaid.

import React, { useState, useEffect, useMemo } from 'react'
import { getProducts, getTopProducts, createOrder } from '../../services/api'
import ReceiptModal from './ReceiptModal'

export default function NewOrder() {
  const [products,      setProducts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [customerName,  setCustomerName]  = useState('')
  const [cart,          setCart]          = useState([])  // [{product, quantity}]
  const [submitting,    setSubmitting]    = useState(false)
  const [successMsg,    setSuccessMsg]    = useState('')
  const [filterVariety, setFilterVariety] = useState('All')
  const [receiptOrder,  setReceiptOrder]  = useState(null)
  const [orderType,     setOrderType]     = useState('dine_in')   // 'dine_in' | 'takeout'
  const [notes,         setNotes]         = useState('')
  const [search,        setSearch]        = useState('')
  const [topRanks,      setTopRanks]      = useState({})  // { productId: rank (1-based) }

  useEffect(() => {
    getTopProducts(30)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((row, idx) => {
          map[row.product_id] = idx + 1
        })
        setTopRanks(map)
      })
      .catch(() => { /* non-blocking — grid still works without ranks */ })
  }, [])

  useEffect(() => {
    getProducts()
      .then(({ data }) => setProducts(data))
      .catch((err) => {
        const status = err?.response?.status
        const detail = err?.response?.data?.error || err?.message || 'Unknown error'
        setError(`Failed to load products. [${status ?? 'network'}] ${detail}`)
      })
      .finally(() => setLoading(false))
  }, [])

  const varieties = useMemo(() => {
    const all = [...new Set(products.map((p) => p.variety))].sort()
    return ['All', ...all]
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filterVariety === 'All'
      ? products
      : products.filter((p) => p.variety === filterVariety)
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.variety || '').toLowerCase().includes(q),
      )
    }
    // Stable sort: ranked items first (by rank ASC), then the rest in original order.
    return [...list].sort((a, b) => {
      const ra = topRanks[a.id]
      const rb = topRanks[b.id]
      if (ra && rb) return ra - rb
      if (ra) return -1
      if (rb) return 1
      return 0
    })
  }, [products, filterVariety, search, topRanks])

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
    if (customerName.trim() === '') {
      setError('Customer name is required.')
      return
    }
    if (cart.length === 0) {
      alert('Add at least one product to the order.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { data } = await createOrder(
        customerName,
        'preparing',
        cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        orderType,
        notes.trim(),
      )
      setReceiptOrder(data)
      setCart([])
      setCustomerName('')
      setOrderType('dine_in')
      setNotes('')
      setSuccessMsg('Order sent to kitchen!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to place order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="row g-4">
      {/* ── Product Grid ── */}
      <div className="col-lg-8">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h5 className="fw-bold mb-0">
            <i className="bi bi-grid me-2 text-primary" /> Products
          </h5>
          <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
            <span className="input-group-text bg-white">
              <i className="bi bi-search" />
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>
        </div>
        <div className="d-flex gap-1 flex-wrap mb-3">
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

        {loading && <div className="text-center py-5"><div className="spinner-border text-primary" /></div>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && (
          <div className="row g-3">
            {filtered.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id)
              const rank = topRanks[p.id]
              return (
                <div className="col-6 col-sm-6 col-md-4 col-xl-3" key={p.id}>
                  <div
                    className={`card h-100 border-0 shadow-sm product-card ${inCart ? 'border border-primary' : ''}`}
                    style={{ cursor: 'pointer', position: 'relative' }}
                    onClick={() => addToCart(p)}
                  >
                    {rank && rank <= 3 && (
                      <span
                        className="badge position-absolute top-0 start-0 m-1"
                        style={{
                          background: '#f1c40f',
                          color: '#5c4500',
                          fontSize: '0.7rem',
                          zIndex: 2,
                        }}
                        title={`Top seller (rank #${rank} in last 30 days)`}
                      >
                        <i className="bi bi-star-fill me-1" />
                        Top
                      </span>
                    )}
                    {p.image ? (
                      <div className="ratio ratio-1x1">
                        <img
                          src={`/${p.image}`}
                          alt={p.name}
                          className="card-img-top"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div className="ratio ratio-1x1">
                        <div className="bg-light d-flex align-items-center justify-content-center">
                          <i className="bi bi-image fs-2 text-muted" />
                        </div>
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
          <div className="card-body d-flex flex-column p-3" style={{ minHeight: 0 }}>
            {successMsg && (
              <div className="alert alert-success py-2">{successMsg}</div>
            )}
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="mb-3">
              <label className="form-label fw-semibold small">
                Customer Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-control ${
                  customerName.trim() === '' ? 'border-danger' : ''
                }`}
                placeholder="Required — enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                aria-required="true"
              />
              {customerName.trim() === '' && (
                <div className="form-text text-danger small">
                  Customer name is required before sending the order.
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small d-block">Order Type</label>
              <div className="btn-group w-100" role="group" aria-label="Order type">
                <button
                  type="button"
                  className={`btn ${orderType === 'dine_in' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setOrderType('dine_in')}
                >
                  <i className="bi bi-shop me-1" /> Dine-in
                </button>
                <button
                  type="button"
                  className={`btn ${orderType === 'takeout' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setOrderType('takeout')}
                >
                  <i className="bi bi-bag me-1" /> Takeout
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-sticky me-1 text-primary" />
                  Notes (optional)
                </span>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {notes.length}/255
                </span>
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                maxLength={255}
                placeholder="e.g. less spicy, no onions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Total + Send button — placed RIGHT AFTER order details so the
                button is visible without scrolling past a long cart list. */}
            <div
              className="border-top border-bottom py-3 mb-3"
              style={{ background: '#fff7fa', borderRadius: 6 }}
            >
              <div className="d-flex justify-content-between fw-bold mb-2 px-2">
                <span>Total</span>
                <span className="text-primary">
                  ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <form onSubmit={handleSubmit} className="px-2">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={submitting || cart.length === 0 || !customerName.trim()}
                >
                  {submitting
                    ? <span className="spinner-border spinner-border-sm me-2" />
                    : <i className="bi bi-send me-2" />
                  }
                  Send to Kitchen
                </button>
              </form>
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="text-center text-muted py-3">
                <i className="bi bi-cart3 fs-1 d-block mb-1" />
                Click a product to add it
              </div>
            ) : (
              <div>
                <div className="small fw-semibold text-muted mb-2">
                  <i className="bi bi-basket me-1" /> Items ({cart.length})
                </div>
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
          </div>
          </div>
        </div>
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  )
}

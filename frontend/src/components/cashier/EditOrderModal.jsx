// Edit a preparing order — change items, customer, notes (kitchen already notified).

import React, { useState, useEffect, useMemo } from 'react'
import { getProducts, editCashierOrder } from '../../services/api'
import ProductImage, { productImageUrl } from '../shared/ProductImage'

function fmtMoney(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function activeQty(item) {
  return Math.max(0, item.quantity - (item.cancelled_quantity || 0))
}

function unpaidQty(item) {
  return Math.max(0, activeQty(item) - (item.paid_quantity || 0))
}

function minQty(item) {
  return (item.paid_quantity || 0) + (item.cancelled_quantity || 0)
}

export default function EditOrderModal({ order, onClose, onSaved }) {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [customerName, setCustomerName] = useState(order.customer_name || '')
  const [notes, setNotes] = useState(order.notes || '')
  const [orderType, setOrderType] = useState(order.order_type || 'dine_in')
  const [lines, setLines] = useState(() =>
    (order.items ?? []).map((it) => ({
      ...it,
      quantity: it.quantity,
      _remove: false,
    })),
  )
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [filterVariety, setFilterVariety] = useState('All')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getProducts()
      .then(({ data }) => setProducts(data || []))
      .catch(() => setError('Could not load products.'))
      .finally(() => setLoadingProducts(false))
  }, [])

  const varieties = useMemo(() => {
    const all = [...new Set(products.map((p) => p.variety))].sort()
    return ['All', ...all]
  }, [products])

  const filteredProducts = useMemo(() => {
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
    return list
  }, [products, filterVariety, search])

  const visibleLines = lines.filter((l) => !l._remove && activeQty(l) > 0)

  const editTotal = useMemo(() => {
    let t = 0
    for (const l of visibleLines) {
      t += activeQty({ ...l, quantity: l.quantity }) * l.unit_price
    }
    for (const c of cart) {
      t += c.product.price * c.quantity
    }
    return t
  }, [visibleLines, cart])

  const changeLineQty = (itemId, qty) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.item_id !== itemId) return l
        const floor = minQty(l)
        const next = Math.max(floor, qty)
        return { ...l, quantity: next }
      }),
    )
  }

  const removeLine = (itemId) => {
    const line = lines.find((l) => l.item_id === itemId)
    if (!line) return
    if ((line.paid_quantity || 0) > 0) {
      setError('Cannot remove items that have already been paid.')
      return
    }
    setLines((prev) =>
      prev.map((l) => (l.item_id === itemId ? { ...l, _remove: true } : l)),
    )
    setError('')
  }

  const addToCart = (product) => {
    setCart((prev) => {
      const hit = prev.find((c) => c.product.id === product.id)
      if (hit) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const changeCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((c) => (c.product.id === productId ? { ...c, quantity: qty } : c)),
      )
    }
  }

  const handleSave = async () => {
    if (customerName.trim() === '') {
      setError('Customer name is required.')
      return
    }
    const activeCount =
      visibleLines.length + cart.reduce((s, c) => s + c.quantity, 0)
    if (activeCount === 0) {
      setError('Order must have at least one item.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        customer_name: customerName.trim(),
        notes: notes.trim(),
        order_type: orderType,
        items: visibleLines.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
        })),
        remove_item_ids: lines.filter((l) => l._remove).map((l) => l.item_id),
        add_items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
        })),
      }
      const { data } = await editCashierOrder(order.id, payload)
      onSaved(data)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{ background: 'rgba(0,0,0,.45)', zIndex: 1050 }}
        onClick={() => !saving && onClose()}
      />
      <div
        className="position-fixed top-50 start-50 translate-middle bg-white rounded-3 shadow-lg d-flex flex-column"
        style={{ zIndex: 1060, width: 'min(720px, 96vw)', maxHeight: '92vh' }}
      >
        <div className="px-3 py-3 border-bottom flex-shrink-0">
          <div className="d-flex align-items-center justify-content-between">
            <h5 className="fw-bold mb-0">
              <i className="bi bi-pencil-square me-2 text-primary" />
              Edit Order #{order.daily_seq > 0 ? order.daily_seq : order.id}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
            />
          </div>
          <p className="small text-muted mb-0 mt-1">
            Changes apply while the order is still preparing. Paid items cannot be removed.
          </p>
        </div>

        <div className="px-3 py-3 overflow-auto flex-grow-1">
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Customer name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Order type</label>
              <select
                className="form-select form-select-sm"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              >
                <option value="dine_in">Dine-in</option>
                <option value="takeout">Takeout</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">Kitchen notes</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                maxLength={255}
                placeholder="Special requests for the kitchen…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <h6 className="fw-semibold mb-2">Current items</h6>
          {visibleLines.length === 0 ? (
            <p className="small text-muted">No items left — add products below.</p>
          ) : (
            <div className="d-flex flex-column gap-2 mb-3">
              {visibleLines.map((line) => {
                const paid = line.paid_quantity || 0
                const floor = minQty(line)
                const canRemove = paid === 0
                return (
                  <div
                    key={line.item_id}
                    className="d-flex align-items-center gap-2 p-2 rounded border bg-light"
                  >
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{line.name}</div>
                      <div className="small text-muted">
                        ₱{fmtMoney(line.unit_price)} each
                        {paid > 0 && (
                          <span className="badge bg-success ms-2">{paid} paid</span>
                        )}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={line.quantity <= floor}
                        onClick={() => changeLineQty(line.item_id, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="px-2 fw-bold">{line.quantity}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => changeLineQty(line.item_id, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    {canRemove && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeLine(line.item_id)}
                        title="Remove item"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <h6 className="fw-semibold mb-2">Add products</h6>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                type="search"
                className="form-control"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 160 }}
              value={filterVariety}
              onChange={(e) => setFilterVariety(e.target.value)}
            >
              {varieties.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {loadingProducts ? (
            <div className="text-center py-3">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          ) : (
            <div className="row g-2 mb-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filteredProducts.slice(0, 24).map((p) => (
                <div key={p.id} className="col-6 col-md-4">
                  <button
                    type="button"
                    className="btn btn-light w-100 text-start p-2 border h-100"
                    onClick={() => addToCart(p)}
                  >
                    <div className="d-flex gap-2 align-items-center">
                      <ProductImage
                        src={productImageUrl(p.image)}
                        alt={p.name}
                        aspect="square"
                        className="flex-shrink-0"
                        style={{ width: 40 }}
                      />
                      <div className="min-w-0">
                        <div className="small fw-semibold text-truncate">{p.name}</div>
                        <div className="small text-primary">₱{fmtMoney(p.price)}</div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <>
              <h6 className="fw-semibold mb-2">New items to add</h6>
              <div className="d-flex flex-column gap-2">
                {cart.map((c) => (
                  <div
                    key={c.product.id}
                    className="d-flex align-items-center gap-2 p-2 rounded border"
                  >
                    <span className="flex-grow-1">{c.product.name}</span>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => changeCartQty(c.product.id, c.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="px-2 fw-bold">{c.quantity}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => changeCartQty(c.product.id, c.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-3 py-3 border-top flex-shrink-0 bg-white rounded-bottom-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-muted">Updated total</span>
            <span className="fw-bold fs-5 text-primary">₱{fmtMoney(editTotal)}</span>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary flex-grow-1"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary flex-grow-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> Saving…
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-1" /> Save changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export { activeQty, unpaidQty }

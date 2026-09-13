// src/components/admin/AdminProducts.jsx
// Product management: list, add, edit, delete.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getAdminProducts, deleteProduct, updateProduct } from '../../services/api'
import ProductForm from './ProductForm'
import ProductImage, { productImageUrl } from '../shared/ProductImage'

const PRODUCTS_PER_PAGE = 10

export default function AdminProducts() {
  const [products,      setProducts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [modal,         setModal]         = useState(null)  // null | 'create' | product object
  const [search,        setSearch]        = useState('')
  const [filterVariety, setFilterVariety] = useState('All')
  const [page,          setPage]          = useState(1)
  const [editingId,     setEditingId]     = useState(null)
  const [editDraft,     setEditDraft]     = useState(null)  // { name, variety, price }
  const [editError,     setEditError]     = useState('')
  const [editSaving,    setEditSaving]    = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getAdminProducts()
      setProducts(data)
    } catch {
      setError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const varieties = useMemo(() => {
    const all = [...new Set(products.map((p) => p.variety).filter(Boolean))].sort()
    return ['All', ...all]
  }, [products])

  const categoryOptions = useMemo(
    () => [...new Set(products.map((p) => p.variety).filter(Boolean))].sort(),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filterVariety === 'All'
      ? products
      : products.filter((p) => p.variety === filterVariety)
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [products, filterVariety, search])

  useEffect(() => {
    setPage(1)
  }, [search, filterVariety, products])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE))
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PRODUCTS_PER_PAGE
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE)
  }, [filteredProducts, page])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
    setEditError('')
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setEditDraft({
      name: product.name,
      variety: product.variety || '',
      price: String(product.price),
    })
    setEditError('')
  }

  const openFullEdit = (product) => {
    cancelEdit()
    setModal(product)
  }

  const openCreateModal = () => {
    cancelEdit()
    setModal('create')
  }

  const handleDelete = async (product) => {
    if (editingId === product.id) cancelEdit()
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch {
      alert('Failed to delete product.')
    }
  }

  const handleSaved = () => {
    setModal(null)
    fetchProducts()
  }

  const saveEdit = async (productId) => {
    if (!editDraft) return

    const name = editDraft.name.trim()
    const variety = editDraft.variety.trim()
    const priceNum = parseFloat(editDraft.price)

    if (!name) {
      setEditError('Product name is required.')
      return
    }
    if (!variety) {
      setEditError('Category is required.')
      return
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setEditError('Price must be a positive number.')
      return
    }

    setEditError('')
    setEditSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('price', String(priceNum))
      fd.append('variety', variety)

      const { data } = await updateProduct(productId, fd)
      setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)))
      cancelEdit()
    } catch (err) {
      setEditError(err.response?.data?.error ?? 'Failed to save product.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-box-seam me-2 text-primary" />
          Products
        </h4>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
            <span className="input-group-text bg-white">
              <i className="bi bi-search" />
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="Search product name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <i className="bi bi-plus-lg me-1" /> Add Product
          </button>
        </div>
      </div>

      {!loading && products.length > 0 && (
        <div className="d-flex gap-1 flex-wrap mb-3">
          {varieties.map((v) => (
            <button
              key={v}
              type="button"
              className={`btn btn-sm ${filterVariety === v ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterVariety(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-box fs-1 d-block mb-2" />
          No products yet. Click "Add Product" to get started.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-search fs-1 d-block mb-2" />
          No products match your filters.
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 64 }}>Image</th>
                  <th>Name</th>
                  <th className="d-none d-md-table-cell">Category</th>
                  <th className="text-end">Price</th>
                  <th style={{ width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((p) => {
                  const isEditing = editingId === p.id
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="product-image-thumb-wrap">
                          <ProductImage
                            src={productImageUrl(p.image)}
                            alt={p.name}
                            aspect="square"
                            rounded
                          />
                        </div>
                      </td>
                      <td className={isEditing ? '' : 'fw-semibold'}>
                        {isEditing ? (
                          <input
                            type="text"
                            className={`form-control form-control-sm ${editError && !editDraft?.name.trim() ? 'is-invalid' : ''}`}
                            value={editDraft?.name ?? ''}
                            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            disabled={editSaving}
                            aria-label="Product name"
                          />
                        ) : (
                          <>
                            {p.name}
                            <span className="badge bg-secondary bg-opacity-25 text-dark border border-secondary border-opacity-25 ms-2 d-md-none">
                              {p.variety}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="d-none d-md-table-cell">
                        {isEditing ? (
                          <select
                            className={`form-select form-select-sm ${editError && !editDraft?.variety.trim() ? 'is-invalid' : ''}`}
                            value={editDraft?.variety ?? ''}
                            onChange={(e) => setEditDraft((d) => ({ ...d, variety: e.target.value }))}
                            disabled={editSaving}
                            aria-label="Category"
                          >
                            <option value="">Select category…</option>
                            {categoryOptions.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {editDraft?.variety && !categoryOptions.includes(editDraft.variety) && (
                              <option value={editDraft.variety}>{editDraft.variety}</option>
                            )}
                          </select>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-25 text-dark border border-secondary border-opacity-25">
                            {p.variety}
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className={`form-control form-control-sm text-end ${editError && (Number.isNaN(parseFloat(editDraft?.price)) || parseFloat(editDraft?.price) <= 0) ? 'is-invalid' : ''}`}
                            value={editDraft?.price ?? ''}
                            onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                            disabled={editSaving}
                            aria-label="Price"
                          />
                        ) : (
                          <>₱{Number(p.price).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                          })}</>
                        )}
                      </td>
                      <td className="text-end">
                        {isEditing ? (
                          <div className="d-flex flex-column align-items-end gap-1">
                            <div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success me-1"
                                onClick={() => saveEdit(p.id)}
                                disabled={editSaving}
                                title="Save"
                              >
                                {editSaving
                                  ? <span className="spinner-border spinner-border-sm" />
                                  : <i className="bi bi-check-lg" />}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={cancelEdit}
                                disabled={editSaving}
                                title="Cancel"
                              >
                                <i className="bi bi-x-lg" />
                              </button>
                            </div>
                            {editError && (
                              <div className="small text-danger text-end" style={{ maxWidth: 160 }}>
                                {editError}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary me-1"
                              onClick={() => startEdit(p)}
                              title="Edit name, category, price"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary me-1"
                              onClick={() => openFullEdit(p)}
                              title="Edit image"
                            >
                              <i className="bi bi-image" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(p)}
                              title="Delete"
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
          {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <div className="card-footer bg-white d-flex align-items-center justify-content-center gap-3 py-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="small text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <ProductForm
          product={modal === 'create' ? null : modal}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

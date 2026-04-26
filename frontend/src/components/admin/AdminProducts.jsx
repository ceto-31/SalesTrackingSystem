// src/components/admin/AdminProducts.jsx
// Product management: list, add, edit, delete.

import React, { useState, useEffect, useCallback } from 'react'
import { getAdminProducts, deleteProduct } from '../../services/api'
import ProductForm from './ProductForm'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [modal,    setModal]    = useState(null)  // null | 'create' | product object

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

  const handleDelete = async (product) => {
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

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-box-seam me-2 text-primary" />
          Products
        </h4>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <i className="bi bi-plus-lg me-1" /> Add Product
        </button>
      </div>

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
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <img
                          src={`/${p.image}`}
                          alt={p.name}
                          style={{ width: 48, height: 48, objectFit: 'cover' }}
                          className="rounded"
                        />
                      ) : (
                        <div
                          className="rounded bg-light d-flex align-items-center justify-content-center"
                          style={{ width: 48, height: 48 }}
                        >
                          <i className="bi bi-image text-muted" />
                        </div>
                      )}
                    </td>
                    <td className="fw-semibold">
                      {p.name}
                      <span className="badge bg-secondary bg-opacity-15 text-dark ms-2 d-md-none">
                        {p.variety}
                      </span>
                    </td>
                    <td className="d-none d-md-table-cell">
                      <span className="badge bg-secondary bg-opacity-15 text-dark">
                        {p.variety}
                      </span>
                    </td>
                    <td className="text-end">
                      ₱{Number(p.price).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => setModal(p)}
                        title="Edit"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(p)}
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
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

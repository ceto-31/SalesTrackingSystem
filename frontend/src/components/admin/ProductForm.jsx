// src/components/admin/ProductForm.jsx
// Modal form used for both creating and editing a product.

import React, { useState, useEffect, useRef } from 'react'
import { createProduct, updateProduct } from '../../services/api'

const EMPTY = { name: '', price: '', variety: '' }

export default function ProductForm({ product, onSaved, onClose }) {
  const [fields,   setFields]   = useState(EMPTY)
  const [preview,  setPreview]  = useState(null)
  const [fileObj,  setFileObj]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef()

  const isEdit = Boolean(product)

  useEffect(() => {
    if (product) {
      setFields({ name: product.name, price: product.price, variety: product.variety })
      setPreview(product.image ? `/${product.image}` : null)
    } else {
      setFields(EMPTY)
      setPreview(null)
      setFileObj(null)
    }
  }, [product])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileObj(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData()
    fd.append('name',    fields.name.trim())
    fd.append('price',   fields.price)
    fd.append('variety', fields.variety.trim())
    if (fileObj) fd.append('image', fileObj)

    try {
      if (isEdit) {
        await updateProduct(product.id, fd)
      } else {
        await createProduct(fd)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save product.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              {isEdit ? 'Edit Product' : 'Add Product'}
            </h5>
            <button className="btn-close" onClick={onClose} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {/* Image upload */}
              <div className="mb-3 text-center">
                {preview ? (
                  <img
                    src={preview}
                    alt="preview"
                    className="rounded mb-2"
                    style={{ width: 120, height: 120, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="rounded bg-light d-inline-flex align-items-center justify-content-center mb-2"
                    style={{ width: 120, height: 120 }}
                  >
                    <i className="bi bi-image fs-1 text-muted" />
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => fileRef.current.click()}
                  >
                    <i className="bi bi-upload me-1" />
                    {preview ? 'Change Image' : 'Upload Image'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Product Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={fields.name}
                  onChange={(e) => setFields({ ...fields, name: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Price (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={fields.price}
                  onChange={(e) => setFields({ ...fields, price: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Category (Variety)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Drinks, Snacks, Meals"
                  value={fields.variety}
                  onChange={(e) => setFields({ ...fields, variety: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <span className="spinner-border spinner-border-sm me-2" />
                  : null
                }
                {isEdit ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

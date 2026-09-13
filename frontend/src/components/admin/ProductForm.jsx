// src/components/admin/ProductForm.jsx
// Modal form used for both creating and editing a product.

import React, { useState, useEffect, useRef } from 'react'
import { createProduct, updateProduct, getCategories } from '../../services/api'
import ProductImage, { productImageUrl } from '../shared/ProductImage'

const EMPTY_FIELDS = { name: '', variety: '' }

let nextPriceRowKey = 0
function newPriceRow(price = '', label = '') {
  nextPriceRowKey += 1
  return { key: nextPriceRowKey, price: price === '' ? '' : String(price), label }
}

function buildFormData(name, price, variety, fileObj) {
  const fd = new FormData()
  fd.append('name', name)
  fd.append('price', price)
  fd.append('variety', variety)
  if (fileObj) fd.append('image', fileObj)
  return fd
}

function describePriceRow(row) {
  const label = row.label.trim()
  const price = row.price
  return label ? `${label} (₱${price})` : `₱${price}`
}

export default function ProductForm({ product, onSaved, onClose }) {
  const [fields,        setFields]        = useState(EMPTY_FIELDS)
  const [priceRows,     setPriceRows]     = useState([newPriceRow()])
  const [preview,       setPreview]       = useState(null)
  const [fileObj,       setFileObj]       = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [batchSummary,  setBatchSummary]  = useState(null)
  const [categories,    setCategories]    = useState([])
  const fileRef = useRef()

  const isEdit = Boolean(product)

  const resetCreateForm = () => {
    setFields(EMPTY_FIELDS)
    setPriceRows([newPriceRow()])
    setPreview(null)
    setFileObj(null)
    setBatchSummary(null)
    setError('')
  }

  // Load category suggestions once on mount
  useEffect(() => {
    let cancel = false
    getCategories()
      .then(({ data }) => { if (!cancel) setCategories(Array.isArray(data) ? data : []) })
      .catch(() => { /* silent: datalist is just a hint */ })
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    if (product) {
      setFields({ name: product.name, variety: product.variety })
      setPriceRows([newPriceRow(product.price)])
      setPreview(product.image ? productImageUrl(product.image) : null)
      setBatchSummary(null)
      setError('')
    } else {
      resetCreateForm()
    }
  }, [product])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileObj(file)
    setPreview(URL.createObjectURL(file))
  }

  const addPriceRow = () => {
    setPriceRows((prev) => [...prev, newPriceRow()])
  }

  const removePriceRow = (key) => {
    setPriceRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const updatePriceRow = (key, patch) => {
    setPriceRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const validateForm = () => {
    const name = fields.name.trim()
    const variety = fields.variety.trim()
    if (!name || !variety) {
      setError('Product name and category are required.')
      return null
    }

    const invalidRows = priceRows.filter((row) => {
      const priceNum = parseFloat(row.price)
      return Number.isNaN(priceNum) || priceNum <= 0
    })
    if (invalidRows.length > 0) {
      setError('Each price must be a positive number.')
      return null
    }

    return { name, variety }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBatchSummary(null)

    const validated = validateForm()
    if (!validated) return

    const { name, variety } = validated
    setLoading(true)

    try {
      if (isEdit) {
        const fd = buildFormData(name, priceRows[0].price, variety, fileObj)
        await updateProduct(product.id, fd)
        onSaved()
        return
      }

      if (priceRows.length === 1) {
        const fd = buildFormData(name, priceRows[0].price, variety, fileObj)
        await createProduct(fd)
        resetCreateForm()
        onSaved()
        return
      }

      const succeeded = []
      const failed = []

      for (let i = 0; i < priceRows.length; i += 1) {
        const row = priceRows[i]
        const label = row.label.trim()
        const rowName = label ? `${name} (${label})` : name
        const fd = buildFormData(rowName, row.price, variety, fileObj)
        try {
          await createProduct(fd)
          succeeded.push({ row, index: i })
        } catch (err) {
          failed.push({
            row,
            index: i,
            error: err.response?.data?.error ?? 'Failed to save product.',
          })
        }
      }

      if (failed.length === 0) {
        resetCreateForm()
        onSaved()
        return
      }

      setBatchSummary({ succeeded, failed })
      setPriceRows(failed.map(({ row }) => ({ ...row })))

      if (succeeded.length > 0) {
        onSaved({ keepOpen: true })
        const created = succeeded.map(({ row }) => describePriceRow(row)).join(', ')
        const failures = failed
          .map(({ row, error: rowError }) => `${describePriceRow(row)}: ${rowError}`)
          .join('; ')
        setError(
          `Created ${succeeded.length} product(s): ${created}. `
          + `Failed ${failed.length}: ${failures}. Fix the remaining row(s) and submit again.`,
        )
      } else {
        setError(
          failed
            .map(({ row, error: rowError }) => `${describePriceRow(row)}: ${rowError}`)
            .join('; '),
        )
      }
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save product.')
    } finally {
      setLoading(false)
    }
  }

  const submitLabel = isEdit
    ? 'Save Changes'
    : priceRows.length > 1
      ? `Add ${priceRows.length} Products`
      : 'Add Product'

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
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

              {batchSummary?.succeeded?.length > 0 && (
                <div className="alert alert-success py-2 small mb-3">
                  <strong>Created:</strong>{' '}
                  {batchSummary.succeeded.map(({ row }) => describePriceRow(row)).join(', ')}
                </div>
              )}

              {/* Image upload */}
              <div className="mb-3 text-center mx-auto" style={{ maxWidth: 140 }}>
                {preview ? (
                  <img
                    src={preview}
                    alt="preview"
                    className="product-image-fit rounded"
                    style={{ width: 120, height: 120, objectFit: 'cover', objectPosition: 'center' }}
                  />
                ) : (
                  <ProductImage src={null} alt="Product" aspect="square" />
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
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label fw-semibold mb-0">Price (₱)</label>
                  {!isEdit && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0"
                      onClick={addPriceRow}
                      disabled={loading}
                    >
                      + Add another price
                    </button>
                  )}
                </div>

                {isEdit ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    value={priceRows[0]?.price ?? ''}
                    onChange={(e) => updatePriceRow(priceRows[0].key, { price: e.target.value })}
                    required
                  />
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {priceRows.map((row, idx) => (
                      <div key={row.key} className="d-flex align-items-start gap-2">
                        <div className="flex-grow-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control"
                            placeholder="Price"
                            value={row.price}
                            onChange={(e) => updatePriceRow(row.key, { price: e.target.value })}
                            required
                            aria-label={`Price row ${idx + 1}`}
                          />
                        </div>
                        {priceRows.length > 1 && (
                          <div style={{ width: 120 }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Label (optional)"
                              value={row.label}
                              onChange={(e) => updatePriceRow(row.key, { label: e.target.value })}
                              aria-label={`Price label row ${idx + 1}`}
                            />
                          </div>
                        )}
                        {priceRows.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => removePriceRow(row.key)}
                            disabled={loading}
                            title="Remove price row"
                            aria-label={`Remove price row ${idx + 1}`}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        )}
                      </div>
                    ))}
                    {priceRows.length > 1 && (
                      <div className="form-text">
                        Shared name, category, and image apply to every price row.
                        Optional labels are appended to the name, e.g. &quot;Fries BBQ (Large)&quot;.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Category</label>
                <input
                  type="text"
                  className="form-control"
                  list="product-category-options"
                  placeholder="Pick or type a new category"
                  value={fields.variety}
                  onChange={(e) => setFields({ ...fields, variety: e.target.value })}
                  required
                />
                <datalist id="product-category-options">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="form-text">
                  Suggestions come from your saved categories. Type a new one to add it.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <span className="spinner-border spinner-border-sm me-2" />
                  : null
                }
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

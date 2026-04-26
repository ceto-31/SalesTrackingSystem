// src/components/admin/AdminUsers.jsx
// Manage cashier accounts: list, create, delete.

import React, { useState, useEffect, useCallback } from 'react'
import { getCashiers, createCashier, deleteCashier } from '../../services/api'

export default function AdminUsers() {
  const [cashiers,  setCashiers]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [formError, setFormError] = useState('')
  const [saving,    setSaving]    = useState(false)

  const fetchCashiers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getCashiers()
      setCashiers(data)
    } catch {
      setError('Failed to load cashier list.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCashiers() }, [fetchCashiers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await createCashier(username, password)
      setUsername('')
      setPassword('')
      setShowForm(false)
      fetchCashiers()
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Failed to create cashier.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cashier) => {
    if (!window.confirm(`Delete cashier "${cashier.username}"?`)) return
    try {
      await deleteCashier(cashier.id)
      setCashiers((prev) => prev.filter((c) => c.id !== cashier.id))
    } catch {
      alert('Failed to delete cashier.')
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-people me-2 text-primary" />
          Cashiers
        </h4>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(!showForm); setFormError('') }}
        >
          <i className="bi bi-person-plus me-1" /> Add Cashier
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3">New Cashier Account</h6>
            {formError && <div className="alert alert-danger py-2">{formError}</div>}
            <form onSubmit={handleCreate} className="row g-3">
              <div className="col-12 col-md-5">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="col-12 col-md-5">
                <input
                  type="password"
                  className="form-control"
                  placeholder="Password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="col-12 col-md-2">
                <button type="submit" className="btn btn-success w-100" disabled={saving}>
                  {saving
                    ? <span className="spinner-border spinner-border-sm" />
                    : 'Create'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : cashiers.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-person-x fs-1 d-block mb-2" />
          No cashier accounts yet.
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="d-none d-sm-table-cell">#</th>
                  <th>Username</th>
                  <th className="d-none d-md-table-cell">Created</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {cashiers.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted d-none d-sm-table-cell">{i + 1}</td>
                    <td className="fw-semibold">
                      <i className="bi bi-person-circle me-2 text-secondary" />
                      {c.username}
                    </td>
                    <td className="text-muted small d-none d-md-table-cell">
                      {new Date(c.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(c)}
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
    </div>
  )
}

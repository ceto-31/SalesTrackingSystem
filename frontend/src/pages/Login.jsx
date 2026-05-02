// src/pages/Login.jsx

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [info,     setInfo]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate   = useNavigate()
  const { login }  = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const expired = params.get('reason') === 'expired'
      || sessionStorage.getItem('session_expired') === '1'
    if (expired) {
      setInfo('Your session expired. Please sign in again.')
      try { sessionStorage.removeItem('session_expired') } catch {}
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await apiLogin(username, password)
      login(data)
      navigate(data.role === 'admin' ? '/admin' : '/cashier', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3 py-4">
      <div className="card shadow-sm" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-cart-check-fill fs-1 text-primary" />
            <h4 className="mt-2 fw-bold">Order Tracking System</h4>
            <p className="text-muted small">Sign in to continue</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="alert alert-warning py-2" role="status">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="form-control"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading
                ? <span className="spinner-border spinner-border-sm me-2" role="status" />
                : <i className="bi bi-box-arrow-in-right me-2" />
              }
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

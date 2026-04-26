// src/App.jsx
// Root router: redirects by role, protected routes.

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login         from './pages/Login'
import AdminLayout   from './pages/AdminLayout'
import CashierLayout from './pages/CashierLayout'

function RequireRole({ role, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/login" replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin' : '/cashier'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<RootRedirect />} />
          <Route path="/login"  element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          />
          <Route
            path="/cashier/*"
            element={
              <RequireRole role="cashier">
                <CashierLayout />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

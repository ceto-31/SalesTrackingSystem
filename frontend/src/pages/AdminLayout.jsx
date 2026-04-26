// src/pages/AdminLayout.jsx
// Sidebar layout wrapper for all admin pages.

import React from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminProducts  from '../components/admin/AdminProducts'
import AdminAnalytics from '../components/admin/AdminAnalytics'
import AdminUsers     from '../components/admin/AdminUsers'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }) =>
    'nav-link d-flex align-items-center gap-2 rounded px-3 py-2 ' +
    (isActive ? 'active bg-primary text-white' : 'text-dark')

  return (
    <div className="d-flex vh-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className="d-flex flex-column bg-white border-end shadow-sm"
        style={{ width: 230, minWidth: 230 }}
      >
        <div className="p-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-cart-check-fill fs-4 text-primary" />
            <span className="fw-bold">Order Tracker</span>
          </div>
          <div className="text-muted small mt-1">
            <i className="bi bi-person-circle me-1" />
            {user?.username}
            <span className="badge bg-primary ms-2">Admin</span>
          </div>
        </div>

        <nav className="p-2 flex-grow-1">
          <NavLink to="/admin/analytics" className={navClass}>
            <i className="bi bi-bar-chart-line" /> Analytics
          </NavLink>
          <NavLink to="/admin/products" className={navClass}>
            <i className="bi bi-box-seam" /> Products
          </NavLink>
          <NavLink to="/admin/users" className={navClass}>
            <i className="bi bi-people" /> Cashiers
          </NavLink>
        </nav>

        <div className="p-2 border-top">
          <button
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-left" /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-grow-1 overflow-auto bg-light p-4">
        <Routes>
          <Route index                element={<Navigate to="analytics" replace />} />
          <Route path="analytics"     element={<AdminAnalytics />} />
          <Route path="products"      element={<AdminProducts />} />
          <Route path="users"         element={<AdminUsers />} />
        </Routes>
      </main>
    </div>
  )
}

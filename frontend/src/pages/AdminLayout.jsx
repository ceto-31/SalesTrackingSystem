// src/pages/AdminLayout.jsx
// Responsive sidebar layout wrapper for all admin pages.
// On <lg the sidebar becomes a slide-in drawer toggled by a hamburger button.

import React, { useState } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminProducts  from '../components/admin/AdminProducts'
import AdminAnalytics from '../components/admin/AdminAnalytics'
import AdminUsers     from '../components/admin/AdminUsers'

const SIDEBAR_WIDTH = 230

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const [open, setOpen]  = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const closeDrawer = () => setOpen(false)

  const navClass = ({ isActive }) =>
    'nav-link d-flex align-items-center gap-2 rounded px-3 py-2 ' +
    (isActive ? 'active bg-primary text-white' : 'text-dark')

  return (
    <div className="d-flex flex-column flex-lg-row vh-100 overflow-hidden">
      {/* ── Mobile top bar (only <lg) ── */}
      <nav className="navbar bg-white border-bottom shadow-sm d-lg-none px-3 py-2">
        <button
          type="button"
          className="btn btn-outline-secondary"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <i className="bi bi-list fs-5" />
        </button>
        <span className="navbar-brand fw-bold d-flex align-items-center gap-2 mb-0">
          <i className="bi bi-cart-check-fill text-primary" />
          Order Tracker
        </span>
        <span className="badge bg-primary">Admin</span>
      </nav>

      {/* ── Backdrop (mobile drawer only) ── */}
      {open && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-lg-none"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1040 }}
          onClick={closeDrawer}
        />
      )}

      {/* ── Sidebar / Drawer ── */}
      <aside
        className="d-flex flex-column bg-white border-end shadow-sm"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          // On <lg act as a fixed-position drawer that slides in from the left
          position: typeof window !== 'undefined' && window.innerWidth < 992 ? 'fixed' : 'relative',
          top: 0,
          bottom: 0,
          left: 0,
          height: '100%',
          zIndex: 1050,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease-in-out',
        }}
        // Override the JS-based transform on lg+ via a data attribute & CSS class below
        data-admin-sidebar
      >
        <div className="p-3 border-bottom d-flex align-items-start justify-content-between">
          <div>
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
          {/* Close button visible only on mobile */}
          <button
            type="button"
            className="btn btn-sm btn-link text-secondary p-0 d-lg-none"
            aria-label="Close menu"
            onClick={closeDrawer}
          >
            <i className="bi bi-x-lg fs-5" />
          </button>
        </div>

        <nav className="p-2 flex-grow-1" onClick={closeDrawer}>
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

      {/* CSS override: on lg+ the drawer is just a normal in-flow column */}
      <style>{`
        @media (min-width: 992px) {
          aside[data-admin-sidebar] {
            position: relative !important;
            transform: none !important;
            z-index: auto !important;
          }
        }
      `}</style>

      {/* ── Main content ── */}
      <main className="flex-grow-1 overflow-auto bg-light p-3 p-md-4">
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

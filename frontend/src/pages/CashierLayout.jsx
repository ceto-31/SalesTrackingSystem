// src/pages/CashierLayout.jsx
// Simple top-navbar layout for cashier pages.

import React from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NewOrder   from '../components/cashier/NewOrder'
import OrderList  from '../components/cashier/OrderList'

export default function CashierLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }) =>
    'nav-link px-3 py-2 rounded ' +
    (isActive ? 'active text-white bg-primary' : 'text-dark')

  return (
    <div className="d-flex flex-column vh-100">
      {/* ── Topbar ── */}
      <nav className="navbar bg-white border-bottom shadow-sm px-4 py-2">
        <span className="navbar-brand fw-bold d-flex align-items-center gap-2">
          <i className="bi bi-cart-check-fill text-primary" />
          Order Tracker
        </span>

        <div className="d-flex align-items-center gap-3">
          <NavLink to="/cashier/new-order" className={navClass}>
            <i className="bi bi-plus-circle me-1" /> New Order
          </NavLink>
          <NavLink to="/cashier/orders" className={navClass}>
            <i className="bi bi-list-ul me-1" /> My Orders
          </NavLink>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">
            <i className="bi bi-person-circle me-1" />
            {user?.username}
            <span className="badge bg-secondary ms-2">Cashier</span>
          </span>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-left" /> Logout
          </button>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-grow-1 overflow-auto bg-light p-4">
        <Routes>
          <Route index                element={<Navigate to="new-order" replace />} />
          <Route path="new-order"     element={<NewOrder />} />
          <Route path="orders"        element={<OrderList />} />
        </Routes>
      </main>
    </div>
  )
}

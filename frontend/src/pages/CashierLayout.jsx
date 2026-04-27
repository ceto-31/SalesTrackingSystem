// src/pages/CashierLayout.jsx
// Responsive top-navbar layout for cashier pages.
// Below md the nav links + user/logout collapse behind a hamburger toggle.

import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NewOrder   from '../components/cashier/NewOrder'
import OrderList  from '../components/cashier/OrderList'
import NotificationBell from '../components/NotificationBell'
import { getCashierOrders } from '../services/api'

const NOTIF_POLL_MS = 15000
const LAST_SEEN_KEY = 'cashier_completed_last_seen'

export default function CashierLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // ── Completed-order notifications ──────────────────────────────────────────────
  // Show a toast when one of THIS cashier's orders flips to 'completed'.
  const [notifItems, setNotifItems] = useState([])
  const [seenIds, setSeenIds] = useState(
    () => new Set(JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || '[]')),
  )

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await getCashierOrders()
      const items = (data || [])
        .filter((o) => o.status === 'completed' && !seenIds.has(o.id))
        .map((o) => ({
          id: o.id,
          title: `Order #${o.id} completed`,
          subtitle: o.customer_name,
        }))
      setNotifItems(items)
    } catch {
      // silent
    }
  }, [seenIds])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])
  useEffect(() => {
    const t = setInterval(fetchNotifs, NOTIF_POLL_MS)
    return () => clearInterval(t)
  }, [fetchNotifs])

  const handleNotifOpen = () => {
    if (notifItems.length === 0) return
    const nextSeen = new Set(seenIds)
    notifItems.forEach((it) => nextSeen.add(it.id))
    // Cap stored set so localStorage doesn't grow forever
    const arr = Array.from(nextSeen).slice(-200)
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(arr))
    setSeenIds(new Set(arr))
  }

  const handleNotifItemClick = () => {
    navigate('/cashier/orders')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const closeMenu = () => setOpen(false)

  const navClass = ({ isActive }) =>
    'nav-link px-3 py-2 rounded ' +
    (isActive ? 'active text-white bg-primary' : 'text-dark')

  return (
    <div className="d-flex flex-column vh-100">
      {/* ── Topbar ── */}
      <nav className="navbar navbar-expand-md bg-white border-bottom shadow-sm px-3 py-2">
        <div className="container-fluid p-0 gap-2">
          <span className="navbar-brand fw-bold d-flex align-items-center gap-2 mb-0">
            <i className="bi bi-cart-check-fill text-primary" />
            Order Tracker
          </span>

          <button
            type="button"
            className="navbar-toggler border"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className={
              'collapse navbar-collapse ' + (open ? 'show' : '')
            }
          >
            <div
              className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2 gap-md-3 ms-md-3 mt-2 mt-md-0"
              onClick={closeMenu}
            >
              <NavLink to="/cashier/new-order" className={navClass}>
                <i className="bi bi-plus-circle me-1" /> New Order
              </NavLink>
              <NavLink to="/cashier/orders" className={navClass}>
                <i className="bi bi-list-ul me-1" /> My Orders
              </NavLink>
            </div>

            <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2 ms-md-auto mt-2 mt-md-0">
              <div className="d-flex align-items-center gap-2">
                <NotificationBell
                  count={notifItems.length}
                  items={notifItems}
                  onOpen={handleNotifOpen}
                  onItemClick={handleNotifItemClick}
                  title="Order updates"
                  emptyText="No new updates"
                />
                <span className="text-muted small">
                  <i className="bi bi-person-circle me-1" />
                  {user?.username}
                  <span className="badge bg-secondary bg-opacity-25 text-dark border border-secondary border-opacity-25 ms-2">Cashier</span>
                </span>
              </div>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-left" /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-grow-1 overflow-auto bg-light p-3 p-md-4">
        <Routes>
          <Route index                element={<Navigate to="new-order" replace />} />
          <Route path="new-order"     element={<NewOrder />} />
          <Route path="orders"        element={<OrderList />} />
        </Routes>
      </main>
    </div>
  )
}

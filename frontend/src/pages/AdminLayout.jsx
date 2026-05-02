// src/pages/AdminLayout.jsx
// Responsive sidebar layout wrapper for all admin pages.
// On <lg the sidebar becomes a slide-in drawer toggled by a hamburger button.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminProducts  from '../components/admin/AdminProducts'
import AdminAnalytics from '../components/admin/AdminAnalytics'
import AdminUsers     from '../components/admin/AdminUsers'
import AdminOrders    from '../components/admin/AdminOrders'
import { getAdminOrders } from '../services/api'

const SIDEBAR_WIDTH = 230
const NOTIF_POLL_MS = 15000
const LAST_SEEN_KEY = 'admin_orders_last_seen'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()
  const [open, setOpen]  = useState(false)

  // ── New-order notifications ────────────────────────────────────────────────
  const [notifItems, setNotifItems] = useState([])
  const [lastSeen, setLastSeen] = useState(
    () => Number(localStorage.getItem(LAST_SEEN_KEY)) || 0,
  )
  const prevCountRef = useRef(0)
  const audioRef = useRef(null)
  const audioUnlockedRef = useRef(false)
  const lastNotifiedTsRef = useRef(0)

  // Lazy-init the audio element once + arm it on the first user gesture so
  // browsers (which block autoplay) actually let us play it later.
  useEffect(() => {
    const a = new Audio('/sounds/notificationBuzzer.mp3')
    a.preload = 'auto'
    a.volume = 0.7
    audioRef.current = a

    const unlock = () => {
      if (audioUnlockedRef.current) return
      try {
        a.muted = true
        const p = a.play()
        if (p && typeof p.then === 'function') {
          p.then(() => {
            a.pause()
            a.currentTime = 0
            a.muted = false
            audioUnlockedRef.current = true
          }).catch(() => { /* will retry on next gesture */ })
        }
      } catch { /* silent */ }
    }
    document.addEventListener('pointerdown', unlock, { once: false })
    document.addEventListener('keydown',     unlock, { once: false })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown',     unlock)
    }
  }, [])

  const playBuzzer = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    try {
      a.currentTime = 0
      const p = a.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch { /* silent */ }
  }, [])

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await getAdminOrders('preparing')
      const list = Array.isArray(data) ? data : []
      const items = list
        .filter((o) => new Date(o.created_at).getTime() > lastSeen)
        .map((o) => ({
          id: o.id,
          title: `New order #${o.id} — ${o.customer_name}`,
          subtitle: new Date(o.created_at).toLocaleString('en-PH', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
        }))
      setNotifItems(items)

      // Ring on any genuinely-new order, regardless of count delta. This
      // fixes the case where the admin sits on the Orders tab (lastSeen
      // advances to 'now', so notifItems.length stays 0 even though new
      // orders are arriving).
      const newest = list.reduce((m, o) => {
        const t = new Date(o.created_at).getTime()
        return t > m ? t : m
      }, 0)
      if (newest > lastNotifiedTsRef.current) {
        if (lastNotifiedTsRef.current !== 0) {
          playBuzzer()
        }
        lastNotifiedTsRef.current = newest
      }
    } catch {
      // silent — polling will retry
    }
  }, [lastSeen, playBuzzer])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])
  useEffect(() => {
    const t = setInterval(fetchNotifs, NOTIF_POLL_MS)
    return () => clearInterval(t)
  }, [fetchNotifs])

  // Play a buzzer when the unseen-order count grows (covers the case where
  // a new order arrives while the admin is *not* on the Orders tab).
  useEffect(() => {
    const prev = prevCountRef.current
    const curr = notifItems.length
    if (curr > prev) {
      playBuzzer()
    }
    prevCountRef.current = curr
  }, [notifItems.length, playBuzzer])

  const handleNotifOpen = useCallback(() => {
    const now = Date.now()
    localStorage.setItem(LAST_SEEN_KEY, String(now))
    setLastSeen(now)
    setNotifItems([])
  }, [])

  // When the admin sits on the Orders page, mark notifications as seen
  // after a brief 3s delay so the red pill is actually visible on arrival
  // (instead of clearing instantly on click).
  useEffect(() => {
    if (location.pathname.startsWith('/admin/orders') && notifItems.length > 0) {
      const t = setTimeout(handleNotifOpen, 3000)
      return () => clearTimeout(t)
    }
  }, [location.pathname, notifItems.length, handleNotifOpen])

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
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={playBuzzer}
            title="Test notification sound"
            aria-label="Test notification sound"
          >
            <i className="bi bi-volume-up" />
          </button>
          <span className="badge bg-primary">Admin</span>
        </div>
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
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-none d-lg-inline-flex"
              onClick={playBuzzer}
              title="Test notification sound"
              aria-label="Test notification sound"
            >
              <i className="bi bi-volume-up" />
            </button>
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
        </div>

        <nav className="p-2 flex-grow-1">
          <NavLink to="/admin/analytics" className={navClass} onClick={closeDrawer}>
            <i className="bi bi-bar-chart-line" /> Analytics
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={navClass}
            onClick={closeDrawer}
            style={{ position: 'relative' }}
          >
            <i className="bi bi-receipt-cutoff" />
            <span>Orders</span>
            {notifItems.length > 0 && (
              <span
                className="badge rounded-pill bg-danger ms-auto"
                style={{ fontSize: '0.7rem', minWidth: 22 }}
                aria-label={`${notifItems.length} new orders`}
              >
                {notifItems.length > 99 ? '99+' : notifItems.length}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/products" className={navClass} onClick={closeDrawer}>
            <i className="bi bi-box-seam" /> Products
          </NavLink>
          <NavLink to="/admin/users" className={navClass} onClick={closeDrawer}>
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
          <Route path="orders"        element={<AdminOrders />} />
          <Route path="products"      element={<AdminProducts />} />
          <Route path="users"         element={<AdminUsers />} />
        </Routes>
      </main>
    </div>
  )
}

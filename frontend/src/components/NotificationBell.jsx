// src/components/NotificationBell.jsx
// Shared bell-icon dropdown for admin and cashier topbars.
// Parent owns the data + last-seen state; this component is presentation only.

import React, { useEffect, useRef, useState } from 'react'

export default function NotificationBell({
  count = 0,
  items = [],            // [{ id, title, subtitle }]
  onOpen,                // called when user opens the dropdown (mark seen)
  onItemClick,           // optional: (item) => void
  emptyText = 'No new notifications',
  title = 'Notifications',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && onOpen) onOpen()
  }

  return (
    <div className="position-relative" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary position-relative"
        aria-label="Notifications"
        onClick={toggle}
      >
        <i className={`bi ${count > 0 ? 'bi-bell-fill' : 'bi-bell'}`} />
        {count > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.65rem' }}
          >
            {count > 99 ? '99+' : count}
            <span className="visually-hidden">unread notifications</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className="card shadow border-0 position-absolute end-0 mt-2"
          style={{ width: 300, maxHeight: 380, overflow: 'hidden', zIndex: 1060 }}
        >
          <div className="card-header bg-white fw-bold py-2 px-3 small d-flex align-items-center justify-content-between">
            <span>
              <i className="bi bi-bell me-1 text-primary" />
              {title}
            </span>
            {items.length > 0 && (
              <span className="badge bg-secondary bg-opacity-25 text-dark">
                {items.length}
              </span>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 320 }}>
            {items.length === 0 ? (
              <div className="text-center text-muted small py-4 px-3">
                <i className="bi bi-inbox d-block fs-4 mb-1" />
                {emptyText}
              </div>
            ) : (
              <ul className="list-group list-group-flush">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className={
                      'list-group-item small ' +
                      (onItemClick ? 'list-group-item-action' : '')
                    }
                    style={onItemClick ? { cursor: 'pointer' } : {}}
                    onClick={() => {
                      if (onItemClick) onItemClick(it)
                      setOpen(false)
                    }}
                  >
                    <div className="fw-semibold">{it.title}</div>
                    {it.subtitle && (
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        {it.subtitle}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

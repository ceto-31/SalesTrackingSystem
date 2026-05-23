// Shared customer name display — avatar initial + hero name (admin + cashier).

import React from 'react'

export default function CustomerName({ name, className = '' }) {
  const display = (name || '').trim() || 'Walk-in'
  const initial = display.charAt(0).toUpperCase()

  return (
    <div className={`order-customer-row ${className}`.trim()}>
      <div className="order-customer-avatar" aria-hidden="true">
        {initial}
      </div>
      <div className="order-customer-name">{display}</div>
    </div>
  )
}

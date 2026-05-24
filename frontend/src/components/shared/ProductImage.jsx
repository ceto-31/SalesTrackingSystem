// Uniform product image — scale/center within a fixed aspect box.

import React from 'react'

/**
 * @param {object} props
 * @param {string|null|undefined} props.src   — full URL path e.g. /uploads/products/lomi.jpg
 * @param {string} props.alt
 * @param {string} [props.className]          — extra classes on the outer box
 * @param {'square'|'wide'} [props.aspect]    — square (1:1) or wide (4:3)
 * @param {boolean} [props.rounded]
 */
export default function ProductImage({
  src,
  alt,
  className = '',
  aspect = 'square',
  rounded = true,
}) {
  const ratioClass = aspect === 'wide' ? 'ratio-4x3' : 'ratio ratio-1x1'
  const roundClass = rounded ? 'product-image-box--rounded' : ''

  if (!src) {
    return (
      <div className={`${ratioClass} product-image-box product-image-box--empty ${roundClass} ${className}`.trim()}>
        <div className="product-image-placeholder">
          <i className="bi bi-image text-muted" aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${ratioClass} product-image-box ${roundClass} ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className="product-image-fit"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

/** Build image URL from DB path like uploads/products/lomi.jpg */
export function productImageUrl(imagePath) {
  if (!imagePath) return null
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`
}

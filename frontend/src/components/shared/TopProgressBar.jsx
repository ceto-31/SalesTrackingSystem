// Global top-of-page loading bar — driven by in-flight API request count in api.js.

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getRequestCountSnapshot, subscribeRequestCount } from '../../services/api'

const SHOW_DELAY_MS = 150
const BAR_COLOR = '#d6336c'
const Z_INDEX = 1100

function clearTimer(ref, key) {
  if (ref.current[key]) {
    clearTimeout(ref.current[key])
    ref.current[key] = null
  }
}

export default function TopProgressBar() {
  const inFlight = useSyncExternalStore(
    subscribeRequestCount,
    getRequestCountSnapshot,
    getRequestCountSnapshot,
  )

  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState('0%')
  const [opacity, setOpacity] = useState(0)

  const timersRef = useRef({ show: null, complete: null, fade: null })
  const shownRef = useRef(false)

  useEffect(() => {
    if (inFlight > 0) {
      clearTimer(timersRef, 'complete')
      clearTimer(timersRef, 'fade')

      if (!shownRef.current) {
        clearTimer(timersRef, 'show')
        timersRef.current.show = setTimeout(() => {
          timersRef.current.show = null
          if (getRequestCountSnapshot() <= 0) return
          shownRef.current = true
          setVisible(true)
          setOpacity(1)
          setWidth('8%')
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setWidth('90%'))
          })
        }, SHOW_DELAY_MS)
      } else {
        setVisible(true)
        setOpacity(1)
        setWidth('90%')
      }
    } else {
      clearTimer(timersRef, 'show')

      if (shownRef.current) {
        setWidth('100%')
        timersRef.current.complete = setTimeout(() => {
          timersRef.current.complete = null
          setOpacity(0)
          timersRef.current.fade = setTimeout(() => {
            timersRef.current.fade = null
            shownRef.current = false
            setVisible(false)
            setWidth('0%')
          }, 200)
        }, 150)
      }
    }

    return () => {
      clearTimer(timersRef, 'show')
      clearTimer(timersRef, 'complete')
      clearTimer(timersRef, 'fade')
    }
  }, [inFlight])

  if (!visible && opacity === 0) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: Z_INDEX,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        style={{
          height: '100%',
          width,
          backgroundColor: BAR_COLOR,
          transition: 'width 400ms ease',
          boxShadow: `0 0 6px rgba(214, 51, 108, 0.45)`,
        }}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'

// A primary pointer that's a mouse or trackpad: a computer's, even one with a touch screen.
const FINE_POINTER = '(pointer: fine)'
// A primary pointer that's a finger.
const COARSE_POINTER = '(pointer: coarse)'

// A phone's or tablet's browser: no mouse or trackpad as the primary pointer, and a touch screen
// (touch points, or a finger as the primary pointer). Whatever the window's width (Jay, 2026-11-07): a
// computer in a thin window is still a computer, with its keyboard, and two players at it sit side by
// side. Until then a window under 700 wide counted as a phone's whatever the device. A desktop browser
// always has a fine pointer; a coarse one stands in for touch points where they're missing (a phone
// emulator reporting 0, like the Claude desktop app's browser pane), and touch points stand in for a
// touch device whose pointer is neither coarse nor fine.
function computeIsTouchPrimary(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const touchPoints = navigator.maxTouchPoints > 0
  if (!window.matchMedia) return touchPoints
  if (window.matchMedia(FINE_POINTER).matches) return false
  return touchPoints || window.matchMedia(COARSE_POINTER).matches
}

// Best-effort proxy for "no physical keyboard, this player is on touch" - there's no public web API
// that reports keyboard presence directly, so this leans on a touch screen without a fine primary
// pointer as the closest available signal. A tablet with a trackpad attached reads as a computer,
// which has its keyboard too. Whatever touch/pointer input path you already offer remains available
// regardless, so a wrong guess is a missed capability hint, not a broken control scheme.
// Live-updated via matchMedia, so attaching or detaching a mouse or trackpad re-evaluates.
export function useIsTouchPrimaryDevice(): boolean {
  const [isTouchPrimary, setIsTouchPrimary] = useState(computeIsTouchPrimary)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const update = () => setIsTouchPrimary(computeIsTouchPrimary())
    const mql = window.matchMedia(FINE_POINTER)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isTouchPrimary
}

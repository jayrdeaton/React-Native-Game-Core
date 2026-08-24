import { act, renderHook } from '@testing-library/react'

import { useIsTouchPrimaryDevice } from '../useIsTouchPrimaryDevice.web'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
}

function setTouchPoints(maxTouchPoints: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, configurable: true, value: maxTouchPoints })
}

function mockMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = []
  const mql = {
    matches,
    addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
    removeEventListener: jest.fn()
  }
  window.matchMedia = jest.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return { mql, fire: () => listeners.forEach((l) => l()) }
}

describe('useIsTouchPrimaryDevice (web)', () => {
  const originalInnerWidth = window.innerWidth
  const originalMaxTouchPoints = navigator.maxTouchPoints
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    setViewport(originalInnerWidth)
    setTouchPoints(originalMaxTouchPoints)
    window.matchMedia = originalMatchMedia
  })

  it('reports touch-primary on a wide desktop-shaped window with a coarse pointer and touch points', () => {
    setViewport(1400)
    setTouchPoints(5)
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(result.current).toBe(true)
  })

  it('reports NOT touch-primary on a wide desktop-shaped window with a fine (mouse) pointer', () => {
    setViewport(1400)
    setTouchPoints(0)
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(result.current).toBe(false)
  })

  it('treats a narrow window as touch-primary regardless of what the pointer APIs report', () => {
    setViewport(400)
    setTouchPoints(0)
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(result.current).toBe(true)
  })

  it('re-evaluates on a matchMedia change event', () => {
    setViewport(1400)
    setTouchPoints(5)
    const { fire, mql } = mockMatchMedia(false)
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(result.current).toBe(false)

    mql.matches = true
    act(() => fire())
    expect(result.current).toBe(true)
  })
})

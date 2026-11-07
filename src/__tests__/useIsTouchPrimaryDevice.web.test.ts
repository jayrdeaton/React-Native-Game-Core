import { act, renderHook } from '@testing-library/react'

import { useIsTouchPrimaryDevice } from '../useIsTouchPrimaryDevice.web'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
}

function setTouchPoints(maxTouchPoints: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, configurable: true, value: maxTouchPoints })
}

// The primary pointer: a mouse or trackpad ('fine'), a finger ('coarse'), or neither.
function mockPointer(pointer: 'fine' | 'coarse' | 'none') {
  const listeners: Array<() => void> = []
  const state = { pointer }
  const mql = (query: string) => ({
    get matches() {
      return query === `(pointer: ${state.pointer})`
    },
    addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
    removeEventListener: jest.fn()
  })
  window.matchMedia = jest.fn(mql) as unknown as typeof window.matchMedia
  return { state, fire: () => listeners.forEach((l) => l()) }
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

  it('reports touch-primary on a touch screen with a finger for a pointer, wide or narrow (a tablet, a phone)', () => {
    setViewport(1400)
    setTouchPoints(5)
    mockPointer('coarse')
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(true)

    setViewport(390)
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(true)
  })

  it('reports NOT touch-primary at a computer, however thin its window', () => {
    setTouchPoints(0)
    mockPointer('fine')
    setViewport(1400)
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(false)

    setViewport(380)
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(false)
  })

  it('reports NOT touch-primary on a touch-screen computer whose primary pointer is a mouse or trackpad', () => {
    setViewport(1400)
    setTouchPoints(10)
    mockPointer('fine')
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(false)
  })

  it('reports touch-primary for a coarse pointer with no touch points (a phone emulator), or touch points with neither pointer', () => {
    setViewport(375)
    setTouchPoints(0)
    mockPointer('coarse')
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(true)

    setTouchPoints(5)
    mockPointer('none')
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(true)

    setTouchPoints(0)
    expect(renderHook(() => useIsTouchPrimaryDevice()).result.current).toBe(false)
  })

  it('re-evaluates when the fine pointer comes or goes (a trackpad attached to a tablet)', () => {
    setViewport(1400)
    setTouchPoints(5)
    const { fire, state } = mockPointer('coarse')
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(window.matchMedia).toHaveBeenCalledWith('(pointer: fine)')
    expect(result.current).toBe(true)

    state.pointer = 'fine'
    act(() => fire())
    expect(result.current).toBe(false)
  })
})

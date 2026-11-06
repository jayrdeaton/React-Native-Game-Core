import { renderHook } from '@testing-library/react'
import { Dimensions, Platform, useWindowDimensions } from 'react-native'

import { getOrientationSnapshot, useOrientationState } from '../useOrientationState'

const PORTRAIT = { width: 402, height: 874, scale: 3, fontScale: 1 }
const LANDSCAPE = { width: 874, height: 402, scale: 3, fontScale: 1 }

function setWindow(size: typeof PORTRAIT) {
  ;(useWindowDimensions as jest.Mock).mockReturnValue(size)
  ;(Dimensions.get as jest.Mock).mockReturnValue(size)
}

describe('useOrientationState', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    setWindow(PORTRAIT)
    Platform.OS = originalOS
  })

  it.each(['ios', 'android', 'web'] as const)('reads faceToFace from a taller-than-wide window on %s, resolved from the first render', (os) => {
    Platform.OS = os as typeof Platform.OS
    const { result } = renderHook(() => useOrientationState())
    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true })
  })

  it.each(['ios', 'android', 'web'] as const)('reads sideBySide from a wider-than-tall window on %s, player 1 on the left', (os) => {
    Platform.OS = os as typeof Platform.OS
    setWindow(LANDSCAPE)
    const { result } = renderHook(() => useOrientationState())
    expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true })
  })

  it('reads a square window as faceToFace', () => {
    setWindow({ width: 600, height: 600, scale: 2, fontScale: 1 })
    const { result } = renderHook(() => useOrientationState())
    expect(result.current.orientationMode).toBe('faceToFace')
  })

  it('follows the window when it changes shape, keeping the same object while the mode is unchanged', () => {
    const { result, rerender } = renderHook(() => useOrientationState())
    const portrait = result.current
    setWindow({ width: 500, height: 900, scale: 2, fontScale: 1 })
    rerender()
    expect(result.current).toBe(portrait)
    setWindow(LANDSCAPE)
    rerender()
    expect(result.current.orientationMode).toBe('sideBySide')
  })

  it('freezes a locked call site at the value it had when locked turned true, while an unlocked one keeps following', () => {
    const { result, rerender } = renderHook(({ locked }) => ({ locked: useOrientationState(locked), live: useOrientationState() }), { initialProps: { locked: false } })
    rerender({ locked: true })
    setWindow(LANDSCAPE)
    rerender({ locked: true })
    expect(result.current.locked.orientationMode).toBe('faceToFace')
    expect(result.current.live.orientationMode).toBe('sideBySide')
    rerender({ locked: false })
    expect(result.current.locked.orientationMode).toBe('sideBySide')
  })
})

describe('getOrientationSnapshot', () => {
  afterEach(() => {
    setWindow(PORTRAIT)
  })

  it('reads the current window without a subscription', () => {
    expect(getOrientationSnapshot().orientationMode).toBe('faceToFace')
    setWindow(LANDSCAPE)
    expect(getOrientationSnapshot()).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true })
  })
})

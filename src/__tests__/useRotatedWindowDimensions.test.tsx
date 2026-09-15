import { act, renderHook } from '@testing-library/react'
import { ReactNode } from 'react'

import { DeviceMotionMeasurement, DeviceMotionModule, OrientationStateProvider } from '../useOrientationState'
import { useRotatedWindowDimensions } from '../useRotatedWindowDimensions'

// Same local test double as useRotation.test.tsx/useOrientationState.test.tsx. The mocked
// useWindowDimensions() (src/__mocks__/react-native.ts) always returns a fixed 402x874 — this suite
// only needs to confirm rotation correctly swaps that fixed pair, not that the underlying window
// size itself is read correctly (already covered elsewhere).
function createFakeDeviceMotion(): { module: DeviceMotionModule; emit: (gravity: { x: number; y: number } | null) => void } {
  let listener: ((measurement: DeviceMotionMeasurement) => void) | null = null
  const module: DeviceMotionModule = {
    addListener: jest.fn((cb: (measurement: DeviceMotionMeasurement) => void) => {
      listener = cb
      return { remove: jest.fn() }
    }),
    setUpdateInterval: jest.fn()
  }
  return {
    module,
    emit: (gravity) => {
      act(() => {
        listener?.({ accelerationIncludingGravity: gravity })
      })
    }
  }
}

describe('useRotatedWindowDimensions', () => {
  let fakeDeviceMotion = createFakeDeviceMotion()

  function wrapper({ children }: { children?: ReactNode }) {
    return <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>{children}</OrientationStateProvider>
  }

  beforeEach(() => {
    jest.useFakeTimers()
    fakeDeviceMotion = createFakeDeviceMotion()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function commit(gravity: { x: number; y: number }) {
    fakeDeviceMotion.emit(gravity)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit(gravity)
  }

  it('reports the raw window size unchanged at the default unresolved (0°) state', () => {
    const { result } = renderHook(() => useRotatedWindowDimensions(), { wrapper })
    expect(result.current).toEqual({ width: 402, height: 874 })
  })

  it('swaps width and height once a sideBySide (±90°) reading commits', () => {
    const { result } = renderHook(() => useRotatedWindowDimensions(), { wrapper })

    commit({ x: 8, y: 0 })

    expect(result.current).toEqual({ width: 874, height: 402 })
  })

  it('leaves width/height unswapped once an upside-down (180°) reading commits', () => {
    const { result } = renderHook(() => useRotatedWindowDimensions(), { wrapper })

    commit({ x: 0, y: 8 })

    expect(result.current).toEqual({ width: 402, height: 874 })
  })

  it('passes locked through to the underlying rotation, freezing the swap', () => {
    const { result, rerender } = renderHook((locked: boolean) => useRotatedWindowDimensions(locked), { wrapper, initialProps: false })

    commit({ x: 8, y: 0 })
    expect(result.current).toEqual({ width: 874, height: 402 })

    rerender(true)
    commit({ x: 0, y: 8 }) // would otherwise flip to unswapped 180°, but locked is now true

    expect(result.current).toEqual({ width: 874, height: 402 })
  })
})

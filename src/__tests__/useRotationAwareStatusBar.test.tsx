import { act, renderHook } from '@testing-library/react'
import { ReactNode } from 'react'

import { DeviceMotionMeasurement, DeviceMotionModule, OrientationStateProvider } from '../useOrientationState'
import { RotationAwareStatusBarOptions, useRotationAwareStatusBar } from '../useRotationAwareStatusBar'

// Same local test double as useRotation.test.tsx/FakeLandscapeView.test.tsx - production code never
// imports expo-sensors directly, so there's nothing to moduleNameMapper-mock here.
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

describe('useRotationAwareStatusBar', () => {
  let fakeDeviceMotion = createFakeDeviceMotion()

  function wrapper({ children }: { children?: ReactNode }) {
    return <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>{children}</OrientationStateProvider>
  }

  function renderOptions(initialProps: RotationAwareStatusBarOptions = {}) {
    return renderHook((options: RotationAwareStatusBarOptions) => useRotationAwareStatusBar(options), { initialProps, wrapper })
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

  it('shows the status bar for the default unresolved faceToFace/right-side-up reading, same as getViewRotation(...) === 0', () => {
    const { result } = renderOptions()
    expect(result.current).toEqual({ statusBarHidden: false })
  })

  it('hides the status bar once a committed upside-down reading rotates content to 180°', () => {
    const { result } = renderOptions()
    commit({ x: 0, y: 8 })
    expect(result.current.statusBarHidden).toBe(true)
  })

  it('hides the status bar once a committed sideBySide reading rotates content to ±90°', () => {
    const { result } = renderOptions()
    commit({ x: 8, y: 0 })
    expect(result.current.statusBarHidden).toBe(true)
  })

  it('shows it again when the reading returns to portrait', () => {
    const { result } = renderOptions()
    commit({ x: -8, y: 0 })
    expect(result.current.statusBarHidden).toBe(true)
    commit({ x: 0, y: -8 })
    expect(result.current.statusBarHidden).toBe(false)
  })

  it('freezes at whatever rotation was current when locked became true, ignoring a later tilt, matching useRotation own locked contract', () => {
    const { result, rerender } = renderOptions({ locked: false })

    commit({ x: 0, y: 8 }) // commits upsideDown:true -> 180° -> hidden
    expect(result.current.statusBarHidden).toBe(true)

    rerender({ locked: true })

    commit({ x: 0, y: -8 }) // would otherwise commit faceToFace/right-side-up -> 0° -> shown, but locked is now true

    expect(result.current.statusBarHidden).toBe(true)
  })

  it('passes style and animation through as the stack option names', () => {
    const { result } = renderOptions({ style: 'light', animation: 'slide' })
    expect(result.current).toEqual({ statusBarHidden: false, statusBarStyle: 'light', statusBarAnimation: 'slide' })
  })

  it('leaves out the keys it was not given, so spreading it never overrides an option with undefined', () => {
    const { result } = renderOptions()
    expect(Object.keys(result.current)).toEqual(['statusBarHidden'])
    expect({ statusBarStyle: 'dark', ...result.current }).toEqual({ statusBarStyle: 'dark', statusBarHidden: false })
  })

  it('keeps statusBarHidden = rotation !== 0 while passing style through', () => {
    const { result } = renderOptions({ style: 'dark' })
    commit({ x: 8, y: 0 })
    expect(result.current).toEqual({ statusBarHidden: true, statusBarStyle: 'dark' })
  })
})

import { act, renderHook } from '@testing-library/react'
import { ReactNode } from 'react'

import { DeviceMotionMeasurement, DeviceMotionModule, OrientationStateProvider } from '../useOrientationState'
import { useRotation } from '../useRotation'

// Same local test double as useOrientationState.test.tsx — production code never imports
// expo-sensors directly, so there's nothing to moduleNameMapper-mock here.
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

describe('useRotation', () => {
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

  it('collapses the default unresolved faceToFace/right-side-up state to 0°, same as calling getViewRotation directly', () => {
    const { result } = renderHook(() => useRotation(), { wrapper })
    expect(result.current).toBe(0)
  })

  it('tracks a committed upside-down reading through to 180°', () => {
    const { result } = renderHook(() => useRotation(), { wrapper })

    fakeDeviceMotion.emit({ x: 0, y: 8 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 0, y: 8 })

    expect(result.current).toBe(180)
  })

  it('tracks a committed sideBySide reading through to ±90° depending on p1OnRight', () => {
    const { result } = renderHook(() => useRotation(), { wrapper })

    fakeDeviceMotion.emit({ x: 8, y: 0 }) // p1OnRight === true per candidateFromGravity
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 })

    expect(result.current).toBe(-90)
  })
})

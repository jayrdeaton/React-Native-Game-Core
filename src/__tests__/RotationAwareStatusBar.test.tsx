import { act, render } from '@testing-library/react'
import { StatusBar } from 'expo-status-bar'
import { ReactNode } from 'react'

import { RotationAwareStatusBar } from '../RotationAwareStatusBar'
import { DeviceMotionMeasurement, DeviceMotionModule, OrientationStateProvider } from '../useOrientationState'

// Same local test double as useRotation.test.tsx/FakeLandscapeView.test.tsx — production code never
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

function lastHidden(): boolean {
  const calls = (StatusBar as unknown as jest.Mock).mock.calls
  return calls[calls.length - 1][0].hidden
}

describe('RotationAwareStatusBar', () => {
  let fakeDeviceMotion = createFakeDeviceMotion()

  function wrapper({ children }: { children?: ReactNode }) {
    return <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>{children}</OrientationStateProvider>
  }

  beforeEach(() => {
    jest.useFakeTimers()
    fakeDeviceMotion = createFakeDeviceMotion()
    ;(StatusBar as unknown as jest.Mock).mockClear()
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

  it('renders StatusBar with hidden=false for the default unresolved faceToFace/right-side-up reading, same as getViewRotation(...) === 0', () => {
    render(<RotationAwareStatusBar />, { wrapper })
    expect(lastHidden()).toBe(false)
  })

  it('hides the status bar once a committed upside-down reading rotates content to 180°', () => {
    render(<RotationAwareStatusBar />, { wrapper })

    commit({ x: 0, y: 8 })

    expect(lastHidden()).toBe(true)
  })

  it('hides the status bar once a committed sideBySide reading rotates content to ±90°', () => {
    render(<RotationAwareStatusBar />, { wrapper })

    commit({ x: 8, y: 0 })

    expect(lastHidden()).toBe(true)
  })

  it('freezes at whatever rotation was current when locked became true, ignoring a later tilt, matching useOrientationState/useRotation own locked contract', () => {
    const { rerender } = render(<RotationAwareStatusBar locked={false} />, { wrapper })

    commit({ x: 0, y: 8 }) // commits upsideDown:true -> 180° -> hidden
    expect(lastHidden()).toBe(true)

    rerender(<RotationAwareStatusBar locked={true} />)

    commit({ x: 0, y: -8 }) // would otherwise commit faceToFace/right-side-up -> 0° -> shown, but locked is now true

    expect(lastHidden()).toBe(true)
  })
})

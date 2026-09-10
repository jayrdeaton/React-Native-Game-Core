import { act, render, renderHook } from '@testing-library/react'
import { ReactNode } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { DeviceMotionMeasurement, DeviceMotionModule, OrientationState, OrientationStateProvider, useOrientationState } from '../useOrientationState'

// A local, hand-built test double for the injected deviceMotion module — production code never
// imports expo-sensors at all anymore (see useOrientationState.tsx's own DeviceMotionModule doc),
// so there's nothing to moduleNameMapper-mock here; this just satisfies the same small interface
// directly. Recreated fresh per test (see beforeEach) so each one gets its own clean listener slot,
// matching the old module-mock's own per-test mockClear() behavior.
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

let fakeDeviceMotion = createFakeDeviceMotion()

// Every test needs the Provider mounted with a deviceMotion module injected — useOrientationState
// reads from Context and silently never updates without one (see that hook's own doc).
function wrapper({ children }: { children?: ReactNode }) {
  return <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>{children}</OrientationStateProvider>
}

function Consumer({ onValue }: { onValue: (value: OrientationState) => void }) {
  onValue(useOrientationState())
  return null
}

describe('useOrientationState', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    fakeDeviceMotion = createFakeDeviceMotion()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts unresolved with the same pre-resolution guess as the old useP1OnRight', () => {
    const { result } = renderHook(() => useOrientationState(), { wrapper })
    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false })
  })

  it('only commits a candidate once it has held steady past the debounce window', () => {
    const { result } = renderHook(() => useOrientationState(), { wrapper })

    fakeDeviceMotion.emit({ x: 8, y: 0 }) // sideBySide candidate
    expect(result.current.resolved).toBe(false)

    act(() => {
      jest.advanceTimersByTime(100)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 }) // same candidate, but window hasn't elapsed yet
    expect(result.current.resolved).toBe(false)

    act(() => {
      jest.advanceTimersByTime(200)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 }) // window has now elapsed on a subsequent sample of the same candidate
    expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('never commits a brief spike that reverts before the window elapses (the swipe-safety case)', () => {
    const { result } = renderHook(() => useOrientationState(), { wrapper })

    fakeDeviceMotion.emit({ x: 8, y: 0 }) // a jolt toward sideBySide
    act(() => {
      jest.advanceTimersByTime(50)
    })
    fakeDeviceMotion.emit({ x: 0, y: -8 }) // reverts to faceToFace well before the spike's own window elapsed
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 0, y: -8 })

    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('holds the last committed value on an ambiguous reading, e.g. the phone lying flat', () => {
    const { result } = renderHook(() => useOrientationState(), { wrapper })

    fakeDeviceMotion.emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 })
    expect(result.current.orientationMode).toBe('sideBySide')

    fakeDeviceMotion.emit({ x: 0.01, y: 0.01 }) // flat on a table — magnitude below MIN_GRAVITY_MAGNITUDE
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 0.01, y: 0.01 })

    expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('detects upside-down portrait as a distinct case from right-side-up', () => {
    const { result } = renderHook(() => useOrientationState(), { wrapper })

    fakeDeviceMotion.emit({ x: 0, y: 8 }) // y dominant, positive — upside-down per candidateFromGravity
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 0, y: 8 })

    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: true, resolved: true })
  })

  it('freezes orientationMode/p1OnRight/upsideDown for a locked call site while an unlocked sibling keeps following', () => {
    // Two sibling consumers under the SAME Provider — renderHook's own `wrapper` option mounts a
    // fresh Provider (and fresh DeviceMotion subscription) per call, so two separate renderHook
    // calls would each get their own isolated Provider instead of actually sharing state.
    let lockedValue: OrientationState | undefined
    let liveValue: OrientationState | undefined
    let isLocked = true

    function LockedConsumer() {
      lockedValue = useOrientationState(isLocked)
      return null
    }
    function LiveConsumer() {
      liveValue = useOrientationState()
      return null
    }

    const { rerender } = render(
      <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>
        <LockedConsumer />
        <LiveConsumer />
      </OrientationStateProvider>
    )

    fakeDeviceMotion.emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 })
    expect(lockedValue).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false })
    expect(liveValue?.orientationMode).toBe('sideBySide')

    isLocked = false
    rerender(
      <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>
        <LockedConsumer />
        <LiveConsumer />
      </OrientationStateProvider>
    )
    expect(lockedValue?.orientationMode).toBe('sideBySide')
  })

  it('survives the consuming screen unmounting and remounting, as long as the Provider itself (mounted once, at the app root) stays up', () => {
    let latest: OrientationState | undefined
    const { rerender } = render(
      <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>
        <Consumer onValue={(value) => (latest = value)} />
      </OrientationStateProvider>
    )

    fakeDeviceMotion.emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fakeDeviceMotion.emit({ x: 8, y: 0 })
    expect(latest?.orientationMode).toBe('sideBySide')

    // Simulates navigating away — the screen consuming the hook unmounts, but the Provider (a
    // sibling of the router, mounted once at the app root) is untouched by this rerender, since
    // it's the same element in the same tree position.
    rerender(<OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>{null}</OrientationStateProvider>)
    // Simulates navigating to a new screen, which mounts a fresh consumer.
    rerender(
      <OrientationStateProvider deviceMotion={fakeDeviceMotion.module}>
        <Consumer onValue={(value) => (latest = value)} />
      </OrientationStateProvider>
    )

    expect(latest?.orientationMode).toBe('sideBySide')
  })

  it('never resolves past its unresolved default when the Provider is mounted with no deviceMotion module injected, and warns once in dev', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // Provider mounted (unlike the "no Provider at all" case, already covered by the rest of this
    // file's OrientationStateContext default) but without deviceMotion — the one case that should
    // actually reach useOrientationStateSource's own warning, since that only runs from inside it.
    const { result } = renderHook(() => useOrientationState(), { wrapper: OrientationStateProvider })
    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no `deviceMotion` module was injected'))
    warnSpy.mockRestore()
  })

  // Same Platform.OS mutation convention as rotation.test.ts's own 'on web' block — mutate the
  // mocked module's property directly (not a fresh jest.mock, since every other test in this file
  // needs the native 'ios' default) and restore it afterward so this doesn't leak into them.
  describe('on web', () => {
    const originalOS = Platform.OS

    afterEach(() => {
      Platform.OS = originalOS
    })

    it('resolves sideBySide with p1OnRight false — left, not whatever the native accelerometer path defaults true to', () => {
      Platform.OS = 'web'
      ;(useWindowDimensions as jest.Mock).mockReturnValueOnce({ width: 900, height: 400, scale: 1, fontScale: 1 })
      const { result } = renderHook(() => useOrientationState(), { wrapper })
      expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true })
    })

    it('resolves faceToFace for a taller-than-wide window, same as the mock default', () => {
      Platform.OS = 'web'
      const { result } = renderHook(() => useOrientationState(), { wrapper })
      expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true })
    })
  })
})

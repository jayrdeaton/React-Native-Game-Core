import { act, render } from '@testing-library/react'
import { ReactNode } from 'react'

import { OrientationProvider } from '../OrientationProvider'
import { useOrientationLock } from '../useOrientationLock'
import { DeviceMotionMeasurement, DeviceMotionModule, OrientationState, useOrientationState } from '../useOrientationState'

function createFakeDeviceMotion(): { module: DeviceMotionModule; emit: (gravity: { x: number; y: number }) => void } {
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

const PORTRAIT_UPSIDE_DOWN = { x: 0, y: 8 }
const LANDSCAPE = { x: 8, y: 0 }
const PORTRAIT = { x: 0, y: -8 }

describe('OrientationProvider freezeWhileLocked', () => {
  let motion = createFakeDeviceMotion()
  let latest: OrientationState
  let setLocked: (locked: boolean) => void

  function Reader() {
    latest = useOrientationState()
    return null
  }
  function LockHandle() {
    setLocked = useOrientationLock().setLocked
    return null
  }

  function commit(gravity: { x: number; y: number }) {
    motion.emit(gravity)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(gravity)
  }

  function tree(freezeWhileLocked: boolean, extra?: ReactNode) {
    return (
      <OrientationProvider deviceMotion={motion.module} freezeWhileLocked={freezeWhileLocked}>
        <LockHandle />
        <Reader />
        {extra}
      </OrientationProvider>
    )
  }

  beforeEach(() => {
    jest.useFakeTimers()
    motion = createFakeDeviceMotion()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('freezes the shared reading while locked', () => {
    render(tree(true))
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(latest.upsideDown).toBe(true)

    act(() => setLocked(true))
    commit(LANDSCAPE)
    expect(latest).toMatchObject({ orientationMode: 'faceToFace', upsideDown: true })
  })

  it('a consumer mounting while locked sees the locked reading, not the live one', () => {
    let lateReading: OrientationState | undefined
    function Late() {
      lateReading = useOrientationState()
      return null
    }
    const { rerender } = render(tree(true))
    commit(PORTRAIT_UPSIDE_DOWN)
    act(() => setLocked(true))
    commit(LANDSCAPE)

    rerender(tree(true, <Late />))
    expect(lateReading).toMatchObject({ orientationMode: 'faceToFace', upsideDown: true })
  })

  it('resumes after the normal hold-steady debounce once unlocked', () => {
    render(tree(true))
    commit(PORTRAIT_UPSIDE_DOWN)
    act(() => setLocked(true))
    commit(LANDSCAPE)

    act(() => setLocked(false))
    // A tilt held through the lock does not commit the instant of unlock...
    motion.emit(LANDSCAPE)
    expect(latest.orientationMode).toBe('faceToFace')
    // ...only after it holds steady past the debounce.
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(LANDSCAPE)
    expect(latest.orientationMode).toBe('sideBySide')
  })

  it('latches the first confident reading when locked before anything resolved', () => {
    render(tree(true))
    act(() => setLocked(true))
    expect(latest.resolved).toBe(false)
    commit(PORTRAIT)
    expect(latest.resolved).toBe(true)
    commit(LANDSCAPE)
    expect(latest.orientationMode).toBe('faceToFace')
  })

  it('is off by default: the shared reading keeps tracking while locked', () => {
    render(tree(false))
    commit(PORTRAIT_UPSIDE_DOWN)
    act(() => setLocked(true))
    commit(LANDSCAPE)
    expect(latest.orientationMode).toBe('sideBySide')
  })
})

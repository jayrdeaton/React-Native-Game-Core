import { act, render } from '@testing-library/react'

import { OrientationLockSettings } from '../OrientationLockContext'
import { OrientationProvider } from '../OrientationProvider'
import { ViewRotation } from '../rotation'
import { useOrientationLock } from '../useOrientationLock'
import { DeviceMotionMeasurement, DeviceMotionModule, getOrientationSnapshot, OrientationState, useOrientationState } from '../useOrientationState'

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

const PORTRAIT = { x: 0, y: -8 }
const PORTRAIT_UPSIDE_DOWN = { x: 0, y: 8 }
// p1OnRight true -> rotation -90.
const LANDSCAPE = { x: 8, y: 0 }

// A launch where the lock (and its angle) was restored from the app's own storage.
describe('OrientationProvider lock rotation (freezeWhileLocked)', () => {
  let motion = createFakeDeviceMotion()
  let seen: OrientationState[]
  let setLocked: (locked: boolean) => void
  let onLockChange: jest.Mock<void, [OrientationLockSettings]>

  function Reader() {
    seen.push(useOrientationState())
    return null
  }
  function LockHandle() {
    setLocked = useOrientationLock().setLocked
    return null
  }
  const latest = () => seen[seen.length - 1]
  const lastSaved = () => onLockChange.mock.calls[onLockChange.mock.calls.length - 1]?.[0]

  function commit(gravity: { x: number; y: number }) {
    motion.emit(gravity)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(gravity)
  }

  function tree({ lockInitialValue, freezeWhileLocked = true, allowedRotations }: { lockInitialValue?: Partial<OrientationLockSettings>; freezeWhileLocked?: boolean; allowedRotations?: readonly ViewRotation[] } = {}) {
    return (
      <OrientationProvider deviceMotion={motion.module} lockInitialValue={lockInitialValue} onLockChange={onLockChange} freezeWhileLocked={freezeWhileLocked} allowedRotations={allowedRotations}>
        <LockHandle />
        <Reader />
      </OrientationProvider>
    )
  }

  beforeEach(() => {
    jest.useFakeTimers()
    motion = createFakeDeviceMotion()
    seen = []
    onLockChange = jest.fn()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('locking records the frozen angle for the app to persist', () => {
    render(tree())
    commit(LANDSCAPE)
    act(() => setLocked(true))
    expect(lastSaved()).toEqual({ locked: true, rotation: -90 })
  })

  it('unlocking clears it, so the next lock records the then-current reading', () => {
    render(tree())
    commit(LANDSCAPE)
    act(() => setLocked(true))
    act(() => setLocked(false))
    expect(lastSaved()).toEqual({ locked: false, rotation: undefined })

    commit(PORTRAIT_UPSIDE_DOWN)
    act(() => setLocked(true))
    expect(lastSaved()).toEqual({ locked: true, rotation: 180 })
  })

  it('a restored lock opens in the locked orientation from the very first frame, not portrait', () => {
    render(tree({ lockInitialValue: { locked: true, rotation: -90 } }))
    expect(seen[0]).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: true })
    expect(getOrientationSnapshot()).toEqual(seen[0])
  })

  it('a restored lock stays put however the phone is held at launch', () => {
    render(tree({ lockInitialValue: { locked: true, rotation: 180 } }))
    commit(PORTRAIT)
    commit(LANDSCAPE)
    expect(latest()).toMatchObject({ orientationMode: 'faceToFace', upsideDown: true })
    // Restoring is not a change, so nothing is written back.
    expect(onLockChange).not.toHaveBeenCalled()
  })

  it('unlocking a restored lock resumes tracking through the normal debounce', () => {
    render(tree({ lockInitialValue: { locked: true, rotation: 180 } }))
    act(() => setLocked(false))
    motion.emit(LANDSCAPE)
    expect(latest()).toMatchObject({ orientationMode: 'faceToFace', upsideDown: true })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(LANDSCAPE)
    expect(latest().orientationMode).toBe('sideBySide')
  })

  it('adopts a lock that arrives after mount, e.g. once async settings finish loading', () => {
    const { rerender } = render(tree({ lockInitialValue: { locked: false } }))
    commit(PORTRAIT)
    rerender(tree({ lockInitialValue: { locked: true, rotation: 90 } }))
    expect(latest()).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true })
  })

  it('a lock saved before rotations were recorded latches the first confident reading and records it', () => {
    render(tree({ lockInitialValue: { locked: true } }))
    commit(PORTRAIT_UPSIDE_DOWN)
    commit(LANDSCAPE)
    expect(latest()).toMatchObject({ orientationMode: 'faceToFace', upsideDown: true })
    expect(lastSaved()).toEqual({ locked: true, rotation: 180 })
  })

  it('ignores a restored angle that is no longer allowed and records the allowed one it lands on', () => {
    render(tree({ lockInitialValue: { locked: true, rotation: 180 }, allowedRotations: [0, 90, -90] }))
    expect(seen[0]).toMatchObject({ orientationMode: 'faceToFace', upsideDown: false })
    commit(LANDSCAPE)
    expect(latest().orientationMode).toBe('sideBySide')
    expect(lastSaved()).toEqual({ locked: true, rotation: -90 })
  })

  it('records nothing without freezeWhileLocked', () => {
    render(tree({ freezeWhileLocked: false }))
    commit(LANDSCAPE)
    act(() => setLocked(true))
    expect(lastSaved()).toStrictEqual({ locked: true })
  })
})

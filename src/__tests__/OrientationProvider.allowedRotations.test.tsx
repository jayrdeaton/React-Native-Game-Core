import { act, render } from '@testing-library/react'
import { Platform, useWindowDimensions } from 'react-native'

import { OrientationProvider } from '../OrientationProvider'
import { ViewRotation } from '../rotation'
import { DeviceMotionMeasurement, DeviceMotionModule, getOrientationSnapshot, OrientationState, useOrientationState } from '../useOrientationState'
import { useRotation } from '../useRotation'

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
// p1OnRight true -> rotation -90 (phone turned clockwise).
const LANDSCAPE_CLOCKWISE = { x: 8, y: 0 }
// p1OnRight false -> rotation 90 (phone turned counter-clockwise).
const LANDSCAPE_COUNTER_CLOCKWISE = { x: -8, y: 0 }

describe('OrientationProvider allowedRotations', () => {
  let motion = createFakeDeviceMotion()
  let latest: OrientationState
  let rotation: ViewRotation

  function Reader() {
    latest = useOrientationState()
    rotation = useRotation()
    return null
  }

  function commit(gravity: { x: number; y: number }) {
    motion.emit(gravity)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(gravity)
  }

  function tree(allowedRotations?: readonly ViewRotation[]) {
    return (
      <OrientationProvider deviceMotion={motion.module} allowedRotations={allowedRotations}>
        <Reader />
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

  it('ignores a hold whose angle is not allowed, keeping the last allowed reading', () => {
    render(tree([0, 90, -90]))
    commit(PORTRAIT)
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(latest).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: true })
    expect(rotation).toBe(0)
  })

  it('still commits the allowed holds', () => {
    render(tree([0, 90, -90]))
    commit(LANDSCAPE_CLOCKWISE)
    expect(rotation).toBe(-90)
    commit(LANDSCAPE_COUNTER_CLOCKWISE)
    expect(rotation).toBe(90)
  })

  it('reads angles in useRotation terms: allowing only 90 drops the clockwise landscape', () => {
    render(tree([0, 90]))
    commit(LANDSCAPE_CLOCKWISE)
    expect(rotation).toBe(0)
    commit(LANDSCAPE_COUNTER_CLOCKWISE)
    expect(rotation).toBe(90)
  })

  it('a landscape-only app starts in landscape rather than the portrait default, snapshot included', () => {
    const seen: OrientationState[] = []
    function FirstFrame() {
      seen.push(useOrientationState())
      return null
    }
    render(
      <OrientationProvider deviceMotion={motion.module} allowedRotations={[90, -90]}>
        <FirstFrame />
      </OrientationProvider>
    )
    expect(seen[0]).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: false })
    expect(getOrientationSnapshot()).toEqual(seen[0])
    commit(PORTRAIT)
    expect(seen[seen.length - 1].orientationMode).toBe('sideBySide')
  })

  it('switching the current angle off at runtime moves the reading to an allowed one', () => {
    const { rerender } = render(tree())
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(rotation).toBe(180)
    rerender(tree([0, 90, -90]))
    expect(latest).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: true })
    expect(getOrientationSnapshot()).toEqual(latest)
  })

  it('switching an angle back on lets a phone already held that way commit after the normal debounce', () => {
    const { rerender } = render(tree([0, 90, -90]))
    commit(PORTRAIT)
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(rotation).toBe(0)
    rerender(tree([0, 90, -90, 180]))
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(rotation).toBe(180)
  })

  it('an inline array literal on every render does not resubscribe to the sensor', () => {
    const { rerender } = render(tree([0, 90, -90]))
    rerender(tree([0, 90, -90]))
    rerender(tree([0, 90, -90]))
    expect(motion.module.addListener).toHaveBeenCalledTimes(1)
  })

  it('an empty list means no restriction', () => {
    render(tree([]))
    commit(PORTRAIT_UPSIDE_DOWN)
    expect(rotation).toBe(180)
  })

  describe('on web', () => {
    const originalOS = Platform.OS

    afterEach(() => {
      Platform.OS = originalOS
    })

    it('is not applied - the reading still follows the window shape', () => {
      Platform.OS = 'web'
      ;(useWindowDimensions as jest.Mock).mockReturnValueOnce({ width: 900, height: 400, scale: 1, fontScale: 1 })
      render(tree([0, 180]))
      expect(latest.orientationMode).toBe('sideBySide')
    })
  })
})

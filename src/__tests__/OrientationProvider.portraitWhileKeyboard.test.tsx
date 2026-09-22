import { act, render } from '@testing-library/react'

import { emitKeyboard, keyboardListeners } from '../__mocks__/react-native'
import { OrientationProvider } from '../OrientationProvider'
import { DeviceMotionMeasurement, DeviceMotionModule, getOrientationSnapshot, OrientationState, useOrientationState } from '../useOrientationState'
import { useRotatedWindowDimensions } from '../useRotatedWindowDimensions'
import { useRotation } from '../useRotation'

// The window is the portrait-locked 402x874 the mocked react-native reports; the shared reading turns it 90 either way under a landscape hold.
const SHOW = 'keyboardWillShow'
const HIDE = 'keyboardWillHide'

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

const LANDSCAPE = { x: 8, y: 0 } // p1OnRight -> view rotation -90
const PORTRAIT_UPSIDE_DOWN = { x: 0, y: 8 } // view rotation 180

describe('OrientationProvider portraitWhileKeyboard', () => {
  let motion = createFakeDeviceMotion()
  let state: OrientationState
  let rotation: number
  let dims: { width: number; height: number }
  let renders = 0

  function Reader() {
    state = useOrientationState()
    rotation = useRotation()
    dims = useRotatedWindowDimensions()
    renders += 1
    return null
  }

  function hold(gravity: { x: number; y: number }) {
    motion.emit(gravity)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    motion.emit(gravity)
  }

  const tree = (portraitWhileKeyboard?: boolean) => (
    <OrientationProvider deviceMotion={motion.module} portraitWhileKeyboard={portraitWhileKeyboard}>
      <Reader />
    </OrientationProvider>
  )

  beforeEach(() => {
    jest.useFakeTimers()
    motion = createFakeDeviceMotion()
    renders = 0
  })
  afterEach(() => {
    jest.useRealTimers()
    for (const event of Object.keys(keyboardListeners)) keyboardListeners[event].clear()
  })

  it('reads rotation 0 (portrait) while the keyboard is up, and the real rotation again once it hides', () => {
    render(tree(true))
    hold(LANDSCAPE)
    expect(rotation).toBe(-90)
    expect(dims).toEqual({ width: 874, height: 402 })

    act(() => emitKeyboard(SHOW))
    expect(rotation).toBe(0)
    expect(state).toMatchObject({ orientationMode: 'faceToFace', upsideDown: false })
    // The rotated footprint reverts with it: the window is no longer swapped.
    expect(dims).toEqual({ width: 402, height: 874 })

    act(() => emitKeyboard(HIDE))
    expect(rotation).toBe(-90)
    expect(dims).toEqual({ width: 874, height: 402 })
  })

  it('also reverts an upside-down portrait hold (180) to plain portrait while the keyboard is up', () => {
    render(tree(true))
    hold(PORTRAIT_UPSIDE_DOWN)
    expect(rotation).toBe(180)

    act(() => emitKeyboard(SHOW))
    expect(rotation).toBe(0)

    act(() => emitKeyboard(HIDE))
    expect(rotation).toBe(180)
  })

  it('keeps tracking the sensor underneath: a hold committed while the keyboard is up shows the moment it hides', () => {
    render(tree(true))
    hold(LANDSCAPE)
    act(() => emitKeyboard(SHOW))
    expect(rotation).toBe(0)

    hold(PORTRAIT_UPSIDE_DOWN) // the phone is turned while typing
    expect(rotation).toBe(0)

    act(() => emitKeyboard(HIDE))
    expect(rotation).toBe(180)
  })

  it('leaves getOrientationSnapshot on the PHYSICAL hold - only what consumers read is overridden', () => {
    render(tree(true))
    hold(LANDSCAPE)
    act(() => emitKeyboard(SHOW))

    expect(getOrientationSnapshot()).toMatchObject({ orientationMode: 'sideBySide', p1OnRight: true })
  })

  it('does nothing at all when the prop is omitted or false: no listeners, and the keyboard never changes the reading', () => {
    render(tree())
    hold(LANDSCAPE)
    expect(keyboardListeners[SHOW]?.size ?? 0).toBe(0)

    act(() => emitKeyboard(SHOW))
    expect(rotation).toBe(-90)
  })

  it('does not re-render consumers when the keyboard shows or hides for an app that did not opt in', () => {
    render(tree(false))
    hold(LANDSCAPE)
    const before = renders

    act(() => emitKeyboard(SHOW))
    act(() => emitKeyboard(HIDE))

    expect(renders).toBe(before)
  })

  it('keeps the same reading object across unrelated re-renders while the keyboard is up (no needless consumer churn)', () => {
    const utils = render(tree(true))
    hold(LANDSCAPE)
    act(() => emitKeyboard(SHOW))
    const overridden = state

    utils.rerender(tree(true))
    expect(state).toBe(overridden)
  })
})

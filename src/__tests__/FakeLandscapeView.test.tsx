import { act, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { View } from 'react-native'

import { FakeLandscapeView } from '../FakeLandscapeView'
import { DeviceMotionMeasurement, DeviceMotionModule, OrientationStateProvider } from '../useOrientationState'

// Same local test double as useOrientationState.test.tsx/useRotation.test.tsx — production code
// never imports expo-sensors directly, so there's nothing to moduleNameMapper-mock here.
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

describe('FakeLandscapeView', () => {
  beforeEach(() => {
    ;(View as unknown as jest.Mock).mockClear()
  })

  it('renders children directly under the passed style, unrotated, when rotation is 0 (faceToFace, right-side-up)', () => {
    const style = { backgroundColor: 'red' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={false} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toBe(style)
  })

  it('ignores p1OnRight for the 0° faceToFace case', () => {
    const style = { backgroundColor: 'blue' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={true} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toBe(style)
  })

  it('flips 180° in place when faceToFace and upsideDown', () => {
    const style = { backgroundColor: 'green' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={false} upsideDown={true} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toEqual([style, { transform: [{ rotate: '180deg' }] }])
  })

  it('rotates 90° and swaps width/height when sideBySide with p1 on the left', () => {
    const style = { backgroundColor: 'yellow' }
    render(
      <FakeLandscapeView orientationMode='sideBySide' p1OnRight={false} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)

    const [outerProps, innerProps] = calls.map((call) => call[0])
    expect(outerProps.style).toBeUndefined()
    expect(outerProps.pointerEvents).toBe('box-none')

    const innerStyleArray = innerProps.style as unknown[]
    const computedStyle = innerStyleArray[innerStyleArray.length - 1]
    expect(computedStyle).toEqual({
      height: 402,
      left: (402 - 874) / 2,
      top: (874 - 402) / 2,
      transform: [{ rotate: '90deg' }],
      width: 874
    })
  })

  it('rotates -90° and swaps width/height when sideBySide with p1 on the right', () => {
    const style = { backgroundColor: 'yellow' }
    render(
      <FakeLandscapeView orientationMode='sideBySide' p1OnRight={true} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)

    const [outerProps, innerProps] = calls.map((call) => call[0])
    expect(outerProps.style).toBeUndefined()
    expect(outerProps.pointerEvents).toBe('box-none')

    const innerStyleArray = innerProps.style as unknown[]
    const computedStyle = innerStyleArray[innerStyleArray.length - 1]
    expect(computedStyle).toEqual({
      height: 402,
      left: (402 - 874) / 2,
      top: (874 - 402) / 2,
      transform: [{ rotate: '-90deg' }],
      width: 874
    })
  })

  // Unlike the explicit-prop tests above (which never touch the ambient useOrientationState() read
  // at all), these drive the REAL hook through a real OrientationStateProvider + fake DeviceMotion —
  // matching useRotation.test.tsx's own convention now that this component lives in the same package
  // as the real implementation, rather than split-screen's old approach of mocking the whole
  // '@tastic/core' module (which stopped being an option the moment this file itself became part of
  // that package).
  describe('ambient default (orientationMode/p1OnRight/upsideDown all omitted)', () => {
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

    it('falls back to a live useOrientationState() read when every orientation prop is omitted', () => {
      const style = { backgroundColor: 'purple' }
      render(
        <FakeLandscapeView style={style}>hello</FakeLandscapeView>,
        { wrapper }
      )

      commit({ x: 0, y: 8 }) // faceToFace + upsideDown, same gravity useRotation.test.tsx commits to 180°

      expect(screen.getByText('hello')).toBeTruthy()
      const calls = (View as unknown as jest.Mock).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0].style).toEqual([style, { transform: [{ rotate: '180deg' }] }])
    })

    it('honors an explicit prop over the ambient value for that one field, while still falling back for the others', () => {
      const style = { backgroundColor: 'purple' }
      // upsideDown explicitly false overrides the ambient upsideDown:true — orientationMode/p1OnRight
      // still come from the ambient read.
      render(
        <FakeLandscapeView upsideDown={false} style={style}>
          hello
        </FakeLandscapeView>,
        { wrapper }
      )

      commit({ x: 0, y: 8 }) // would otherwise commit upsideDown:true, per the test above

      const calls = (View as unknown as jest.Mock).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0].style).toBe(style)
    })

    it('freezes at whatever the ambient reading was when locked became true, ignoring a later tilt', () => {
      const style = { backgroundColor: 'purple' }
      const { rerender } = render(
        <FakeLandscapeView locked={false} style={style}>
          hello
        </FakeLandscapeView>,
        { wrapper }
      )

      commit({ x: 0, y: 8 }) // commits upsideDown:true -> 180°
      let calls = (View as unknown as jest.Mock).mock.calls
      expect(calls[calls.length - 1][0].style).toEqual([style, { transform: [{ rotate: '180deg' }] }])

      rerender(
        <FakeLandscapeView locked={true} style={style}>
          hello
        </FakeLandscapeView>
      )

      commit({ x: 8, y: 0 }) // would otherwise commit sideBySide/p1OnRight -> -90°, but locked is now true

      calls = (View as unknown as jest.Mock).mock.calls
      expect(calls[calls.length - 1][0].style).toEqual([style, { transform: [{ rotate: '180deg' }] }])
    })
  })
})

import { act, render, screen } from '@testing-library/react'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

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

type Flat = Record<string, unknown>
const OVERLAY: ViewStyle[] = [StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]
const CENTERED: ViewStyle = { alignItems: 'center', flex: 1, gap: 48, justifyContent: 'center', padding: 4, backgroundColor: 'red', flexDirection: 'row' }
const SIZED: ViewStyle = { alignSelf: 'center', height: 120, marginTop: 8, maxWidth: 300, width: 200, zIndex: 3, borderWidth: 1 }
const FLEX_ONE: ViewStyle = { flex: 1 }
const SCALED: ViewStyle = { transform: [{ scale: 2 }] }
const FILL_INNER = { flexBasis: 'auto', flexGrow: 1, flexShrink: 1 }

// Reads the outer/inner View props from the most recent render (the last two View calls).
function lastViews() {
  const calls = (View as unknown as jest.Mock).mock.calls
  const [outerProps, innerProps] = calls.slice(-2).map((call) => call[0])
  return {
    outerProps,
    innerProps,
    outer: (StyleSheet.flatten(outerProps.style) ?? {}) as Flat,
    inner: (StyleSheet.flatten(innerProps.style) ?? {}) as Flat
  }
}

const FLIP = { orientationMode: 'faceToFace', p1OnRight: false, upsideDown: true } as const
const ZERO = { orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false } as const
const RIGHT = { orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false } as const
const LEFT = { orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false } as const

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
    expect(calls).toHaveLength(2)
    const { outerProps, outer, inner } = lastViews()
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(outer).toEqual({})
    expect(inner).toEqual({ ...FILL_INNER, ...style })
  })

  it('ignores p1OnRight for the 0° faceToFace case', () => {
    const style = { backgroundColor: 'blue' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={true} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)
    const { outerProps, outer, inner } = lastViews()
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(outer).toEqual({})
    expect(inner).toEqual({ ...FILL_INNER, ...style })
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
    expect(calls).toHaveLength(2)
    expect(lastViews().outerProps.pointerEvents).toBe('box-none')
    expect(lastViews().inner).toEqual({ ...FILL_INNER, ...style, transform: [{ rotate: '180deg' }] })
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

    const { outerProps, outer, inner } = lastViews()
    expect(outer).toEqual(StyleSheet.absoluteFill)
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(inner).toEqual({
      ...style,
      position: 'absolute',
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

    const { outerProps, outer, inner } = lastViews()
    expect(outer).toEqual(StyleSheet.absoluteFill)
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(inner).toEqual({
      ...style,
      position: 'absolute',
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
      render(<FakeLandscapeView style={style}>hello</FakeLandscapeView>, { wrapper })

      commit({ x: 0, y: 8 }) // faceToFace + upsideDown, same gravity useRotation.test.tsx commits to 180°

      expect(screen.getByText('hello')).toBeTruthy()
      const calls = (View as unknown as jest.Mock).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect(lastViews().inner).toEqual({ ...FILL_INNER, ...style, transform: [{ rotate: '180deg' }] })
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
      expect(calls.length).toBeGreaterThan(0)
      expect(lastViews().inner).toEqual({ ...FILL_INNER, ...style })
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
      expect(lastViews().inner.transform).toEqual([{ rotate: '180deg' }])

      rerender(
        <FakeLandscapeView locked={true} style={style}>
          hello
        </FakeLandscapeView>
      )

      commit({ x: 8, y: 0 }) // would otherwise commit sideBySide/p1OnRight -> -90°, but locked is now true

      expect(lastViews().inner.transform).toEqual([{ rotate: '180deg' }])
    })
  })
})

// Layout equivalence with the ORIGINAL single-View implementation (a bare <View style> at 0°,
// <View style flip180> at 180°) for every real caller pattern in the fleet. Patterns 2-4 fail against
// the earlier "flex:1 outer, caller style on inner" implementation: its outer was always {flex: 1}
// (in flow, stealing flex space from siblings) and its inner carried position/width/height.
describe('FakeLandscapeView 0/180 layout equivalence with the old single-View implementation', () => {
  const patterns: Record<string, StyleProp<ViewStyle>> = {
    'flex:1 (achievements screens)': { flex: 1 },
    'absolute overlay (LightCycles/Snake corner chips)': OVERLAY,
    'flex:1 + centering + gap (home/loadout screens)': { alignItems: 'center', flex: 1, gap: 48, justifyContent: 'center' },
    'explicit width/height + margin/alignSelf': { alignSelf: 'center', height: 120, marginTop: 8, width: 200 },
    none: undefined
  }

  it('(1) {flex:1}: outer is the flex:1 box, inner only fills it', () => {
    render(
      <FakeLandscapeView {...ZERO} style={FLEX_ONE}>
        x
      </FakeLandscapeView>
    )
    const { outer, inner } = lastViews()
    expect(outer).toEqual({ flex: 1 })
    expect(inner).toEqual(FILL_INNER)
  })

  it('(2) absolute overlay: outer is position:absolute with the fill offsets and NOT flex:1; pointerEvents style stays on inner', () => {
    render(
      <FakeLandscapeView {...ZERO} style={OVERLAY}>
        x
      </FakeLandscapeView>
    )
    const { outer, inner, outerProps } = lastViews()
    expect(outer).toEqual({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 })
    expect(outer.flex).toBeUndefined()
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(inner.pointerEvents).toBe('box-none')
    expect(inner.position).toBeUndefined()
    expect(inner).toEqual({ ...FILL_INNER, pointerEvents: 'box-none' })
  })

  it('(3) centering keys land on the INNER container, sizing on the outer', () => {
    render(
      <FakeLandscapeView {...ZERO} style={CENTERED}>
        x
      </FakeLandscapeView>
    )
    const { outer, inner } = lastViews()
    expect(outer).toEqual({ flex: 1 })
    expect(inner).toEqual({ ...FILL_INNER, alignItems: 'center', gap: 48, justifyContent: 'center', padding: 4, backgroundColor: 'red', flexDirection: 'row' })
  })

  it('(4) explicit width/height, margins, alignSelf, min/max, zIndex go to the outer', () => {
    render(
      <FakeLandscapeView {...ZERO} style={SIZED}>
        x
      </FakeLandscapeView>
    )
    const { outer, inner } = lastViews()
    expect(outer).toEqual({ alignSelf: 'center', height: 120, marginTop: 8, maxWidth: 300, width: 200, zIndex: 3 })
    expect(inner).toEqual({ ...FILL_INNER, borderWidth: 1 })
  })

  it('(5) no style: bare outer, fill-only inner', () => {
    render(<FakeLandscapeView {...ZERO}>x</FakeLandscapeView>)
    const { outer, inner } = lastViews()
    expect(outer).toEqual({})
    expect(inner).toEqual(FILL_INNER)
  })

  it('(6) 180 adds exactly rotate(180deg) on the inner and changes nothing else', () => {
    for (const style of Object.values(patterns)) {
      const { unmount } = render(
        <FakeLandscapeView {...ZERO} style={style}>
          x
        </FakeLandscapeView>
      )
      const zero = lastViews()
      unmount()
      render(
        <FakeLandscapeView {...FLIP} style={style}>
          x
        </FakeLandscapeView>
      )
      const flip = lastViews()
      expect(flip.outer).toEqual(zero.outer)
      expect(flip.inner).toEqual({ ...zero.inner, transform: [{ rotate: '180deg' }] })
    }
  })

  it('a caller transform stays on the outer so it composes with the inner rotation', () => {
    render(
      <FakeLandscapeView {...FLIP} style={SCALED}>
        x
      </FakeLandscapeView>
    )
    const { outer, inner } = lastViews()
    expect(outer.transform).toEqual([{ scale: 2 }])
    expect(inner.transform).toEqual([{ rotate: '180deg' }])
  })

  it('+/-90 is unchanged from the original: outer absoluteFill box-none, inner = caller style + absolute + swapped size + rotate', () => {
    for (const [angle, props] of [
      ['90deg', RIGHT],
      ['-90deg', LEFT]
    ] as const) {
      const style = { alignItems: 'center', flex: 1 } as const
      const { unmount } = render(
        <FakeLandscapeView {...props} style={style}>
          x
        </FakeLandscapeView>
      )
      const { outer, outerProps, inner } = lastViews()
      expect(outer).toEqual(StyleSheet.absoluteFill)
      expect(outerProps.pointerEvents).toBe('box-none')
      expect(inner).toEqual({ ...style, position: 'absolute', width: 874, height: 402, left: (402 - 874) / 2, top: (874 - 402) / 2, transform: [{ rotate: angle }] })
      unmount()
    }
  })
})

// Regression: FakeLandscapeView used to return a different element tree per angle (bare View at 0°,
// wrapped at ±90°), so rotating between them unmounted and remounted every descendant, wiping their
// state. The tree must be identical at every angle — only styles change — for every style shape.
describe('FakeLandscapeView children stability across rotation', () => {
  const mounts = jest.fn()
  const unmounts = jest.fn()
  let instanceId = 0

  function Probe() {
    const id = useRef(++instanceId)
    const [count] = useState(0)
    useEffect(() => {
      const mountedId = id.current
      mounts(mountedId)
      return () => unmounts(mountedId)
    }, [])
    return <>{`probe-${count}`}</>
  }

  beforeEach(() => {
    mounts.mockClear()
    unmounts.mockClear()
    instanceId = 0
  })

  const styles: Record<string, StyleProp<ViewStyle>> = {
    'flex:1': { flex: 1 },
    'absolute overlay': [StyleSheet.absoluteFill, { pointerEvents: 'box-none' }],
    centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    'explicit size': { height: 100, width: 100 },
    none: undefined
  }
  const props = { zero: ZERO, right: RIGHT, left: LEFT, flip: FLIP }

  for (const [name, style] of Object.entries(styles)) {
    it(`never remounts children when rotation changes between 0, 90, -90 and 180 (${name})`, () => {
      const { rerender } = render(
        <FakeLandscapeView {...props.zero} style={style}>
          <Probe />
        </FakeLandscapeView>
      )
      for (const next of [props.right, props.left, props.flip, props.zero, props.left, props.flip, props.right, props.zero]) {
        rerender(
          <FakeLandscapeView {...next} style={style}>
            <Probe />
          </FakeLandscapeView>
        )
      }

      expect(mounts).toHaveBeenCalledTimes(1)
      expect(unmounts).not.toHaveBeenCalled()
      expect(screen.getByText('probe-0')).toBeTruthy()
    })
  }
})

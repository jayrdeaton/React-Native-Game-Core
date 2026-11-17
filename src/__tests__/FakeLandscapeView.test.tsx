import { render, screen } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native'

import { FakeLandscapeView } from '../FakeLandscapeView'
import { ViewRotation } from '../rotation'

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

const FLIP = { rotation: 180 } as const
const ZERO = { rotation: 0 } as const

describe('FakeLandscapeView', () => {
  beforeEach(() => {
    ;(View as unknown as jest.Mock).mockClear()
  })

  it('renders children directly under the passed style, unrotated, when no rotation is given', () => {
    const style = { backgroundColor: 'red' }
    render(<FakeLandscapeView style={style}>hello</FakeLandscapeView>)

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)
    const { outerProps, outer, inner } = lastViews()
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(outer).toEqual({})
    expect(inner).toEqual({ ...FILL_INNER, ...style })
  })

  it('flips 180° in place for rotation 180', () => {
    const style = { backgroundColor: 'green' }
    render(
      <FakeLandscapeView rotation={180} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)
    expect(lastViews().outerProps.pointerEvents).toBe('box-none')
    expect(lastViews().inner).toEqual({ ...FILL_INNER, ...style, transform: [{ rotate: '180deg' }] })
  })

  it.each([90, -90] as const)('turns %i° and swaps width/height for an explicit rotation', (rotation) => {
    const style = { backgroundColor: 'yellow' }
    render(
      <FakeLandscapeView rotation={rotation} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()
    expect((View as unknown as jest.Mock).mock.calls).toHaveLength(2)

    const { outerProps, outer, inner } = lastViews()
    expect(outer).toEqual(StyleSheet.absoluteFill)
    expect(outerProps.pointerEvents).toBe('box-none')
    expect(inner).toEqual({
      ...style,
      position: 'absolute',
      height: 402,
      left: (402 - 874) / 2,
      top: (874 - 402) / 2,
      transform: [{ rotate: `${rotation}deg` }],
      width: 874
    })
  })

  // The window's shape never asks for a turn: the OS turns the screen, so a wide window is already wide.
  describe('with no rotation', () => {
    afterEach(() => {
      ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 })
    })

    it.each([
      [402, 874],
      [874, 402]
    ])('draws no turn in a %ix%i window', (width, height) => {
      ;(useWindowDimensions as jest.Mock).mockReturnValue({ width, height, scale: 3, fontScale: 1 })
      const style = { backgroundColor: 'purple' }
      render(<FakeLandscapeView style={style}>hello</FakeLandscapeView>)

      expect(screen.getByText('hello')).toBeTruthy()
      expect(lastViews().inner).toEqual({ ...FILL_INNER, ...style })
    })
  })
})

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
    for (const [angle, rotation] of [
      ['90deg', 90],
      ['-90deg', -90]
    ] as const) {
      const style = { alignItems: 'center', flex: 1 } as const
      const { unmount } = render(
        <FakeLandscapeView rotation={rotation} style={style}>
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

describe('FakeLandscapeView explicit rotation', () => {
  beforeEach(() => {
    ;(View as unknown as jest.Mock).mockClear()
  })

  it('180 rotates in place without swapping the footprint', () => {
    render(
      <FakeLandscapeView rotation={180} style={FLEX_ONE}>
        x
      </FakeLandscapeView>
    )
    expect(lastViews().inner).toEqual({ ...FILL_INNER, transform: [{ rotate: '180deg' }] })
  })
})

describe('FakeLandscapeView passThrough', () => {
  beforeEach(() => {
    ;(View as unknown as jest.Mock).mockClear()
  })

  for (const rotation of [0, 90, 180, -90] as const) {
    it(`makes both views box-none at ${rotation}`, () => {
      render(
        <FakeLandscapeView rotation={rotation} passThrough style={FLEX_ONE}>
          x
        </FakeLandscapeView>
      )
      const { outerProps, innerProps } = lastViews()
      expect(outerProps.pointerEvents).toBe('box-none')
      expect(innerProps.pointerEvents).toBe('box-none')
    })

    it(`leaves the inner view's touches alone by default at ${rotation}`, () => {
      render(
        <FakeLandscapeView rotation={rotation} style={FLEX_ONE}>
          x
        </FakeLandscapeView>
      )
      expect(lastViews().innerProps.pointerEvents).toBeUndefined()
    })
  }
})

// Regression: FakeLandscapeView used to return a different element tree per angle (bare View at 0°,
// wrapped at ±90°), so rotating between them unmounted and remounted every descendant, wiping their
// state. The tree must be identical at every angle - only styles change - for every style shape.
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
  const rotations: ViewRotation[] = [90, -90, 180, 0, -90, 180, 90, 0]

  for (const [name, style] of Object.entries(styles)) {
    it(`never remounts children when rotation changes between 0, 90, -90 and 180 (${name})`, () => {
      const { rerender } = render(
        <FakeLandscapeView rotation={0} style={style}>
          <Probe />
        </FakeLandscapeView>
      )
      for (const rotation of rotations) {
        rerender(
          <FakeLandscapeView rotation={rotation} style={style}>
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

import { Platform } from 'react-native'

import { getFixedZoneRotation, getOpposingZoneRotation, getViewRotation, rotateDimensions, toRotationStyle } from '../rotation'

describe('getViewRotation', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
  })

  it('turns faceToFace by 0° right-side-up and 180° upside-down, regardless of p1OnRight', () => {
    expect(getViewRotation('faceToFace', true, false)).toBe(0)
    expect(getViewRotation('faceToFace', false, false)).toBe(0)
    expect(getViewRotation('faceToFace', true, true)).toBe(180)
    expect(getViewRotation('faceToFace', false, true)).toBe(180)
  })

  it.each(['ios', 'android', 'web'] as const)('never turns sideBySide on %s: a wide window is already the right shape (0.15)', (os) => {
    Platform.OS = os as typeof Platform.OS
    for (const p1OnRight of [true, false]) for (const upsideDown of [true, false]) expect(getViewRotation('sideBySide', p1OnRight, upsideDown)).toBe(0)
  })
})

describe('getFixedZoneRotation', () => {
  it('is 0° for every reading', () => {
    for (const mode of ['faceToFace', 'sideBySide'] as const) for (const p1OnRight of [true, false]) for (const upsideDown of [true, false]) expect(getFixedZoneRotation(mode, p1OnRight, upsideDown)).toBe(0)
  })
})

describe('getOpposingZoneRotation', () => {
  it('leaves landscape rotations unchanged - both seats face the same way', () => {
    expect(getOpposingZoneRotation(90)).toBe(90)
    expect(getOpposingZoneRotation(-90)).toBe(-90)
  })

  it('flips between the two portrait angles - seats face across the device from each other', () => {
    expect(getOpposingZoneRotation(0)).toBe(180)
    expect(getOpposingZoneRotation(180)).toBe(0)
  })
})

describe('toRotationStyle', () => {
  it('contributes no transform at all for 0°, rather than an inert rotate:0deg entry', () => {
    expect(toRotationStyle(0)).toBeUndefined()
  })

  it('produces a rotate transform for every non-zero ViewRotation angle', () => {
    expect(toRotationStyle(90)).toEqual({ transform: [{ rotate: '90deg' }] })
    expect(toRotationStyle(-90)).toEqual({ transform: [{ rotate: '-90deg' }] })
    expect(toRotationStyle(180)).toEqual({ transform: [{ rotate: '180deg' }] })
  })
})

describe('rotateDimensions', () => {
  it('is the identity at 0°', () => {
    expect(rotateDimensions(402, 874, 0)).toEqual({ width: 402, height: 874 })
  })

  it('is the identity at 180° - the footprint is unchanged, only the content flips in place', () => {
    expect(rotateDimensions(402, 874, 180)).toEqual({ width: 402, height: 874 })
  })

  it('swaps width and height at 90°', () => {
    expect(rotateDimensions(402, 874, 90)).toEqual({ width: 874, height: 402 })
  })

  it('swaps width and height at -90°, same as 90°', () => {
    expect(rotateDimensions(402, 874, -90)).toEqual({ width: 874, height: 402 })
  })
})

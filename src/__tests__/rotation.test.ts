import { rotateDimensions, toRotationStyle } from '../rotation'

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

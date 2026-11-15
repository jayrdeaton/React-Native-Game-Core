import { Orientation } from 'expo-screen-orientation'

import { edgeDip, interfaceOrientationFromHold, tiltToScreenAxes } from '../interfaceOrientation/tilt'

const deg = (degrees: number) => (degrees * Math.PI) / 180
const toDeg = (radians: number) => (radians * 180) / Math.PI

// What both platforms report for a hold, from the up vector in the device's frame (Android's
// getOrientation and iOS's CMAttitude alike): beta = asin(up.y), gamma = atan2(-up.x, up.z). The hold is
// given by how far the right edge dips (`dipDeg`), how far the top edge is raised (`raiseDeg`), and
// whether the screen faces up (true) or has tipped past vertical (false). The two edges are square to
// each other, so a hold where both are steep doesn't exist.
function reported(dipDeg: number, raiseDeg: number, screenUp = true): { beta: number; gamma: number } {
  const x = -Math.sin(deg(dipDeg))
  const y = Math.sin(deg(raiseDeg))
  if (x * x + y * y > 1) throw new Error(`no hold dips ${dipDeg} and raises ${raiseDeg}`)
  const z = (screenUp ? 1 : -1) * Math.sqrt(1 - x * x - y * y)
  return { beta: Math.asin(y), gamma: Math.atan2(-x, z) }
}

const dipOf = ({ beta, gamma }: { beta: number; gamma: number }) => toDeg(edgeDip(beta, gamma))

describe('edgeDip', () => {
  it('is gamma exactly lying flat', () => {
    for (const gamma of [-80, -25, -3, 0, 3, 25, 80]) expect(toDeg(edgeDip(0, deg(gamma)))).toBeCloseTo(gamma, 10)
  })

  // The edges are square to each other, so the steeper the top edge, the less the right edge can dip.
  it.each([0, 30, 60, 80, 88, 89.9, -45, -85])('reads the right edge dip with the top edge raised %d degrees', (raise) => {
    const most = Math.min(20, 0.9 * (90 - Math.abs(raise)))
    for (const dip of [-most, -most / 4, 0, most / 4, most]) expect(dipOf(reported(dip, raise))).toBeCloseTo(dip, 8)
  })

  it('reads the same dip either side of vertical, where gamma jumps (by 180 for a level hold)', () => {
    for (const dip of [0.2, 3, -3]) {
      const before = reported(dip, 85, true)
      const after = reported(dip, 85, false)
      expect(Math.abs(toDeg(after.gamma - before.gamma))).toBeGreaterThan(100)
      expect(dipOf(before)).toBeCloseTo(dip, 8)
      expect(dipOf(after)).toBeCloseTo(dip, 8)
    }
  })

  it('holds steady held upright, where a tremor swings gamma by tens of degrees', () => {
    const level = reported(0.5, 88)
    const tremor = reported(1.5, 88)
    expect(toDeg(tremor.gamma - level.gamma)).toBeGreaterThan(30)
    expect(dipOf(tremor) - dipOf(level)).toBeCloseTo(1, 8)
  })

  it('reads a quarter turn with an edge straight down, and never NaN', () => {
    expect(edgeDip(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10)
    expect(edgeDip(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 10)
    expect(edgeDip(Math.PI / 2, Math.PI)).toBeCloseTo(0, 10)
    expect(Number.isNaN(edgeDip(-Math.PI / 2, Math.PI / 2))).toBe(false)
  })
})

describe('tiltToScreenAxes', () => {
  it('passes gamma and beta straight through in portrait', () => {
    expect(tiltToScreenAxes(0.3, -0.2, Orientation.PORTRAIT_UP)).toEqual({ x: 0.3, y: -0.2 })
  })

  it('maps the long edge onto screen x with the device turned counter-clockwise', () => {
    expect(tiltToScreenAxes(0.3, -0.2, Orientation.LANDSCAPE_RIGHT)).toEqual({ x: -0.2, y: -0.3 })
  })

  it('maps it the other way with the device turned clockwise', () => {
    expect(tiltToScreenAxes(0.3, -0.2, Orientation.LANDSCAPE_LEFT)).toEqual({ x: 0.2, y: 0.3 })
  })

  it('inverts both axes upside down', () => {
    expect(tiltToScreenAxes(0.3, -0.2, Orientation.PORTRAIT_DOWN)).toEqual({ x: -0.3, y: 0.2 })
  })

  it('reads an unknown orientation as portrait', () => {
    expect(tiltToScreenAxes(0.3, -0.2, Orientation.UNKNOWN)).toEqual({ x: 0.3, y: -0.2 })
  })
})

describe('interfaceOrientationFromHold', () => {
  it('takes the landscape side from how the device is held', () => {
    expect(interfaceOrientationFromHold(true, -90, Orientation.PORTRAIT_UP)).toBe(Orientation.LANDSCAPE_RIGHT)
    expect(interfaceOrientationFromHold(true, 90, Orientation.PORTRAIT_UP)).toBe(Orientation.LANDSCAPE_LEFT)
  })

  it('keeps the last landscape side while the hold gives none', () => {
    expect(interfaceOrientationFromHold(true, 0, Orientation.LANDSCAPE_LEFT)).toBe(Orientation.LANDSCAPE_LEFT)
    expect(interfaceOrientationFromHold(true, 180, Orientation.LANDSCAPE_LEFT)).toBe(Orientation.LANDSCAPE_LEFT)
    expect(interfaceOrientationFromHold(true, 0, Orientation.PORTRAIT_UP)).toBe(Orientation.LANDSCAPE_RIGHT)
  })

  it('stays portrait in a portrait window whichever way the device is turned, unless upside down', () => {
    expect(interfaceOrientationFromHold(false, -90, Orientation.LANDSCAPE_RIGHT)).toBe(Orientation.PORTRAIT_UP)
    expect(interfaceOrientationFromHold(false, 0, Orientation.PORTRAIT_UP)).toBe(Orientation.PORTRAIT_UP)
    expect(interfaceOrientationFromHold(false, 180, Orientation.PORTRAIT_UP)).toBe(Orientation.PORTRAIT_DOWN)
  })
})

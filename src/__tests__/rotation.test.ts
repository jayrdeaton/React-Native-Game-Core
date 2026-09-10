import { Platform } from 'react-native'

import { getFixedZoneRotation, getOpposingZoneRotation, getViewRotation } from '../rotation'

describe('getViewRotation', () => {
  it('rotates faceToFace by 0° right-side-up, 180° upside-down, regardless of p1OnRight', () => {
    expect(getViewRotation('faceToFace', true, false)).toBe(0)
    expect(getViewRotation('faceToFace', false, false)).toBe(0)
    expect(getViewRotation('faceToFace', true, true)).toBe(180)
    expect(getViewRotation('faceToFace', false, true)).toBe(180)
  })

  it('rotates sideBySide by -90°/90° depending on p1OnRight, regardless of upsideDown', () => {
    expect(getViewRotation('sideBySide', true, false)).toBe(-90)
    expect(getViewRotation('sideBySide', false, false)).toBe(90)
    expect(getViewRotation('sideBySide', true, true)).toBe(-90)
    expect(getViewRotation('sideBySide', false, true)).toBe(90)
  })

  describe('on web', () => {
    const originalOS = Platform.OS

    afterEach(() => {
      Platform.OS = originalOS
    })

    it("never applies sideBySide's own compensating rotation — a browser window has no OS-level portrait lock to compensate for, regardless of p1OnRight", () => {
      Platform.OS = 'web'
      expect(getViewRotation('sideBySide', true, false)).toBe(0)
      expect(getViewRotation('sideBySide', false, false)).toBe(0)
    })

    it('still falls through to the upsideDown flip on web — moot in practice since the web fallback never reports upsideDown true, but the function itself has no reason to special-case it away', () => {
      Platform.OS = 'web'
      expect(getViewRotation('sideBySide', true, true)).toBe(180)
      expect(getViewRotation('sideBySide', false, true)).toBe(180)
    })

    it('still applies faceToFace as normal — unaffected by the sideBySide exclusion', () => {
      Platform.OS = 'web'
      expect(getViewRotation('faceToFace', true, false)).toBe(0)
      expect(getViewRotation('faceToFace', true, true)).toBe(180)
    })
  })
})

describe('getFixedZoneRotation', () => {
  it('ignores upsideDown entirely in faceToFace, always 0°', () => {
    expect(getFixedZoneRotation('faceToFace', true, false)).toBe(0)
    expect(getFixedZoneRotation('faceToFace', true, true)).toBe(0)
    expect(getFixedZoneRotation('faceToFace', false, true)).toBe(0)
  })

  it('rotates sideBySide by -90°/90° depending on p1OnRight, same as getViewRotation', () => {
    expect(getFixedZoneRotation('sideBySide', true, false)).toBe(-90)
    expect(getFixedZoneRotation('sideBySide', false, false)).toBe(90)
    expect(getFixedZoneRotation('sideBySide', true, true)).toBe(-90)
  })
})

describe('getOpposingZoneRotation', () => {
  it('leaves landscape rotations unchanged — both seats face the same way', () => {
    expect(getOpposingZoneRotation(90)).toBe(90)
    expect(getOpposingZoneRotation(-90)).toBe(-90)
  })

  it('flips between the two portrait angles — seats face across the device from each other', () => {
    expect(getOpposingZoneRotation(0)).toBe(180)
    expect(getOpposingZoneRotation(180)).toBe(0)
  })
})

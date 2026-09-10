import { rotateInsets } from '../insets'

const PHYSICAL = { top: 44, right: 0, bottom: 34, left: 0 }

describe('rotateInsets', () => {
  it('is the identity at 0°', () => {
    expect(rotateInsets(PHYSICAL, 0)).toEqual(PHYSICAL)
  })

  it('matches the observed real-device mapping at 90°: visual top/right/bottom/left <- physical right/bottom/left/top', () => {
    expect(rotateInsets(PHYSICAL, 90)).toEqual({ top: 0, right: 34, bottom: 0, left: 44 })
  })

  it('mirrors 90° the other way at -90°: visual top/right/bottom/left <- physical left/top/right/bottom', () => {
    expect(rotateInsets(PHYSICAL, -90)).toEqual({ top: 0, right: 44, bottom: 0, left: 34 })
  })

  it('swaps opposite pairs at 180°: top<->bottom, left<->right', () => {
    expect(rotateInsets(PHYSICAL, 180)).toEqual({ top: 34, right: 0, bottom: 44, left: 0 })
  })
})

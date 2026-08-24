import { computeClampedDt } from '../computeClampedDt'

describe('computeClampedDt', () => {
  it('returns 1 (a nominal frame) when there is no prior timestamp', () => {
    expect(computeClampedDt(1000, null, 2.5)).toBe(1)
  })

  it('returns ~1 for a gap matching a normal 60fps frame', () => {
    expect(computeClampedDt(1000 + 1000 / 60, 1000, 2.5)).toBeCloseTo(1)
  })

  it('scales proportionally for a gap that is a multiple of a nominal frame', () => {
    expect(computeClampedDt(1000 + (1000 / 60) * 2, 1000, 10)).toBeCloseTo(2)
  })

  it('clamps a huge gap (e.g. after backgrounding) to maxDt', () => {
    expect(computeClampedDt(1000 + 10_000, 1000, 2.5)).toBe(2.5)
  })

  it('clamps a negative gap (a corrected/rewound timestamp) to 0 rather than going negative', () => {
    expect(computeClampedDt(500, 1000, 2.5)).toBe(0)
  })
})

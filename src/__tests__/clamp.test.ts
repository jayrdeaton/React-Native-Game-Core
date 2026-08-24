import { clamp } from '../clamp'

describe('clamp', () => {
  it('leaves a value inside the range untouched', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps a value below the minimum up to the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps a value above the maximum down to the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('is inclusive at both boundaries', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

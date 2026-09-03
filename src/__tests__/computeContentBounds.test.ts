import { computeContentBounds } from '../computeContentBounds'

describe('computeContentBounds', () => {
  it('passes the window width through as contentWidth, with no gutter, below the max', () => {
    expect(computeContentBounds(800, 1040)).toEqual({ contentWidth: 800, gutterWidth: 0 })
  })

  it('clamps contentWidth to the max and splits the leftover into two equal gutters, above the max', () => {
    expect(computeContentBounds(2000, 1040)).toEqual({ contentWidth: 1040, gutterWidth: 480 })
  })

  it('is unclamped, with no gutter, exactly at the max', () => {
    expect(computeContentBounds(1040, 1040)).toEqual({ contentWidth: 1040, gutterWidth: 0 })
  })

  it('returns zero contentWidth and zero gutterWidth for a zero window width', () => {
    expect(computeContentBounds(0, 1040)).toEqual({ contentWidth: 0, gutterWidth: 0 })
  })

  it('floors a negative window width to zero contentWidth and zero gutterWidth, never negative', () => {
    expect(computeContentBounds(-100, 1040)).toEqual({ contentWidth: 0, gutterWidth: 0 })
  })

  it('disables clamping entirely when maxContentWidth is Infinity — the built-in escape hatch', () => {
    expect(computeContentBounds(2000, Infinity)).toEqual({ contentWidth: 2000, gutterWidth: 0 })
  })
})

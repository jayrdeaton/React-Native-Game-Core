import { add, distance, dot, length, normalize, scale, subtract } from '../Vec2'

describe('Vec2', () => {
  it('add sums both axes', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 })
  })

  it('subtract differences both axes', () => {
    expect(subtract({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x: 3, y: -3 })
  })

  it('scale multiplies both axes by a scalar', () => {
    expect(scale({ x: 2, y: -3 }, 2.5)).toEqual({ x: 5, y: -7.5 })
  })

  it('length returns the magnitude', () => {
    expect(length({ x: 3, y: 4 })).toBe(5)
    expect(length({ x: 0, y: 0 })).toBe(0)
  })

  it('distance returns the magnitude of the difference', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })

  it('dot returns the sum of axis products', () => {
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0)
    expect(dot({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23)
  })

  it('normalize scales a vector to unit length, preserving direction', () => {
    const n = normalize({ x: 3, y: 4 })
    expect(n.x).toBeCloseTo(0.6)
    expect(n.y).toBeCloseTo(0.8)
    expect(length(n)).toBeCloseTo(1)
  })

  it('normalize returns the zero vector for a zero-length input instead of NaN', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})

export interface Vec2 {
  x: number
  y: number
}

export function add(a: Vec2, b: Vec2): Vec2 {
  'worklet'
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  'worklet'
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(v: Vec2, factor: number): Vec2 {
  'worklet'
  return { x: v.x * factor, y: v.y * factor }
}

export function length(v: Vec2): number {
  'worklet'
  return Math.hypot(v.x, v.y)
}

export function distance(a: Vec2, b: Vec2): number {
  'worklet'
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function dot(a: Vec2, b: Vec2): number {
  'worklet'
  return a.x * b.x + a.y * b.y
}

// Returns the zero vector rather than {NaN, NaN} for a zero-length input, so a degenerate collision
// (two circles exactly coincident) or a not-yet-moved drag can normalize safely without every call
// site needing its own zero-length guard.
export function normalize(v: Vec2): Vec2 {
  'worklet'
  const len = length(v)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

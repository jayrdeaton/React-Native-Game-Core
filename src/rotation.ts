export type ViewRotation = 0 | 90 | 180 | -90

// The RN style object that actually applies one of the angles above to a View/Text - guarded so a
// 0° rotation contributes no transform at all, rather than an inert `rotate: '0deg'` entry, so a
// style array's own `cond && {...}` idiom short-circuits to `false` instead of an object every
// consumer would need to no-op anyway. Exists because this exact guarded expression was
// independently hand-typed at a dozen-plus call sites across the fleet's own game screens/dialogs
// (and inside @tastic/hud itself). `% 360` (not a bare `!== 0` check) matches the majority of those
// call sites; it's equivalent for every value ViewRotation can hold.
export function toRotationStyle(rotation: ViewRotation): { transform: [{ rotate: string }] } | undefined {
  return rotation % 360 !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined
}

// A ±90 turn swaps a footprint's width and height; 0 and 180 don't change it. For content turned by
// an explicit rotation (hud's RotatedFrame and its callers).
export function rotateDimensions(width: number, height: number, rotation: ViewRotation): { width: number; height: number } {
  return Math.abs(rotation) === 90 ? { width: height, height: width } : { width, height }
}

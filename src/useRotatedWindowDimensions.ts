import { useWindowDimensions } from 'react-native'

import { rotateDimensions } from './rotation'
import { useRotation } from './useRotation'

// The dimensions analog of useSafeAreaInsets() + rotateInsets(): a caller rendering INSIDE a
// FakeLandscapeView-style ancestor needs its own width/height budget (e.g. a card-layout column
// count, a tableau height cap) to reflect the post-rotation footprint that ancestor actually renders
// into — plain useWindowDimensions() never changes under a fake rotation (the OS still thinks it's
// portrait), so a caller that just calls it directly keeps sizing for the original, unrotated shape
// while rendered at 90°. This swaps width/height exactly the same way FakeLandscapeView itself does
// (same rotateDimensions call), so a caller sees the same logical footprint its own visual ancestor
// is actually presenting.
export function useRotatedWindowDimensions(locked = false): { width: number; height: number } {
  const { width, height } = useWindowDimensions()
  const rotation = useRotation(locked)
  return rotateDimensions(width, height, rotation)
}

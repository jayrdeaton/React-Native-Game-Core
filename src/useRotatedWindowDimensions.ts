import { useWindowDimensions } from 'react-native'

// The window's own size since 0.15, when nothing turns content any more (see useRotation). Kept, with
// its `locked` parameter, only so @tastic/hud, @tastic/split-screen and the apps that call it keep
// compiling until they stop; it goes after that.
export function useRotatedWindowDimensions(_locked = false): { width: number; height: number } {
  const { width, height } = useWindowDimensions()
  return { width, height }
}

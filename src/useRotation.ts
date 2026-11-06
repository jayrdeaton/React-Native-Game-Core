import { ViewRotation } from './rotation'

// Always 0 since 0.15: the OS turns the interface now, so nothing draws a device turn. Kept, with its
// `locked` parameter, only so @tastic/hud, @tastic/split-screen and the apps that call it keep
// compiling until they stop; it goes after that.
export function useRotation(_locked = false): ViewRotation {
  return 0
}

import { ReactNode } from 'react'

export type OrientationProviderProps = {
  children: ReactNode
}

// Renders its children and nothing else. Until 0.15 it held the accelerometer subscription and the
// Lock Orientation setting; useOrientationState now reads the window's shape, which needs no
// provider. Still exported only because @tastic/split-screen re-exports it; it goes once that
// re-export does.
export function OrientationProvider({ children }: OrientationProviderProps) {
  return children
}

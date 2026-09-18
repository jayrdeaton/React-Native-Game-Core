import { ReactNode } from 'react'

import { OrientationLockProvider, OrientationLockSettings } from './OrientationLockContext'
import { DeviceMotionModule, OrientationStateProvider } from './useOrientationState'

export type OrientationProviderProps = {
  children: ReactNode
  // The app's own real `import { DeviceMotion } from 'expo-sensors'`, handed in rather than
  // imported by this package directly — see useOrientationState.tsx's own DeviceMotionModule doc
  // for why: a real top-level import here would force every consumer of this package (not just
  // ones that want live tilt tracking) to have expo-sensors installed, or their bundler fails to
  // resolve it. Mirrors @rific/auto-paper's identical `<Provider reanimated={...}>`/`<Provider
  // expoBlur={...}>` injection convention. Omit entirely for an app with no interest in live
  // orientation tracking (or a build that doesn't want the dependency at all) — every hook still
  // works, it just never resolves past its unresolved default (see useOrientationState.tsx).
  deviceMotion?: DeviceMotionModule
  // Rehydrates the lock setting from the consuming app's own storage at mount time — this Provider
  // deliberately does no persistence of its own, matching @rific/feedback-press's
  // FeedbackPressProvider's identical initialValue/onChange contract (the shared package holds live
  // state; the app decides where/whether that state is saved).
  lockInitialValue?: Partial<OrientationLockSettings>
  // Fires with the full settings object whenever the lock setting changes via useOrientationLock()'s
  // setLocked — the app's own hook into persisting it, analogous to onChange/onSoundChange.
  onLockChange?: (settings: OrientationLockSettings) => void
}

// The one thing an app mounts, once, near its own root (above every screen that calls
// useOrientationState/useRotation/useOrientationLock) — composes the live device-tilt reading
// (OrientationStateProvider, see useOrientationState.tsx) with the lock-setting context above it.
// Without this mounted, every hook in this file's sibling modules still works but degrades to its
// own inert default (unresolved/unlocked, never updates) rather than throwing — the same "missing
// SafeAreaProvider" failure mode useOrientationState's own doc describes.
//
// The lock-setting half is just OrientationLockProvider (@rific/core's createSettingsContext,
// bound in OrientationLockContext.ts) — lockInitialValue/onLockChange are that factory's own
// initialValue/onChange props, forwarded through unchanged (same names this file's own hand-rolled
// version already used, so no consuming app's own props needed to change).
export function OrientationProvider({ children, deviceMotion, lockInitialValue, onLockChange }: OrientationProviderProps) {
  return (
    <OrientationLockProvider initialValue={lockInitialValue} onChange={onLockChange}>
      <OrientationStateProvider deviceMotion={deviceMotion}>{children}</OrientationStateProvider>
    </OrientationLockProvider>
  )
}

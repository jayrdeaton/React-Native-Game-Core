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
  // Opt-in (default false). When true, every consumer of the shared reading sees PORTRAIT (rotation 0) for as long as the SOFTWARE
  // keyboard is showing, and the real orientation again once it hides - so `useRotation()`, `useRotatedWindowDimensions()`,
  // FakeLandscapeView, RotationAwareStatusBar and anything built on them (hud dialogs, a host's own rotated frames) all revert
  // together, with nothing handed the flag by hand.
  // Why it exists: an app that stays portrait-locked at the OS level and fakes landscape by turning a View can't turn the KEYBOARD -
  // iOS draws it in the app's real interface orientation, so it always opens portrait relative to the device, which in a faked
  // landscape hold is sideways to the player and covers the wrong part of the (turned) screen. Reverting the view to portrait while it
  // is up makes the two agree; the player turns the phone upright to type, and the view turns back when the keyboard closes. Nothing
  // remounts: only the reading changes, so a host that keeps its tree identical across angles (see FakeLandscapeView) keeps its state and
  // its focused text field. A hardware keyboard raises no keyboard events, so it never triggers this, and web has none either.
  // Only the value consumers READ is overridden - the sensor reading underneath (and getOrientationSnapshot's copy of it) still
  // tracks how the phone is actually held. Off by default because it changes what an app that never asked for it would see.
  portraitWhileKeyboard?: boolean
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
export function OrientationProvider({ children, deviceMotion, lockInitialValue, onLockChange, portraitWhileKeyboard }: OrientationProviderProps) {
  return (
    <OrientationLockProvider initialValue={lockInitialValue} onChange={onLockChange}>
      <OrientationStateProvider deviceMotion={deviceMotion} portraitWhileKeyboard={portraitWhileKeyboard}>
        {children}
      </OrientationStateProvider>
    </OrientationLockProvider>
  )
}

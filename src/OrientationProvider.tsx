import { ReactNode } from 'react'

import { OrientationLockProvider, OrientationLockSettings } from './OrientationLockContext'
import { ViewRotation } from './rotation'
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
  // state; the app decides where/whether that state is saved). Under `freezeWhileLocked`, include the
  // persisted `rotation` too: a lock restored with one reopens in exactly that orientation from the
  // very first frame (not portrait, and not whichever way the phone happens to be held at launch).
  lockInitialValue?: Partial<OrientationLockSettings>
  // Fires with the full settings object whenever the lock setting changes via useOrientationLock()'s
  // setLocked — the app's own hook into persisting it, analogous to onChange/onSoundChange. Under
  // `freezeWhileLocked` it also fires when the locked `rotation` is recorded or cleared (see
  // OrientationLockSettings) — persist that alongside `locked` and hand both back via lockInitialValue.
  onLockChange?: (settings: OrientationLockSettings) => void
  // Opt-in (default false). When true, the shared orientation reading itself freezes while
  // useOrientationLock().locked is true: every consumer — useOrientationState/useRotation/
  // FakeLandscapeView/RotationAwareStatusBar/getOrientationSnapshot, with or without their own
  // per-call `locked` argument — sees the reading that was current when the user locked, including a
  // component that mounts AFTER the lock (which with per-call-site locking would snapshot the live
  // reading at its own mount instead). Nothing needs to be handed the flag by hand. Unlocking resumes
  // tracking through the normal hold-steady debounce (a tilt held during the lock does not commit the
  // instant you unlock). If the lock is already on at launch (lockInitialValue) and no confident
  // reading exists yet, the first one to arrive is latched rather than pinning the unresolved default.
  // Off by default because it changes semantics: with it on, locking here freezes EVERY consumer of
  // the shared reading — including a screen that would prefer its own independent lock (see
  // useOrientationState's doc). Leave it off to keep the per-call-site behavior exactly as before.
  // Native only: web derives its reading from window size and is not frozen.
  // Also what makes a lock survive a relaunch: while frozen, the lock setting carries the frozen
  // angle as `rotation` (see lockInitialValue/onLockChange).
  freezeWhileLocked?: boolean
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
  // Opt-in allow-list of the angles the shared reading may commit to, in useRotation()'s own terms:
  // 0 = portrait, 180 = upside down, 90 = phone turned counter-clockwise (top edge pointing left),
  // -90 = phone turned clockwise (top edge pointing right). Omitted (or empty) = all four. A hold
  // whose angle isn't listed is ignored the way iOS ignores an unsupported interface orientation:
  // the last allowed reading just stays put. If the current reading isn't allowed (the portrait
  // default in a landscape-only app, or an angle switched off at runtime), it moves to the first
  // allowed of 0, -90, 90, 180. Safe to pass as an inline array literal. portraitWhileKeyboard's
  // override still wins while the keyboard is up, even if 0 isn't listed. Native only, like
  // freezeWhileLocked: web's reading comes from the window's shape, not a physical hold.
  allowedRotations?: readonly ViewRotation[]
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
export function OrientationProvider({ children, deviceMotion, lockInitialValue, onLockChange, freezeWhileLocked, portraitWhileKeyboard, allowedRotations }: OrientationProviderProps) {
  return (
    <OrientationLockProvider initialValue={lockInitialValue} onChange={onLockChange}>
      <OrientationStateProvider deviceMotion={deviceMotion} freezeWhileLocked={freezeWhileLocked} portraitWhileKeyboard={portraitWhileKeyboard} allowedRotations={allowedRotations}>
        {children}
      </OrientationStateProvider>
    </OrientationLockProvider>
  )
}

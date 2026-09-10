import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { OrientationMode } from './OrientationMode'

// Minimal local mirror of expo-sensors' own DeviceMotion export — covering only the members used
// below — rather than a real dependency on the package. Same reasoning as @rific/auto-paper's
// ReanimatedModule/ExpoBlurModule: a real top-level `import { DeviceMotion } from 'expo-sensors'`
// here would force Metro to resolve that module for EVERY consumer of this package, even one that
// only wants `clamp` or `useGameLoop` and has no interest in (or dependency on) expo-sensors at
// all — confirmed as a real, not just theoretical, break for 7 of 9 apps in this fleet currently
// using @tastic/hud (which pulls in useRotation, and so this file, through its own barrel) without
// expo-sensors installed. The consuming app does its own real `import { DeviceMotion } from
// 'expo-sensors'` and hands it to <OrientationProvider deviceMotion={DeviceMotion}> — see that
// component's own doc.
export interface DeviceMotionListener {
  remove: () => void
}
export interface DeviceMotionMeasurement {
  // Only x/y are ever read (see candidateFromGravity below) — z omitted from this mirror entirely,
  // not just left optional, since nothing here has any use for it.
  accelerationIncludingGravity?: { x: number; y: number } | null
}
export interface DeviceMotionModule {
  addListener: (listener: (measurement: DeviceMotionMeasurement) => void) => DeviceMotionListener
  setUpdateInterval: (intervalMs: number) => void
}

export interface OrientationState {
  orientationMode: OrientationMode
  // Only meaningful when orientationMode === 'sideBySide'.
  p1OnRight: boolean
  // Only meaningful when orientationMode === 'faceToFace' — sideBySide's own upside-down case is
  // already fully described by p1OnRight (there's no separate "upside-down landscape" state; a
  // dominant x-axis reading only ever resolves to one of the two landscape directions). See
  // getViewRotation for how this and p1OnRight combine into an actual rotation angle.
  upsideDown: boolean
  // False only until the first confident reading lands — see candidateFromGravity.
  resolved: boolean
}

const DEFAULT_STATE: OrientationState = { orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false }

// Mutable, module-level — deliberately NOT React state/context. Kept in sync (see
// useOrientationStateSource's own setState calls) purely so getOrientationSnapshot can hand back
// "whatever the shared reading currently is" to a caller that must NOT subscribe to live updates —
// see that function's own doc for why plain useOrientationState can't do this job: calling
// useContext, even just to seed a useState initializer that itself never changes again, still
// subscribes the calling component to every future update, and React re-renders that whole
// component (and everything under it) on each one regardless of whether its own derived state ends
// up different. There is exactly one app instance at a time in a React Native app, which is what
// makes a plain module-level variable safe here (no multi-instance/SSR concern to worry about).
let latestSnapshot = DEFAULT_STATE

// A one-time, non-subscribing read of the shared orientation reading — for a caller that only needs
// "whatever this currently is" once (e.g. to seed a lazy useState initializer that freezes a value
// for a match's whole duration) and must never re-render just because the phone moved. Plain
// useOrientationState() cannot serve this: it calls useContext internally, and useContext subscribes
// its caller to every future Provider update for the component's entire lifetime, with no way to
// "read once and unsubscribe" — the calling component re-renders on every commit regardless of
// whether it goes on to actually use the new value. Reads whatever OrientationProvider has most
// recently committed, same as the live hook would at this exact instant — just without establishing
// an ongoing subscription to do it.
export function getOrientationSnapshot(): OrientationState {
  return latestSnapshot
}

const UPDATE_INTERVAL_MS = 100
// A candidate has to hold steady for this long before it actually commits — long enough that a
// jolt from a brisk swipe (which crosses a quadrant boundary for at most a couple of sensor
// samples) never survives to commit, but short enough that a genuine, deliberate re-grip of the
// device still reads as prompt. Only really tunable by feel on a real device — the Simulator
// reports no motion data at all.
const COMMIT_MS = 275
// Whichever screen-plane gravity axis is dominant has to beat the other by this multiple before a
// reading counts as confident — otherwise a near-diagonal hold produces no candidate at all, and
// the last committed state just holds instead of coin-flipping between two close axes.
const DOMINANCE_RATIO = 1.25
// Standard gravity in m/s² (accelerationIncludingGravity's own unit — resting gravity reads ~9.8,
// not ~1). A fixed physics constant, not device- or module-specific, so it's hardcoded here rather
// than read off the injected deviceMotion module (expo-sensors' own `DeviceMotion.Gravity` is this
// exact same value) — one less thing the local DeviceMotionModule mirror needs to cover.
const STANDARD_GRAVITY_MPS2 = 9.80665
// Below this combined magnitude there's essentially no usable tilt signal at all — most notably
// the phone lying flat on a table, where gravity points straight through the screen and gives zero
// information about which way it's rotated in that plane. Held (not guessed) below this threshold.
// Expressed as a fraction of standard gravity so this reads as "at least a 15%-of-g tilt" regardless
// of the underlying unit, roughly an 8-9° tilt off flat.
const MIN_GRAVITY_MAGNITUDE = STANDARD_GRAVITY_MPS2 * 0.15

interface Candidate {
  orientationMode: OrientationMode
  p1OnRight: boolean
  upsideDown: boolean
}

function sameCandidate(a: Candidate | null, b: Candidate): boolean {
  return a !== null && a.orientationMode === b.orientationMode && a.p1OnRight === b.p1OnRight && a.upsideDown === b.upsideDown
}

// x/y are accelerationIncludingGravity's own screen-plane components, in the device's local frame
// (not the OS's interface-orientation-adjusted one — see this file's own top comment for why that
// distinction matters now). Landscape reads as x dominant, portrait as y dominant; below
// MIN_GRAVITY_MAGNITUDE or too close to the diagonal between them, there's no confident call to
// make at all.
function candidateFromGravity(x: number, y: number): Candidate | null {
  const magnitude = Math.hypot(x, y)
  if (magnitude < MIN_GRAVITY_MAGNITUDE) return null
  if (Math.abs(x) > Math.abs(y) * DOMINANCE_RATIO) return { orientationMode: 'sideBySide', p1OnRight: x > 0, upsideDown: false }
  if (Math.abs(y) > Math.abs(x) * DOMINANCE_RATIO) return { orientationMode: 'faceToFace', p1OnRight: true, upsideDown: y > 0 }
  return null
}

// The actual sensor subscription — exactly one instance of this ever runs, inside
// OrientationProvider, rather than one per call site. Screens navigating away and back (title ->
// lobby -> game -> lobby, ...) each used to mount their OWN independent hook instance, which meant
// each one restarted from DEFAULT_STATE on mount — so putting the phone down flat right after
// rotating it, then navigating to a new screen, lost the just-committed orientation entirely (a
// fresh instance has no signal to read from a flat phone, and DEFAULT_STATE's guess is all it had
// left). Hoisting the subscription up to one shared Provider makes the committed value a property of
// the app's lifetime, not any one screen's mount lifecycle — matching how a real OS-level orientation
// reading would have persisted across navigation too.
export function useOrientationStateSource(deviceMotion?: DeviceMotionModule): OrientationState {
  const [state, setState] = useState<OrientationState>(DEFAULT_STATE)

  // Web has no accelerometer at all — falls back to exactly today's useWindowDimensions-based
  // reading, unchanged, rather than trying to make DeviceMotion mean something there. Computed
  // directly during render (below, after the native effect) rather than mirrored into `state` via
  // its own effect: it's already fully derived from webDimensions, so there's nothing to
  // synchronize — and computing it inline also means web's first render is correct immediately,
  // instead of one render of DEFAULT_STATE followed by an effect-driven correction.
  const webDimensions = useWindowDimensions()

  useEffect(() => {
    if (Platform.OS === 'web') return
    if (!deviceMotion) {
      // Same "nothing crashes, it just never resolves" degradation as no Provider mounted at all
      // (see OrientationStateProvider's own doc) — but worth a loud nudge here specifically, since
      // this one is easy to hit by accident: upgrading @tastic/core (or @tastic/hud, which pulls
      // this in transitively via useRotation) doesn't fail a build the way a missing module would;
      // it just silently stops tracking tilt, which reads as "the feature broke" rather than "a
      // prop is missing" days or weeks later.
      // typeof-guarded rather than a bare `__DEV__` reference (@rific/feedback-press's own
      // convention elsewhere) — Metro injects this global in every real RN/Expo app, but this
      // package's own Jest environment doesn't define it at all, and this file has to run in both.
      // eslint-disable-next-line no-console -- deliberate, one-time dev-only nudge for an easy-to-miss silent regression, not leftover debug output
      if (typeof __DEV__ === 'undefined' || __DEV__) console.warn('[@tastic/core] useOrientationState: no `deviceMotion` module was injected — pass `deviceMotion={DeviceMotion}` (from expo-sensors) to <OrientationProvider> for live tilt tracking on native. Without it, orientation stays at its unresolved default forever.')
      return
    }

    // Tracks the in-progress candidate and when it first appeared — plain closure variables, not
    // state/shared values, since only this effect's own listener ever reads or writes them and
    // there's nothing here that needs to trigger a re-render on its own.
    let pendingCandidate: Candidate | null = null
    let pendingSince = 0

    deviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS)
    const subscription = deviceMotion.addListener(({ accelerationIncludingGravity }) => {
      if (!accelerationIncludingGravity) return
      const candidate = candidateFromGravity(accelerationIncludingGravity.x, accelerationIncludingGravity.y)
      if (!candidate) {
        pendingCandidate = null
        return
      }
      if (!sameCandidate(pendingCandidate, candidate)) {
        pendingCandidate = candidate
        pendingSince = Date.now()
        return
      }
      if (Date.now() - pendingSince < COMMIT_MS) return
      setState((prev) => {
        if (prev.resolved && sameCandidate(prev, candidate)) return prev
        const next: OrientationState = { ...candidate, resolved: true }
        latestSnapshot = next
        return next
      })
    })

    return () => subscription.remove()
    // `deviceMotion` is the only real dependency — in practice always a stable module-namespace
    // reference (e.g. the imported `DeviceMotion` from expo-sensors), so this still only subscribes
    // once for the life of the Provider, just without lying about its own dependencies.
  }, [deviceMotion])

  if (Platform.OS === 'web') {
    // No way to detect upside-down from window dimensions alone — web never needed it either,
    // since the OS itself always handled real rotation there. p1OnRight is a fixed choice for the
    // same reason: there's no physical tilt to read a side from on a browser window, so this picks
    // left — matching reading order and the natural "player 1 goes first/leftmost" convention —
    // rather than defaulting to whatever the native accelerometer path happens to resolve `true` to.
    const webState: OrientationState = { orientationMode: webDimensions.width > webDimensions.height ? 'sideBySide' : 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true }
    latestSnapshot = webState
    return webState
  }

  return state
}

const OrientationStateContext = createContext<OrientationState>(DEFAULT_STATE)

// Mount exactly once, near the app's own root (above any screen that uses useOrientationState) — see
// useOrientationStateSource's own comment for why a single, app-lifetime subscription is what
// actually makes the committed orientation survive screen navigation. Without this Provider mounted,
// useOrientationState still works but silently falls back to the Context's static default and never
// updates — the same "nothing crashes, it just never resolves" failure mode a missing
// SafeAreaProvider has. `deviceMotion` is the app's own real `import { DeviceMotion } from
// 'expo-sensors'` — omit it (e.g. on a build that doesn't want the dependency at all) for the same
// graceful "never resolves" degradation, now also logged once in dev (see useOrientationStateSource).
// Exported for OrientationProvider (in ./OrientationProvider) to compose alongside the lock-settings
// context — not meant to be mounted directly by an app; see that file's own doc for the umbrella
// Provider apps actually use.
export interface OrientationStateProviderProps {
  children: ReactNode
  deviceMotion?: DeviceMotionModule
}

export function OrientationStateProvider({ children, deviceMotion }: OrientationStateProviderProps) {
  const state = useOrientationStateSource(deviceMotion)
  return <OrientationStateContext.Provider value={state}>{children}</OrientationStateContext.Provider>
}

// Replaces the old useDeviceOrientation + useP1OnRight + useOrientationLock trio now that the
// consuming app locks itself to portrait permanently at the OS level: useWindowDimensions can never
// report anything but portrait again, and there's no native orientation lock left to toggle. This
// reads the device's own physical tilt instead (via OrientationProvider's shared subscription — see
// that component's own doc), so orientationMode/p1OnRight keep following however the phone is
// actually being held, independent of what the OS thinks the window shape is.
//
// Deliberately not a live-every-sample signal at the source: a candidate only commits once it's
// held steady for COMMIT_MS, and produces no candidate at all when the tilt is too shallow or too
// diagonal to read confidently — including the phone lying flat on a table, where gravity gives no
// signal about which way it's rotated in that plane at all. In practice this means the reading
// settles once while a player tilts the phone to decide how to hold it (in a lobby, or before a
// match starts), then simply holds that committed value for as long as the phone stays flat during
// play — there's nothing left to re-evaluate against once the signal itself goes quiet, which is
// exactly the "nothing should happen mid-swipe" behavior gameplay needs, with no gameplay-specific
// special casing anywhere in this hook.
//
// `locked` freezes orientationMode/p1OnRight/upsideDown at whatever they last were the moment it
// became true — the same job useOrientationLock's own setting used to do at the OS level. Deliberately
// per-call-site (not pushed into the shared Provider above): different screens want different
// locking (e.g. the lobby's own "Lock Orientation" setting shouldn't also freeze a completely
// different screen's reading), and the underlying sensor subscription itself has no reason to ever
// stop listening just because one consumer locked its own view of it.
export function useOrientationState(locked = false): OrientationState {
  const shared = useContext(OrientationStateContext)
  // Kept in sync with `shared` on every render where this call site isn't locked, so whenever
  // `locked` flips to true, it freezes at whatever was current then rather than some stale earlier
  // snapshot. A ref would be simpler but isn't safe here — `frozen` is read as part of this same
  // render's return value, and a ref mutated during render can end up holding a value from a
  // render that never actually commits. Updating state directly in the render body (rather than in
  // an effect) is the React-sanctioned way to keep a value in sync with something derived from
  // render — see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [frozen, setFrozen] = useState(shared)
  if (!locked && frozen !== shared) setFrozen(shared)
  return locked ? frozen : shared
}

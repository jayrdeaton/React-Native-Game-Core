# @tastic/core

Required foundation for `@tastic/*` game packages. Every other `@tastic/*` package (present and
future — `@tastic/physics`, `@tastic/input`, and so on) can assume this is available and depends on
it directly, so anything genuinely domain-agnostic lives here rather than being duplicated in
whichever package happens to need it first.

## What it does

- **`Vec2`** — a `{x, y}` type plus `add`/`subtract`/`scale`/`length`/`distance`/`dot`/`normalize`.
  Used by collision/force math, drag/aim-vector tracking, and board/layout geometry alike, so it
  doesn't belong to any one of those.
- **`clamp(value, min, max)`** — keep a number within a range.
- **`computeClampedDt(timestamp, lastTimestamp, maxDt)`** — turns the raw gap between two
  `requestAnimationFrame` timestamps into a frame-rate-independent, clamped `dt` multiplier, so a
  single simulation/tick step never represents more time than `maxDt` nominal frames even after a
  stutter or a background/foreground cycle.
- **`useGameLoop(onTick, { enabled, maxDt })`** — drives `onTick(dt)` once per frame via
  `requestAnimationFrame` for as long as `enabled` is true, using `computeClampedDt` internally.
  Game-specific gating (pause state, game phase) stays out of the hook — compute your own `enabled`
  boolean and pass it in.
- **`useIsTouchPrimaryDevice()`** — best-effort environment-capability detection: is this player
  likely on touch (native, or a touch-primary web viewport) vs. likely to have a keyboard/mouse (a
  wide-viewport web browser with a fine pointer)? Useful for deciding whether to offer a
  keyboard-scheme picker or lean on touch/swipe controls. Always `true` on native.
- **Orientation tracking** — `OrientationProvider`, `useOrientationState`, `useRotation`,
  `useOrientationLock`, `FakeLandscapeView`, `useRotatedWindowDimensions`, and the pure
  `getViewRotation`/`getFixedZoneRotation`/`getOpposingZoneRotation`/`rotateInsets`/
  `rotateDimensions` geometry helpers. See its own section below —
  [`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen) is built on top
  of this for its two-player zone layout, and [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud)'s
  popovers/dialogs read `useRotation()` directly to stay legible inside a rotated zone.
- **`createGameSettingsProvider(config)`** — generalizes the identical `GameSettingsProvider`/
  `useGameSettings()` pair hand-rolled once per app in AirHockey, BoxHockey, Pong, and LightCycles
  (an AsyncStorage-backed `settings` + `setSettings`, an `activeRoundSettings`/`commitRoundSettings`
  snapshot pair, and `isActivelyPlaying` wiring into `@tastic/edge-guard`'s `useEdgeGestureGuard`).
  See its own section below.
- **`useThemedRootBackground(dark, gestureEnabled?)`** — fixes an OS-level corner-flash during
  react-native-screens push/pop transitions (the root window's own background — white by default —
  showing through at the display's rounded corners while a transition is mid-flight) by syncing that
  root window's background to the live theme via `expo-system-ui`, and returning the matching screen
  options for a root `<Stack>`. See its own section below.
- **`SettingsAndProfilesGate`** — generalizes the nested `'settings'`-then-`'profiles'` splash-gate
  composition hand-rolled 3 different ways across AirHockey, BoxHockey, Pong, and LightCycles, all on
  top of `@rific/splash-gate`'s `createGate`. See its own section below.

## Usage

```ts
import { clamp, computeClampedDt, distance, useGameLoop, useIsTouchPrimaryDevice, type Vec2 } from '@tastic/core'

function useMyGameLoop(step: (dt: number) => void, enabled: boolean) {
  useGameLoop(step, { enabled, maxDt: 2.5 })
}
```

## Orientation tracking

An app permanently locked to portrait at the OS level (no native rotation left to read) can still
fake it by reading the device's own physical tilt directly — this is the shared foundation both
[`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen) (two-player zone
layout) and [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud) (popovers/dialogs that
need to rotate in place inside one) build on.

Mount `OrientationProvider` once, near your app's root — above every screen that reads orientation,
so the committed reading survives navigation instead of each screen restarting its own sensor
subscription from scratch. This package never imports `expo-sensors` itself (a real top-level
import would force every consumer — even one with zero interest in tilt tracking — to have it
installed, or their bundler would fail to resolve it): your app does its own real
`import { DeviceMotion } from 'expo-sensors'` and hands the resolved module in as a prop.

```tsx
import { OrientationProvider } from '@tastic/core'
import { DeviceMotion } from 'expo-sensors'

// App root
<OrientationProvider deviceMotion={DeviceMotion}>
  <AppNavigator />
</OrientationProvider>
```

Omitting `deviceMotion` degrades gracefully — every hook below still works, it just never resolves
past its unresolved default (logged once in dev via `console.warn`, so it's easy to notice if it's
accidental) — the same "nothing crashes, it just never resolves" failure mode a missing
`SafeAreaProvider` has. An app with no rotation feature at all can skip mounting the Provider
entirely; every consumer (including `@tastic/hud`'s components) reads an inert default in that case.

```tsx
import { getViewRotation, rotateInsets, useOrientationState, useRotation } from '@tastic/core'

function TitleScreen() {
  // orientationMode/p1OnRight/upsideDown are derived from the device's own physical tilt, not the
  // OS's own rotation. `lockOrientationSetting` freezes all three at whatever they last committed,
  // the same job an app-level "Lock Orientation" preference toggle already wants.
  const { orientationMode, p1OnRight, upsideDown } = useOrientationState(lockOrientationSetting)
  const rotation = getViewRotation(orientationMode, p1OnRight, upsideDown)
  const insets = rotateInsets(useSafeAreaInsets(), rotation)

  // useRotation(locked?) collapses the two calls above into one, for the common case where only
  // the final angle is needed (this is what @tastic/hud's components use internally):
  // const rotation = useRotation(lockOrientationSetting)
}
```

`useOrientationLock()` is a small, separate "is rotation locked" setting — `{ locked, setLocked }`
over a patch-based context, mirroring `@rific/feedback-press`'s `useSoundSettings`/`useHapticSettings`
shape. Like the rest of this package, it holds live state only; your app decides where (or whether)
that setting is persisted, via `OrientationProvider`'s own `lockInitialValue`/`onLockChange` props.

### Whole-screen content: `FakeLandscapeView` / `useRotatedWindowDimensions`

For single-perspective, whole-screen content (a title screen, a settings dialog, or — with care, see
its own warning below — an entire game screen), wrap it in `FakeLandscapeView` instead of hand-rolling
the rotation yourself:

```tsx
import { FakeLandscapeView } from '@tastic/core'

function TitleScreen() {
  return (
    <FakeLandscapeView style={{ flex: 1 }}>
      <YourContent />
    </FakeLandscapeView>
  )
}
```

It swaps width/height for a genuine 90°/-90° hold (the standard "fake landscape inside a
portrait-locked app" trick) and does a plain in-place rotate for 180°, reading the same ambient
`useOrientationState()` every other hook here does (all three orientation props — plus `locked` — can
be passed explicitly instead, for a caller whose own reading needs to differ from the live one, e.g.
a fading dual-zone layout mid-transition).

**Safe for tap-driven content** — React Native's own touch responder system hit-tests against the
rendered/transformed layout correctly. **NOT safe for continuous gesture tracking**
(react-native-gesture-handler's translation deltas read raw, untransformed native coordinates) —
never wrap a game board/touch layer in this without independently verifying your own gesture code
agrees with it under rotation.

`useRotatedWindowDimensions(locked?)` is the dimensions analog of `rotateInsets` above — for a
caller rendering *inside* a `FakeLandscapeView`-style ancestor that needs its own width/height budget
(a card-layout column count, a tableau height cap) to reflect the post-rotation footprint that
ancestor actually presents, since plain `useWindowDimensions()` never changes under a fake rotation
(the OS still thinks it's portrait):

```tsx
import { useRotatedWindowDimensions } from '@tastic/core'

function GameBoard() {
  const { width, height } = useRotatedWindowDimensions()
  // size your own layout off `width`/`height`, not raw useWindowDimensions()
}
```

`rotateDimensions(width, height, rotation)` is the pure function underneath both `FakeLandscapeView`
and `useRotatedWindowDimensions` — swaps width/height for `±90°`, passes `0°`/`180°` through
unchanged — exposed directly for a caller doing its own composition.

### Root layout & orientation: `RotationAwareStatusBar`

The OS status bar is physically glued to the device's top edge and can't itself rotate to match —
so the moment `FakeLandscapeView`/`getViewRotation` have spun anything else on screen into
`sideBySide` (±90°) or upside-down `faceToFace` (180°), a status bar left showing renders sideways or
upside-down against content that's otherwise correctly compensated. `RotationAwareStatusBar` hides
the real status bar whenever this package's own rotation reading says the screen is currently
rotated, and shows it only at `0°`:

```tsx
import { RotationAwareStatusBar } from '@tastic/core'

function AppRotationAwareStatusBar() {
  const { settings } = useGameSettings() // or your own equivalent lockOrientation source
  return <RotationAwareStatusBar locked={settings.lockOrientation} />
}
```

**`locked` must be threaded through from your app's own "Lock Orientation" setting — the same value
you already pass to `useOrientationState`/`useRotation` elsewhere.** It's optional in the type
(`locked?: boolean`, defaulting to `false`) only so a bare `<RotationAwareStatusBar />` matches what a
bare `useOrientationState()` call would do; it is not optional in practice for any app that has a
lock-orientation setting at all. Omitting it silently falls back to "always track live tilt" — so the
moment a player locks orientation and keeps tilting the device, this bar keeps hiding/showing itself
off the live tilt reading while the rest of the screen has correctly frozen, and the two visibly
diverge. This was a real bug in 4 of the 5 apps that hand-rolled this component before it was
extracted here; only one had it right — the whole reason it's a package component now instead of
another hand-rolled copy is to make that divergence impossible to reintroduce.

Render your wrapper (`AppRotationAwareStatusBar` above, or whatever you call it) *inside* whatever
provider tree actually holds the `lockOrientation` value it reads — your settings/Redux provider —
not in a root layout component that itself renders that provider. Put it outside that tree and the
hook backing `settings.lockOrientation` runs without the context it needs, which either crashes or
silently reads stale/default data depending on how that hook is written.

## Game settings: `createGameSettingsProvider`

Every `@tastic/*` game app persists a `settings` object to AsyncStorage, exposes it (and a
`setSettings` patcher) via context, snapshots it into a locked `activeRoundSettings` when a round
starts, and wires a live `isActivelyPlaying` flag into
[`@tastic/edge-guard`](https://github.com/jayrdeaton/react-native-edge-guard)'s
`useEdgeGestureGuard`. Call this factory once, at module scope, with your own settings type instead
of hand-rolling that ~100-line file again:

```ts
// src/hooks/useGameSettings.tsx
import { createGameSettingsProvider } from '@tastic/core'

import { GameSettings } from '@/types'
import { DEFAULT_SETTINGS, isValidSettings } from '@/utils/gameSettingsValidation'

export const { GameSettingsProvider, useGameSettings } = createGameSettingsProvider<GameSettings>({
  storageKey: 'yourgame.settings',
  defaultSettings: DEFAULT_SETTINGS,
  isValidSettings
})
```

`TSettings` must include a `deferBottomEdgeGestures: boolean` field — the `useEdgeGestureGuard` call
inside the returned `GameSettingsProvider` unconditionally reads it, combined with the live
`isActivelyPlaying` flag also exposed on the returned context value. `isValidSettings` must be a type
predicate (`(value: unknown) => value is TSettings`), matching what every app's own
`gameSettingsValidation.ts` already writes by hand — nothing to adapt to pass yours in directly.

A stored blob is merged onto `defaultSettings` *before* being validated, not after: a blob written
before some field existed on `TSettings` is missing that field entirely, and validating it as-is
would reject the whole blob over that one missing field rather than just losing the field(s) it
predates. `loaded` flips `true` once this initial read has resolved one way or another (a real
value, nothing stored, a corrupt blob, or unavailable storage all count) — thread it into your own
splash gate the same way every consuming app already does, so nothing downstream ever reads a
still-loading value.

`activeRoundSettings`/`commitRoundSettings` and `isActivelyPlaying`/`setIsActivelyPlaying` are held
only in memory, never persisted — a round-start screen calls `commitRoundSettings(settings)` once to
lock in the round about to play, and whatever owns "is a round actually live right now" calls
`setIsActivelyPlaying` to keep Edge Guard scoped to real gameplay.

## Root window background: `useThemedRootBackground`

react-native-screens' push/pop transition animates two screens' native views directly over the OS
root window, so whatever that window's own background is left at (white, by default) shows through
at the display's rounded corners for the duration of the transition, wherever the sliding content
hasn't caught up to the corner-radius mask yet. `contentStyle` (the screen-level backing) is a
separate layer from the root window itself and doesn't fix this alone — both are needed together,
matching every fleet app (AirHockey, BoxHockey, Pong, LightCycles, Snake) that had already
independently hand-rolled this exact pairing byte-for-byte before it was extracted here.

`useThemedRootBackground(dark, gestureEnabled?)` returns the matching options for a root
`<Stack screenOptions={...}>`, and fires the `expo-system-ui` call twice: once at module-import time
(`'#000000'` is just the earliest possible guess, before any component or the live theme is known),
and again inside a `useEffect` keyed on `dark` every time a consumer actually calls the hook with a
known theme:

```tsx
import { useThemedRootBackground } from '@tastic/core'
import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'

export default function RootLayout() {
  const dark = useColorScheme() === 'dark'

  return <Stack screenOptions={useThemedRootBackground(dark, false)} />
}
```

It's a hook, not a wrapping component, unlike `RotationAwareStatusBar` above (this package's existing
precedent for a root-`_layout.tsx` helper) — some fleet apps' root `<Stack>` renders explicit
`<Stack.Screen>` children, and a hook returning a plain options object composes with both that shape
and a bare `<Stack screenOptions={...} />` for free, where a wrapping component would need its own
`children` passthrough prop for the first shape alone.

`gestureEnabled` (default `false`) is a parameter, never hardcoded inside the hook, because disabling
it addresses a logically separate concern from the corner-flash fix — iOS's native swipe-back gesture
fighting an in-game swipe/Pan gesture on a specific screen — that won't apply to every future
consumer. Every current fleet app happens to want `false` today; document your own reason for the
value you pass at your own call site.

This is `@tastic/core`'s first module-scope side effect — a real call that fires the instant the
module is evaluated, not gated behind any function call. It's harmless in practice because `tsup`
bundles the whole package into a single `dist/index.js`/`dist/index.mjs` per format, so there's no
per-file boundary for a downstream bundler to exploit by dropping just this call while keeping the
hook itself — but it's worth knowing about if you're auditing why a package declaring
`"sideEffects": false` still has one.

## Splash gating: `SettingsAndProfilesGate`

For an app built on the AsyncStorage-backed `GameSettingsProvider`/`ProfilesProvider` architecture
plus `@rific/splash-gate`'s `createGate` (AirHockey, BoxHockey, Pong, and LightCycles) — not Snake,
which persists its settings through Redux Toolkit and `redux-persist`'s own `PersistGate` instead, an
entirely separate mechanism — `SettingsAndProfilesGate` generalizes the nested
`'settings'`-then-`'profiles'` gate composition each of those 4 apps had hand-rolled 3 different ways
(a merged `GatedApp` component in two of them, two separately-named components in the other two): a
`'settings'` gate outside a `'profiles'` gate around everything that reads either provider's context,
so no screen mounts on stale AsyncStorage defaults before the real (or, for profiles,
shared-App-Group-reconciled) value has loaded.

```tsx
import { SettingsAndProfilesGate } from '@tastic/core'

import { useGameSettings } from '@/hooks/useGameSettings'
import { useProfiles } from '@/hooks/useProfiles'
import { SplashGate } from '@/utils/splashGate'

function GatedApp({ children }: { children: React.ReactNode }) {
  const { loaded: settingsLoaded } = useGameSettings()
  const { loaded: profilesLoaded } = useProfiles()

  return (
    <SettingsAndProfilesGate Gate={SplashGate} settingsLoaded={settingsLoaded} profilesLoaded={profilesLoaded}>
      {children}
    </SettingsAndProfilesGate>
  )
}
```

`Gate` takes the app's own bound `Gate` component from `createGate([...])` **as a prop** — this
package deliberately never takes a dependency on `@rific/splash-gate` itself, the same "take the
concrete thing as a prop, don't import what produces it" choice `OrientationProvider` already makes
for `deviceMotion`/`expo-sensors`. A per-app bound `Gate` is inherently non-shareable anyway:
`createGate()` returns a closure holding a real, singleton, per-app pending-`Set` and calls the real
`SplashScreen.hideAsync()`, so there's no single shared instance this package could own even if it
wanted to. The prop type this component expects (`(props: { gate: 'settings' | 'profiles'; ready:
boolean; children: ReactNode }) => ReactNode`) is deliberately narrower than any real app's bound
`Gate` (typed for that app's full gate-name union, e.g. also `'theme'`/`'haptics'`/`'sound'`/
`'fonts'`) — TypeScript's contravariant parameter checking accepts this safely as long as
`'settings'`/`'profiles'` are members of your own union.

`settingsLoaded`/`profilesLoaded` are plain boolean props rather than hook calls this component makes
itself, because `useGameSettings()`/`useProfiles()` are app-local hooks in every consumer, not
exported by any shared package — you still need your own small wrapper (`GatedApp` above, or whatever
you call it) beneath both providers to supply them. Nesting order (settings outer, profiles inner)
matches every app's prior implementation, and it's preserved even though it has no observable effect
today, since no consumer currently passes a custom `fallback` to either gate (both default to `null`).

## Install

Published to the public npm registry as `@tastic/core`. Everything described above, including
`FakeLandscapeView`, `useRotatedWindowDimensions`, `rotateDimensions` (moved here from
`@tastic/split-screen`, which never had any real dependency on that package's own two-player
pieces), `RotationAwareStatusBar`, `useThemedRootBackground`, and `SettingsAndProfilesGate`, is live
on npm.

```bash
npm install @tastic/core
```

## Peer dependencies

`react` (>=19.0.0) and `react-native` (>=0.76.0) — required for the whole package. `Vec2`/`clamp`/
`computeClampedDt` are plain, dependency-free TypeScript in source, but the package ships as one
bundle alongside the hooks that do need them, so both are needed to load any of it. This is a React
Native toolkit either way, so every real consumer already has both installed regardless.

`@react-native-async-storage/async-storage` (>=2.0.0) and `@tastic/edge-guard` (>=0.1.0) are real
(non-peer-optional) dependencies too, needed only by `createGameSettingsProvider` — imported
directly there, the same call `RotationAwareStatusBar` already made for `expo-status-bar`: every
app in this package's own fleet already depends on both directly at the same versions, so requiring
them package-wide adds no new install burden.

`expo-system-ui` (>=57.0.0) is a real (non-peer-optional) dependency too, needed only by
`useThemedRootBackground` — imported directly there, the same way `createGameSettingsProvider`
already depends directly on `@react-native-async-storage/async-storage` and `@tastic/edge-guard`
above: every app in this package's own fleet already depends on it directly at the same range, so
requiring it package-wide adds no new install burden. `SettingsAndProfilesGate` needs no new peer
dependency of its own, since it never imports `@rific/splash-gate` — see its own section above.

**Deliberately not a dependency: `expo-sensors`.** Orientation tracking needs it, but this package
never imports it directly — see the injection pattern in the Orientation tracking section above.
This keeps `expo-sensors` from being forced onto a consumer that only wants `clamp`/`useGameLoop`/
etc. and has no interest in tilt tracking at all.

### `portraitWhileKeyboard`: keeping a faked landscape usable when the keyboard opens

An app that stays portrait-locked at the OS level and fakes landscape by turning a `View` cannot turn the **keyboard**: iOS draws it in
the app's real interface orientation, so it always opens portrait relative to the device - sideways to a player holding the phone in a
faked landscape, and covering the wrong part of the turned screen. Set `portraitWhileKeyboard` on `<OrientationProvider>` and every
consumer of the shared reading (`useRotation`, `useRotatedWindowDimensions`, `useOrientationState`, `FakeLandscapeView`,
`RotationAwareStatusBar`, and anything built on them) reads **portrait** for as long as the *software* keyboard is showing, and the real
orientation again when it hides:

```tsx
<OrientationProvider deviceMotion={DeviceMotion} portraitWhileKeyboard>
```

The player turns the phone upright to type; the view turns back when the keyboard closes. Nothing remounts (only the reading changes), so
a host that keeps its tree identical across angles - as `FakeLandscapeView` does - keeps its state and its focused text field. A hardware
keyboard raises no keyboard events and web has none, so neither triggers it. Only what consumers *read* is overridden: the sensor
underneath keeps tracking the physical hold, and `getOrientationSnapshot()` still returns it. Off by default. `useKeyboardVisible(enabled?)`
is exported too, for a caller that just wants to know whether the software keyboard is up.

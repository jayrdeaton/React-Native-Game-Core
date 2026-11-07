# @tastic/core

Required foundation for `@tastic/*` game packages. Every other `@tastic/*` package (present and
future - `@tastic/physics`, `@tastic/input`, and so on) can assume this is available and depends on
it directly, so anything genuinely domain-agnostic lives here rather than being duplicated in
whichever package happens to need it first.

## What it does

- **`Vec2`**: a `{x, y}` type plus `add`/`subtract`/`scale`/`length`/`distance`/`dot`/`normalize`.
  Used by collision/force math, drag/aim-vector tracking, and board/layout geometry alike, so it
  doesn't belong to any one of those.
- **`clamp(value, min, max)`**: keep a number within a range.
- **`computeClampedDt(timestamp, lastTimestamp, maxDt)`**: turns the raw gap between two
  `requestAnimationFrame` timestamps into a frame-rate-independent, clamped `dt` multiplier, so a
  single simulation/tick step never represents more time than `maxDt` nominal frames even after a
  stutter or a background/foreground cycle.
- **`useGameLoop(onTick, { enabled, maxDt })`**: drives `onTick(dt)` once per frame via
  `requestAnimationFrame` for as long as `enabled` is true, using `computeClampedDt` internally.
  Game-specific gating (pause state, game phase) stays out of the hook - compute your own `enabled`
  boolean and pass it in.
- **`useIsTouchPrimaryDevice()`**: best-effort environment-capability detection: is this player
  likely on touch (native, or a phone's or tablet's browser: a touch screen without a mouse or
  trackpad as its primary pointer) vs. at a computer (any other browser, however thin its window)?
  Useful for deciding whether to offer a keyboard-scheme picker or lean on touch/swipe controls.
  Always `true` on native.
- **`useBackgroundPause(shouldPause)`** - latches a pause when the app leaves the foreground mid-match
  and holds it until the player taps Resume. See its own section below.
- **Seat mode**: `useOrientationState` reads side by side or face to face from the window's shape, for
  [`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen)'s two-player layout.
  Until 0.15 this package read the accelerometer and drew every turn itself; see "Seat mode and
  orientation (0.15)" below.
- **`@tastic/core/interface-orientation`**: turns DeviceMotion tilt into the axes of a screen the OS
  has turned. See its own section below.
- **`useThemedRootBackground(dark, gestureEnabled?)`**: fixes an OS-level corner-flash during
  react-native-screens push/pop transitions (the root window's own background - white by default -
  showing through at the display's rounded corners while a transition is mid-flight) by syncing that
  root window's background to the live theme via `expo-system-ui`, and returning the matching screen
  options for a root `<Stack>`. See its own section below.

## Usage

```ts
import { clamp, computeClampedDt, distance, useGameLoop, useIsTouchPrimaryDevice, type Vec2 } from '@tastic/core'

function useMyGameLoop(step: (dt: number) => void, enabled: boolean) {
  useGameLoop(step, { enabled, maxDt: 2.5 })
}
```

### Math-only entry: `@tastic/core/math`

`clamp` and the `Vec2` helpers (`add`, `distance`, `dot`, `length`, `normalize`, `scale`,
`subtract`) are also published on their own entry point, with no imports and no side effects:

```ts
import { clamp, length, scale, type Vec2 } from '@tastic/core/math'
```

The root entry re-exports the same functions, so existing imports keep working. Headless code
(`@tastic/input`, `@tastic/physics`, `@tastic/sprites`, or an app's own physics step) should prefer the
subpath: importing the root barrel loads every app-level module behind it (`expo-system-ui`) and runs
`useThemedRootBackground`'s import-time root background call. `package.json`'s `sideEffects` lists only
the root entry, so bundlers can still tree-shake the math entry.

## Seat mode and orientation (0.15)

The OS turns the interface now. A phone app that only makes sense upright keeps `"orientation":
"portrait"` in `app.json`; tablets, and any app that wants it, follow the OS (no `requireFullScreen`, so
Split View and Stage Manager work). This package no longer reads the accelerometer or draws any turn.

`useOrientationState(locked?)` returns the seat mode for the window: `sideBySide` when it's wider than
tall, `faceToFace` otherwise, the rule web always used. `p1OnRight` and `upsideDown` are always false and
`resolved` always true. It follows the window live (a tablet turning, a browser window resized);
`locked` freezes that one call site at the value it had when `locked` turned true, for example a round's
layout. `getOrientationSnapshot()` is the same answer read once, without a subscription. No provider is
needed.

```tsx
import { useOrientationState } from '@tastic/core'

const { orientationMode } = useOrientationState(roundInProgress)
```

### Removed in 0.15

- **The Expo config plugin.** Take `"@tastic/core"` out of `app.json`'s `plugins`: prebuild fails while
  it's listed. It set `orientation: "portrait"`, `ios.requireFullScreen`, a Portrait-only iPad list,
  Android's `appCategory="game"` and `UIViewControllerBasedStatusBarAppearance`. Set
  `UIViewControllerBasedStatusBarAppearance: true` in `ios.infoPlist` yourself if the app sets the status
  bar through native-stack screen options: react-native-screens needs it, and an app linked against the
  iOS 27 SDK can't set the bar app-wide any more. Then make a new native build.
- **`OrientationProvider`'s props** (`deviceMotion`, `lockInitialValue`, `onLockChange`,
  `freezeWhileLocked`, `portraitWhileKeyboard`, `allowedRotations`). It renders its children and nothing
  else, and goes once `@tastic/split-screen` stops re-exporting it.
- **`useOrientationLock`, `OrientationLockSettings`, `useKeyboardVisible`** and the
  `DeviceMotionModule`/`DeviceMotionMeasurement`/`DeviceMotionListener` types. The OS's own rotation lock
  replaces an in-app Lock Orientation.
- **The `@rific/core` and `expo` peers**, which only the lock and the plugin needed.

### Kept for now, doing nothing

These keep their signatures so `@tastic/hud` and `@tastic/split-screen` work unchanged, and go once
nothing calls them:

- `useRotation()` returns 0, and `useRotatedWindowDimensions()` returns the window's own size.
- `useRotationAwareStatusBar({ style, animation })` never hides the bar; it still passes `style` and
  `animation` through as `statusBarStyle`/`statusBarAnimation`.
- `getViewRotation` returns 0 for side by side (180 only for an explicit upside-down face to face), so
  `getFixedZoneRotation` is always 0.
- `FakeLandscapeView` draws no turn unless it's given an explicit `rotation` (hud's `RotatedFrame`). Its
  element tree is still the same at every angle, so a turn never remounts its children.
- `rotateInsets`, `rotateDimensions`, `toRotationStyle`, `getOpposingZoneRotation` and the `ViewRotation`
  type are pure and unchanged. Player 2's 180 in a face-to-face layout still uses the last two.

## Tilt on a turned screen: `@tastic/core/interface-orientation`

DeviceMotion reports tilt in the device's own frame, so once the OS turns the interface, tilting toward
the right of a landscape screen reads as tilting toward its top. This entry turns the reading into the
screen's axes:

```ts
import { tiltToScreenAxes, trackInterfaceOrientation } from '@tastic/core/interface-orientation'
import { DeviceMotion } from 'expo-sensors'

useEffect(() => {
  const interfaceOrientation = trackInterfaceOrientation()
  const subscription = DeviceMotion.addListener(({ rotation, orientation }) => {
    if (!rotation) return
    const { x, y } = tiltToScreenAxes(rotation.gamma, rotation.beta, interfaceOrientation.current(orientation))
    // x is toward the screen's right, y toward its bottom, in gamma/beta's units (radians)
  })
  return () => {
    subscription.remove()
    interfaceOrientation.remove()
  }
}, [])
```

- `trackInterfaceOrientation()` reads expo-screen-orientation once and follows every turn, without
  re-rendering anything. On iOS the module reports `UNKNOWN` from launch until the interface first
  turns; until then `current(heldRotation)` decides from the window's shape (portrait or landscape) and
  DeviceMotion's own `orientation` (which side). Android always reads the display.
- `tiltToScreenAxes(gamma, beta, orientation)` is the pure mapping. It follows the interface orientation,
  not the physical hold, so it stays right with the system rotation lock on.
- `interfaceOrientationFromHold(windowIsLandscape, heldRotation, previous)` is the iOS stand-in on its own.

It has its own entry because it imports `expo-screen-orientation`, an optional peer the root barrel must
never load. It never calls that module's lock APIs.

## Root window background: `useThemedRootBackground`

react-native-screens' push/pop transition animates two screens' native views directly over the OS
root window, so whatever that window's own background is left at (white, by default) shows through
at the display's rounded corners for the duration of the transition, wherever the sliding content
hasn't caught up to the corner-radius mask yet. `contentStyle` (the screen-level backing) is a
separate layer from the root window itself and doesn't fix this alone - both are needed together,
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

It's a hook returning screen options, like `useRotationAwareStatusBar` above - some fleet apps' root `<Stack>` renders explicit
`<Stack.Screen>` children, and a hook returning a plain options object composes with both that shape
and a bare `<Stack screenOptions={...} />` for free, where a wrapping component would need its own
`children` passthrough prop for the first shape alone.

`gestureEnabled` (default `false`) is a parameter, never hardcoded inside the hook, because disabling
it addresses a logically separate concern from the corner-flash fix - iOS's native swipe-back gesture
fighting an in-game swipe/Pan gesture on a specific screen - that won't apply to every future
consumer. Every current fleet app happens to want `false` today; document your own reason for the
value you pass at your own call site.

This is `@tastic/core`'s first module-scope side effect - a real call that fires the instant the
module is evaluated, not gated behind any function call. It's harmless in practice because `tsup`
bundles the whole package into a single `dist/index.js`/`dist/index.mjs` per format, so there's no
per-file boundary for a downstream bundler to exploit by dropping just this call while keeping the
hook itself - but it's worth knowing about if you're auditing why a package declaring
`"sideEffects": false` still has one.

## Pausing when the app backgrounds: `useBackgroundPause`

A phone call, an app switch or a swipe into Control Center mid-rally would otherwise hand the player a
ball already in play the moment they come back. `useBackgroundPause(shouldPause)` returns
`{ backgroundPaused, resume }`: `backgroundPaused` turns true when `AppState` leaves `'active'`
(`'background'`, or iOS's `'inactive'`) while `shouldPause()` returns true, and it stays true after the
app returns. Only `resume()` clears it, so fold it into the game's own `paused` and show a Paused dialog
whose Resume button calls `resume()`:

```tsx
import { useBackgroundPause } from '@tastic/core'

const { backgroundPaused, resume } = useBackgroundPause(() => phaseRef.current === 'playing' && !dialogOpenRef.current)
const paused = dialogOpen || backgroundPaused
```

`shouldPause` is a lazy getter, read only at the moment the app leaves the foreground, so it can look at
state that is computed after `paused` (the game's phase) without a circular render dependency. Return
false when there is nothing to protect (the match is over) or the game's own dialog already holds the
pause. Web needs nothing extra: react-native-web's `AppState` reports `'background'` while the tab is
hidden.

## Install

Published to the public npm registry as `@tastic/core`.

Game settings are not this package's job anymore: `createGameSettingsProvider` and
`SettingsAndProfilesGate` were removed on 2026-10-07. The games keep their settings in Redux with
`@rific/core`'s `createSettingsSlice`, and `PersistGate` already holds rendering until they load.

```bash
npm install @tastic/core
```

## Peer dependencies

`react` (>=19.0.0) and `react-native` (>=0.76.0) - required for the whole package. `Vec2` and `clamp` are
also available from the dependency-free `@tastic/core/math` entry (see Usage), which loads without
any of the peers below; the root entry needs all of them. This is a React
Native toolkit either way, so every real consumer already has both installed regardless.

`expo-system-ui` (>=57.0.0) is a real (non-peer-optional) dependency too, needed only by
`useThemedRootBackground`, imported directly there: every app in this package's own fleet already
depends on it directly at the same range, so requiring it package-wide adds no new install burden.

`expo-screen-orientation` (>=58.0.0) is optional: only the `@tastic/core/interface-orientation` entry
imports it.

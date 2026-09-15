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

## Install

Published to the public npm registry as `@tastic/core`. `FakeLandscapeView`,
`useRotatedWindowDimensions`, and `rotateDimensions` (moved here from `@tastic/split-screen`, which
never had any real dependency on that package's own two-player pieces) are newer than the latest
published version, though — for now they only exist in local, `yalc`-linked builds (see below) until
published for real. Everything else described above, including the rest of the orientation-tracking
feature, is already live on npm.

```bash
npm install @tastic/core
```

### Local dev via yalc (for unpublished changes)

```bash
cd react-native-game-core
npm run build
yalc publish

cd ../your-game
yalc add @tastic/core
npm install
```

Re-run `npm run build && yalc push` from this package after any change to propagate it to every
linked consumer at once.

## Peer dependencies

`react` (>=19.0.0) and `react-native` (>=0.76.0) — required for the whole package. `Vec2`/`clamp`/
`computeClampedDt` are plain, dependency-free TypeScript in source, but the package ships as one
bundle alongside the hooks that do need them, so both are needed to load any of it. This is a React
Native toolkit either way, so every real consumer already has both installed regardless.

**Deliberately not a dependency: `expo-sensors`.** Orientation tracking needs it, but this package
never imports it directly — see the injection pattern in the Orientation tracking section above.
This keeps `expo-sensors` from being forced onto a consumer that only wants `clamp`/`useGameLoop`/
etc. and has no interest in tilt tracking at all.

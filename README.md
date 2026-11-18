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
  `requestAnimationFrame` for as long as `enabled` is true, using `computeClampedDt` internally
  (`maxDt` defaults to 2.5). Game-specific gating (pause state, game phase) stays out of the hook -
  compute your own `enabled` boolean and pass it in.
- **`NOMINAL_FRAME_MS`**: one nominal 60 fps frame in milliseconds (`1000 / 60`), the unit `dt` is
  measured in, so `dt * NOMINAL_FRAME_MS` is the frame's time in milliseconds.
- **`createFixedStepAccumulator(stepMs, maxSteps)`**: runs a simulation at a fixed step from that
  variable frame time, exactly. See its own section below.
- **`createFixedStepState`, `advanceFixedStep`, `fixedStepAlpha`, `resetFixedStep`**: the same
  bookkeeping as plain `'worklet'` functions on a plain object, for a simulation stepped on the UI
  thread in a Reanimated frame callback. Also in that section.
- **`useIsTouchPrimaryDevice()`**: best-effort environment-capability detection: is this player
  likely on touch (native, or a phone's or tablet's browser: a touch screen without a mouse or
  trackpad as its primary pointer) vs. at a computer (any other browser, however thin its window)?
  Useful for deciding whether to offer a keyboard-scheme picker or lean on touch/swipe controls.
  Always `true` on native.
- **`useBackgroundPause(shouldPause)`** - latches a pause when the app leaves the foreground mid-match
  and holds it until the player taps Resume. See its own section below.
- **`computeContentBounds(windowWidth, maxContentWidth)`**: caps a width at `maxContentWidth` and
  splits what's left into two equal gutters, returning `{ contentWidth, gutterWidth }` (letterboxing a
  wide web or tablet layout). Pure: pass the width yourself. `Number.POSITIVE_INFINITY` means no cap
  (`gutterWidth` 0). `@tastic/hud`'s `ContentGutter` is built on it.
- **`useSettledWindowDimensions()`** and **`useSettledLayout()`**: window and container sizes that settle
  on the web. See "Sizes that settle on the web" below.
- **Seat mode**: `useOrientationState` reads side by side or face to face from the window's shape, for
  [`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen)'s two-player layout.
  Until 0.15 this package read the accelerometer and drew every turn itself; see "Seat mode and
  orientation (0.15)" below.
- **Turning content by an angle**: `FakeLandscapeView`, `rotateInsets`, `rotateDimensions` and
  `toRotationStyle`, for content drawn to face another seat (player 2's side of a face-to-face screen).
  See "Turning content by an angle" below.
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

The fixed step (`createFixedStepAccumulator` and the worklet `createFixedStepState` family, below) is on this
entry too, for a simulation stepped on the UI thread or headless. The root entry re-exports the same functions, so existing imports keep working. Headless code
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
  `freezeWhileLocked`, `portraitWhileKeyboard`, `allowedRotations`). It only rendered its children from
  then on, and went altogether in 0.18 (below).
- **`useOrientationLock`, `OrientationLockSettings`, `useKeyboardVisible`** and the
  `DeviceMotionModule`/`DeviceMotionMeasurement`/`DeviceMotionListener` types. The OS's own rotation lock
  replaces an in-app Lock Orientation.
- **The `@rific/core` and `expo` peers**, which only the lock and the plugin needed.

### Removed in 0.18

0.15 left these in place, doing nothing, until `@tastic/hud` stopped calling them (hud 0.34.0 and later;
an app that takes core 0.18 takes that hud with it):

- **`OrientationProvider`**, which only rendered its children. Unwrap them.
- **`useRotation()`** (always 0) and **`useRotatedWindowDimensions()`** (the window's own size). Use 0 and
  `useWindowDimensions()`.
- **`useRotationAwareStatusBar()`**, which never hid the bar, and its `RotationAwareStatusBarOptions`,
  `RotationAwareStatusBarScreenOptions`, `StatusBarStyle` and `StatusBarAnimation` types. Set
  `statusBarStyle` and `statusBarAnimation` in the native stack's screen options yourself.
- **`getViewRotation`** (0, or 180 for an explicit upside-down face to face), **`getFixedZoneRotation`**
  (always 0) and **`getOpposingZoneRotation`**. Turn content by the angle it needs: 180 for player 2's side
  of a face-to-face screen.
- **`FakeLandscapeView`'s `orientationMode`, `p1OnRight`, `upsideDown` and `locked` props.** It turns by
  `rotation` alone.

## Turning content by an angle

The OS turns the screen, so these are only for content drawn to face another seat, or laid out turned on
purpose (a game board):

- **`FakeLandscapeView`** turns its children by `rotation` (`0`, `90`, `180` or `-90`; 0 when omitted),
  swapping the footprint at ±90. `passThrough` lets touches fall through its own boxes to what's beneath,
  for a frame laid over other content. Its element tree is the same at every angle, so a turn never
  remounts its children. Fine for tap-driven content; not for a gesture-tracked board, since
  react-native-gesture-handler's translations are untransformed.
- **`rotateInsets(insets, rotation)`** remaps safe-area insets onto the edges of content turned by
  `rotation`; **`rotateDimensions(width, height, rotation)`** swaps a footprint at ±90;
  **`toRotationStyle(rotation)`** is `{ transform: [{ rotate }] }`, or `undefined` at 0. `ViewRotation`
  and `EdgeInsets` are their types.

```tsx
import { FakeLandscapeView } from '@tastic/core'

// Player 2's half of a face-to-face screen, readable from across the table.
<FakeLandscapeView rotation={180} style={styles.topHalf}>
  <ScoreCard seat={2} />
</FakeLandscapeView>
```

## Tilt on a turned screen: `@tastic/core/interface-orientation`

DeviceMotion reports tilt in the device's own frame, so once the OS turns the interface, tilting toward
the right of a landscape screen reads as tilting toward its top. This entry turns the reading into the
screen's axes:

```ts
import { edgeDip, tiltToScreenAxes, trackInterfaceOrientation } from '@tastic/core/interface-orientation'
import { DeviceMotion } from 'expo-sensors'

useEffect(() => {
  const interfaceOrientation = trackInterfaceOrientation()
  const subscription = DeviceMotion.addListener(({ rotation, orientation }) => {
    if (!rotation) return
    const dip = edgeDip(rotation.beta, rotation.gamma)
    const { x, y } = tiltToScreenAxes(dip, rotation.beta, interfaceOrientation.current(orientation))
    // x is toward the screen's right, y toward its bottom, in radians
  })
  return () => {
    subscription.remove()
    interfaceOrientation.remove()
  }
}, [])
```

- `edgeDip(beta, gamma)` is how far the device's right edge dips below the horizon. Read it instead of
  `rotation.gamma`, which both platforms report as an Euler roll: it only behaves while the screen faces
  the sky. A phone held upright swings `gamma` by tens of degrees on a tremor, and once it tips past
  vertical `gamma` jumps by 180, so a game reading it pins whatever it steers at one side.
  `asin(sin(gamma) cos(beta))` is continuous at every hold, and lying flat it's `gamma` exactly. `beta`
  needs no such fix.
- `trackInterfaceOrientation()` reads expo-screen-orientation once and follows every turn, without
  re-rendering anything. On iOS the module reports `UNKNOWN` from launch until the interface first
  turns; until then `current(heldRotation)` decides from the window's shape (portrait or landscape) and
  DeviceMotion's own `orientation` (which side). Android always reads the display.
- `tiltToScreenAxes(dip, beta, orientation)` is the pure mapping. It follows the interface orientation,
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

It's a hook returning screen options - some fleet apps' root `<Stack>` renders explicit
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

## A fixed simulation step: `createFixedStepAccumulator`

`useGameLoop` hands `onTick` a variable `dt`. A simulation that has to step at a constant rate (physics at
1/120 s, say) runs however many whole steps the frame's time covers and keeps the rest for the next frame.
`createFixedStepAccumulator(stepMs, maxSteps)` does that bookkeeping and nothing else (no timers, no React):

```ts
import { createFixedStepAccumulator, NOMINAL_FRAME_MS, useGameLoop } from '@tastic/core'

const accumulator = createFixedStepAccumulator(1000 / 120, 5) // once, e.g. in a ref

useGameLoop((dt) => {
  const steps = accumulator.advance(dt * NOMINAL_FRAME_MS)
  for (let i = 0; i < steps; i++) stepSim(state, 1 / 120)
  draw(state, accumulator.alpha) // alpha: how far into the next step, for interpolating
}, { enabled })
```

```ts
interface FixedStepAccumulator {
  advance(dtMs: number): number // adds the time, returns how many whole steps to run now
  readonly alpha: number // the leftover fraction of a step, in [0, 1)
  reset(): void // drops the leftover (a new round, a resume)
}
```

- **Never more than `maxSteps` a frame.** Time beyond `maxSteps` whole steps is discarded, not carried, so
  a long hitch never builds a backlog that makes the next frames slower still (no spiral of death). After a
  capped `advance`, `alpha` is 0.
- **Exact.** Time is counted in whole ticks of 1/39,600 ms, not in fractional milliseconds. 39,600 is the
  least common multiple of the usual refresh rates (24, 30, 48, 50, 60, 75, 90, 100, 120, 144, 165 and
  240 Hz), so a frame or a
  step at any of them, and any whole number of milliseconds, is a whole number of ticks. In floating
  point, the textbook `while (acc >= step) { acc -= step; steps++ }` loop over `useGameLoop`'s worst case
  (2.5 nominal frames, 41.67 ms) with a 1/120 s step runs 4 steps and leaves 8.33333333333333 ms, just
  short of a fifth; here it is exactly 5. A 60 fps frame is exactly 2 steps with `alpha` 0, every frame,
  and 144 frames at 144 Hz are exactly 120 steps.
- A `dtMs` that is zero, negative or `NaN` adds nothing. `stepMs` must be positive and `maxSteps` a whole
  number of at least 1, or it throws a `RangeError`.
- `useGameLoop` restarts at `dt = 1` after `enabled` turns back on, so call `reset()` there too if the
  leftover from before the pause shouldn't count.

### On the UI thread: `createFixedStepState`

A closure made on the JS thread can't be called from a Reanimated worklet, so a simulation stepped in a
`useFrameCallback` keeps the accumulator's state as a plain object of numbers instead, in a shared value or
inside its own world, and steps it with functions that are all `'worklet'`:

```ts
import { advanceFixedStep, createFixedStepState, fixedStepAlpha, resetFixedStep } from '@tastic/core'

useFrameCallback((frame) => {
  'worklet'
  const world = worldValue.get()
  world.clock ??= createFixedStepState(1000 / 120, 5) // made on the UI thread, kept in the world
  const steps = advanceFixedStep(world.clock, frame.timeSincePreviousFrame ?? 0)
  for (let i = 0; i < steps; i++) step(world, 1 / 120)
  draw(world, fixedStepAlpha(world.clock))
})
```

```ts
interface FixedStepState {
  ticks: number // toward the next step
  stepTicks: number // one step
  capTicks: number // maxSteps steps
}
createFixedStepState(stepMs: number, maxSteps: number): FixedStepState
advanceFixedStep(state: FixedStepState, dtMs: number): number // mutates state, returns whole steps to run
fixedStepAlpha(state: FixedStepState): number
resetFixedStep(state: FixedStepState): void
```

It's the same arithmetic as `createFixedStepAccumulator` (which is these functions in a closure), with the same
cap, the same exact tick counting and the same `RangeError`s, so a run stepped this way is the same run at any
frame rate.

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

## Sizes that settle on the web: `useSettledWindowDimensions`, `useSettledLayout`

Through Expo Router's web output, react-native-web's `useWindowDimensions()` can report a wrong or zero
size at first, and a container's `onLayout` can never fire on the first mount, so a Skia canvas or a
screen sized from them renders blank until something forces a real browser resize. Both hooks correct
the first reading; native has no such race, so there they're the plain versions.

```tsx
import { useSettledLayout, useSettledWindowDimensions } from '@tastic/core'

const { width, height } = useSettledWindowDimensions()

const { ref, onLayout, size } = useSettledLayout()
return (
  <View ref={ref} onLayout={onLayout} style={{ flex: 1 }}>
    {size && <Board width={size.width} height={size.height} />}
  </View>
)
```

- **`useSettledWindowDimensions()`** returns `{ width, height, fontScale, scale }`. On native it is
  `useWindowDimensions` itself. On the web it reads `window.innerWidth`/`innerHeight` directly, follows
  every `resize` event, and reads again two animation frames after mount; it reports `fontScale` 1 and
  `scale` as `window.devicePixelRatio`.
- **`useSettledLayout<T extends View = View>()`** returns `{ ref, onLayout, size }`: put `ref` and
  `onLayout` on the container, and `size` is `{ width, height }` once measured (`null` before). On native
  it's a plain `onLayout` measurement. On the web, if `onLayout` hasn't reported a non-zero size two
  animation frames after mount, it measures the element itself (`getBoundingClientRect()`).
- On the web both also dispatch a synthetic `resize` event on `window` at that two-frame mark
  (`useSettledLayout` only when it had no size yet): a `@shopify/react-native-skia` web `<Canvas>` can
  have the right size and still never paint its first frame until a real `resize` event fires.

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
any peer at all; the root entry also needs `expo-system-ui`, and only `@tastic/core/interface-orientation`
needs `expo-screen-orientation` (both below). This is a React
Native toolkit either way, so every real consumer already has both installed regardless.

`expo-system-ui` (>=57.0.0) is a required (not optional) peer too, needed only by
`useThemedRootBackground`, imported directly there: every app in this package's own fleet already
depends on it directly at the same range, so requiring it package-wide adds no new install burden.

`expo-screen-orientation` (>=58.0.0) is optional: only the `@tastic/core/interface-orientation` entry
imports it.

---

Made by [Infinite Token](https://www.infinitetoken.com), the team behind [Lumber](https://lumber.infinitetoken.com): end-to-end encrypted logging.

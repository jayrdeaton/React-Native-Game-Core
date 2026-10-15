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
  likely on touch (native, or a touch-primary web viewport) vs. likely to have a keyboard/mouse (a
  wide-viewport web browser with a fine pointer)? Useful for deciding whether to offer a
  keyboard-scheme picker or lean on touch/swipe controls. Always `true` on native.
- **`useBackgroundPause(shouldPause)`** - latches a pause when the app leaves the foreground mid-match
  and holds it until the player taps Resume. See its own section below.
- **Orientation tracking**: `OrientationProvider`, `useOrientationState`, `useRotation`,
  `useOrientationLock`, `FakeLandscapeView`, `useRotatedWindowDimensions`, and the pure
  `getViewRotation`/`getFixedZoneRotation`/`getOpposingZoneRotation`/`rotateInsets`/
  `rotateDimensions` geometry helpers. See its own section below -
  [`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen) is built on top
  of this for its two-player zone layout, and [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud)'s
  popovers/dialogs read `useRotation()` directly to stay legible inside a rotated zone.
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
subpath: importing the root barrel loads every app-level module behind it (`expo-system-ui`,
AsyncStorage, `@tastic/edge-guard`, `@rific/core`) and runs
`useThemedRootBackground`'s import-time root background call. `package.json`'s `sideEffects` lists only
the root entry, so bundlers can still tree-shake the math entry.

## Keeping the OS in portrait: the Expo config plugin

Everything below assumes the OS itself never rotates: this package draws every turn, and an OS
rotation on top of that shows the app turned twice. Add the package to your app's config plugins and
it owns the native settings that keep it that way:

```json
{
  "expo": {
    "plugins": ["@tastic/core"]
  }
}
```

- `orientation` is set to `"portrait"` (with a warning if your config asked for anything else).
- iPad: `ios.requireFullScreen: true` and an iPad orientation list of Portrait only. Without
  `requireFullScreen`, Expo's prebuild forces the iPad list to all four orientations (iPad multitasking
  requires them), so this costs Split View, Slide Over and Stage Manager windows. UpsideDown is left out
  because an iPad allows every orientation in its list, and iOS would flip an upside-down iPad on top of
  the 180 this package already draws.
- Android: `android:appCategory="game"` on `<application>`. For apps targeting API 36 or later, Android
  16 and 17 ignore `screenOrientation` on screens at least 600dp wide (tablets, unfolded foldables),
  except for apps categorized as games.
- iOS: `UIViewControllerBasedStatusBarAppearance` on, so each screen sets the status bar and it can
  hide while the content is turned (see `useRotationAwareStatusBar` below). An app linked against the
  iOS 27 SDK can't set the bar app-wide any more. With it on, React Native's `StatusBar` logs an error,
  so the app mounts none.

A portrait-only app that draws no rotation of its own passes `["@tastic/core", { "drawsRotation": false }]`:
it gets the same lock, except its iPad list keeps UpsideDown, since iOS's own flip is the only one there.

Don't install `expo-screen-orientation` alongside it: its root view controller re-enables upside down
on home-button iPhones. Check the resolved settings with `npx expo config --type introspect`. Like any
config plugin, it only takes effect in a new native build.

## Orientation tracking

An app permanently locked to portrait at the OS level (no native rotation left to read) can still
fake it by reading the device's own physical tilt directly - this is the shared foundation both
[`@tastic/split-screen`](https://github.com/jayrdeaton/react-native-split-screen) (two-player zone
layout) and [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud) (popovers/dialogs that
need to rotate in place inside one) build on.

Mount `OrientationProvider` once, near your app's root - above every screen that reads orientation,
so the committed reading survives navigation instead of each screen restarting its own sensor
subscription from scratch. This package never imports `expo-sensors` itself (a real top-level
import would force every consumer - even one with zero interest in tilt tracking - to have it
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

Omitting `deviceMotion` degrades gracefully - every hook below still works, it just never resolves
past its unresolved default (logged once in dev via `console.warn`, so it's easy to notice if it's
accidental) - the same "nothing crashes, it just never resolves" failure mode a missing
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

`useOrientationLock()` is a small, separate "is rotation locked" setting - `{ locked, setLocked }`
over a patch-based context, mirroring `@rific/feedback-press`'s `useSoundSettings`/`useHapticSettings`
shape. Like the rest of this package, it holds live state only; your app decides where (or whether)
that setting is persisted, via `OrientationProvider`'s own `lockInitialValue`/`onLockChange` props.

#### Optional: freeze the shared reading while locked (`freezeWhileLocked`)

By default, "locked" is per-call-site: each `useOrientationState(locked)` / `useRotation(locked)` /
`FakeLandscapeView locked` / `useRotationAwareStatusBar({ locked })` snapshots the live reading when *its own*
flag flips (or at its own mount), and every call site must be handed the same flag by hand. Pass
`freezeWhileLocked` to `OrientationProvider` to make the **shared reading itself** freeze while
`useOrientationLock().locked` is true instead:

```tsx
<OrientationProvider deviceMotion={DeviceMotion} lockInitialValue={{ locked, rotation }} onLockChange={save} freezeWhileLocked>
```

Every consumer then sees the reading that was current when the user locked - including a component that
mounts *after* the lock - with no per-call `locked` plumbing (the per-call argument still works, but
see the relaunch note below). Unlocking resumes through the normal hold-steady debounce (a tilt held
during the lock does not commit the instant you unlock). It is opt-in because it changes semantics:
locking freezes *every* consumer of the shared reading, so an app that wants a screen's lock to be
independent of another's should leave it off. Native only (web derives its reading from window size).

**Surviving a relaunch.** While frozen, the lock setting also carries the frozen angle as `rotation`
(a `ViewRotation`), so `onLockChange` hands you `{ locked, rotation }` to persist: it's recorded the
moment you lock and cleared (`undefined`) when you unlock. Hand both back through `lockInitialValue`
and a relaunch opens in exactly the locked orientation from the very first frame, instead of portrait
or whichever way the phone happens to be held at launch. A lock restored *without* a `rotation` (saved
before this existed) latches the first confident reading and records it. If the provider mounts before
your settings finish loading, a `lockInitialValue` that changes afterward is adopted too (requires
`@rific/core` 0.3.0+). Leave per-call-site `locked` arguments off when relying on this: a call site
that mounts before the restored lock reaches the provider freezes on the pre-load reading instead.

#### Optional: allow only some orientations (`allowedRotations`)

Pass the angles the shared reading may commit to, in `useRotation()`'s own terms:

| Angle | Phone held |
|---|---|
| `0` | portrait |
| `180` | upside down |
| `90` | turned counter-clockwise (top edge pointing left) |
| `-90` | turned clockwise (top edge pointing right) |

```tsx
<OrientationProvider deviceMotion={DeviceMotion} allowedRotations={[0, 90, -90]}> {/* no upside down */}
<OrientationProvider deviceMotion={DeviceMotion} allowedRotations={[0, 180]}> {/* portrait only, either way up */}
<OrientationProvider deviceMotion={DeviceMotion} allowedRotations={[90, -90]}> {/* landscape only */}
```

A hold whose angle isn't listed is ignored the way iOS ignores an unsupported interface orientation:
the last allowed reading just stays put. If the current reading isn't allowed (the unresolved portrait
default in a landscape-only app, or an angle switched off at runtime), it moves to the first allowed
of `0`, `-90`, `90`, `180` before anything paints. Omitted or empty means all four. An inline array
literal is fine (it never resubscribes the sensor). `portraitWhileKeyboard` still wins while the
keyboard is up, even if `0` isn't listed. A restored lock `rotation` that isn't allowed is ignored.
Native only, like `freezeWhileLocked`.

### Whole-screen content: `FakeLandscapeView` / `useRotatedWindowDimensions`

For single-perspective, whole-screen content (a title screen, a settings dialog, or - with care, see
its own warning below - an entire game screen), wrap it in `FakeLandscapeView` instead of hand-rolling
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
`useOrientationState()` every other hook here does (all three orientation props - plus `locked` - can
be passed explicitly instead, for a caller whose own reading needs to differ from the live one, e.g.
a fading dual-zone layout mid-transition).

The rendered tree is identical at every angle (outer `View` > inner `View` > children; only styles change),
so rotating never unmounts/remounts `children` - their state survives a rotation. At `0°`/`180°` your
`style` is split so layout matches a single `<View style>`: the outer view takes everything that positions
or sizes it in its parent (`position`/insets, `flex*`, `width`/`height`/min/max, `aspectRatio`, `alignSelf`,
margins, `zIndex`, `display`, `transform`), and the inner container that lays out `children` takes the rest
(`alignItems`, `justifyContent`, `gap`, padding, borders, background, ...) plus a fill of the outer box and
the 180° rotate. So `style={[StyleSheet.absoluteFill, ...]}` overlays stay out of flow and `{ flex: 1,
alignItems: 'center' }` still centers. (`boxSizing: 'content-box'` with an explicit size is not supported.)

Two more optional props. `rotation` is an explicit angle that wins over the orientation props and `locked`,
for a caller that already has the exact angle it wants (a dialog handed its caller's live rotation, or `0` for
one already inside a turned frame). `passThrough` makes the inner view `box-none` too (the outer one always is),
so touches fall through the frame's own boxes to whatever is beneath it and only `children` claim them: use it
for a frame laid over other content, such as a dialog layer or a root-level overlay.

**Safe for tap-driven content** - React Native's own touch responder system hit-tests against the
rendered/transformed layout correctly. **NOT safe for continuous gesture tracking**
(react-native-gesture-handler's translation deltas read raw, untransformed native coordinates) -
never wrap a game board/touch layer in this without independently verifying your own gesture code
agrees with it under rotation.

`useRotatedWindowDimensions(locked?)` is the dimensions analog of `rotateInsets` above - for a
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
and `useRotatedWindowDimensions` - swaps width/height for `±90°`, passes `0°`/`180°` through
unchanged - exposed directly for a caller doing its own composition.

### Root layout & orientation: `useRotationAwareStatusBar`

The OS status bar is physically glued to the device's top edge and can't itself rotate to match -
so the moment `FakeLandscapeView`/`getViewRotation` have spun anything else on screen into
`sideBySide` (±90°) or upside-down `faceToFace` (180°), a status bar left showing renders sideways or
upside-down against content that's otherwise correctly compensated. `useRotationAwareStatusBar`
returns the stack screen options that hide it whenever this package's own rotation reading says the
screen is turned, and show it only at `0°`. Spread them into your root `<Stack screenOptions>`:

```tsx
import { useRotationAwareStatusBar, useThemedRootBackground } from '@tastic/core'
import { Stack } from 'expo-router'

function RootStack() {
  const statusBar = useRotationAwareStatusBar({ style: 'light' })
  return <Stack screenOptions={{ ...useThemedRootBackground(true, false), ...statusBar }} />
}
```

It returns `{ statusBarHidden }` plus `statusBarStyle`/`statusBarAnimation` when you pass `style`
(`'auto' | 'inverted' | 'light' | 'dark'`) or `animation` (`'none' | 'fade' | 'slide'`); keys you don't
pass are left out, so spreading it never overrides an option with `undefined`. These are
react-native-screens' native-stack options, which expo-router's `Stack` and
`@react-navigation/native-stack` take as is. A screen's own `options` win over the stack's, so a
screen that should always hide the bar (a full-screen game) passes `statusBarHidden: true` itself.
Call the hook inside `OrientationProvider` (the same place you'd call `useRotation()`).

**Why screen options, not a `<StatusBar>` component.** An app linked against the iOS 27 SDK can no
longer hide or restyle the status bar app-wide: UIKit's own header says setting it "does nothing if
your application ... is linked against SDK versions 27.0 or later". That is the only way React
Native's `StatusBar` (and so `expo-status-bar`) sets it on iOS, so a build made with Xcode 27 kept the
bar showing, sideways. react-native-screens sets it per view controller instead, which needs
`UIViewControllerBasedStatusBarAppearance` on; the config plugin turns it on (see above). With it on,
every React Native `StatusBar` logs an error (a red box in a dev build), so an app using this package
**mounts no `StatusBar` at all**: drop `expo-status-bar`'s component, and pass `statusBar={false}` to
`@rific/auto-paper`'s `Provider`, which otherwise renders one. Set the bar's color with `style` here
(or `statusBarStyle` on a screen) instead. Android needs nothing extra: react-native-screens sets the
bar there from the same options.

**Not in an Expo dev-client build.** expo-dev-launcher puts its own view controller between the
window's root view controller and react-native-screens' stack, and react-native-screens only looks one
level down for the view controller that owns the status bar, so in a dev-client build the bar keeps
showing (its own comment says it "blocks react-native-screens' single-level VC traversal for
orientation and other window traits"). Release builds (preview, production) don't have that view
controller. Check the hide in one of those, not in a development build.

`locked` (optional, default `false`) has `useRotation(locked)`'s contract. Under
`OrientationProvider`'s `freezeWhileLocked` (below) the shared reading already freezes while locked, so
no `locked` is needed.

This replaced the `RotationAwareStatusBar` component (removed in 0.14.0). Migrating: delete every
`<RotationAwareStatusBar />` and `<StatusBar ... />`, spread `useRotationAwareStatusBar({ style })`
into the root stack's `screenOptions`, give any screen that always hid the bar
`options={{ statusBarHidden: true }}`, pass auto-paper's `Provider` `statusBar={false}`, and make a new
native build (the Info.plist key only changes at prebuild).

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

Published to the public npm registry as `@tastic/core`. Everything described above, including
`FakeLandscapeView`, `useRotatedWindowDimensions`, `rotateDimensions` (moved here from
`@tastic/split-screen`, which never had any real dependency on that package's own two-player
pieces), `useRotationAwareStatusBar` and `useThemedRootBackground`, is live on npm.

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

`@rific/core` (>=0.1.2) is a real (non-peer-optional) dependency, needed by the orientation-lock
settings context, which is built on its `createSettingsContext`.

`expo-system-ui` (>=57.0.0) is a real (non-peer-optional) dependency too, needed only by
`useThemedRootBackground`, imported directly there: every app in this package's own fleet already
depends on it directly at the same range, so requiring it package-wide adds no new install burden.

`expo` (>=54.0.0) is needed only by the config plugin (`app.plugin.js`, which runs in Node at
prebuild time and requires `expo/config-plugins`); the runtime code never imports it.

**Deliberately not a dependency: `expo-sensors`.** Orientation tracking needs it, but this package
never imports it directly - see the injection pattern in the Orientation tracking section above.
This keeps `expo-sensors` from being forced onto a consumer that only wants `clamp`/`useGameLoop`/
etc. and has no interest in tilt tracking at all.

### `portraitWhileKeyboard`: keeping a faked landscape usable when the keyboard opens

An app that stays portrait-locked at the OS level and fakes landscape by turning a `View` cannot turn the **keyboard**: iOS draws it in
the app's real interface orientation, so it always opens portrait relative to the device - sideways to a player holding the phone in a
faked landscape, and covering the wrong part of the turned screen. Set `portraitWhileKeyboard` on `<OrientationProvider>` and every
consumer of the shared reading (`useRotation`, `useRotatedWindowDimensions`, `useOrientationState`, `FakeLandscapeView`,
`useRotationAwareStatusBar`, and anything built on them) reads **portrait** for as long as the *software* keyboard is showing, and the real
orientation again when it hides:

```tsx
<OrientationProvider deviceMotion={DeviceMotion} portraitWhileKeyboard>
```

The player turns the phone upright to type; the view turns back when the keyboard closes. Nothing remounts (only the reading changes), so
a host that keeps its tree identical across angles - as `FakeLandscapeView` does - keeps its state and its focused text field. A hardware
keyboard raises no keyboard events and web has none, so neither triggers it. Only what consumers *read* is overridden: the sensor
underneath keeps tracking the physical hold, and `getOrientationSnapshot()` still returns it. Off by default. `useKeyboardVisible(enabled?)`
is exported too, for a caller that just wants to know whether the software keyboard is up.

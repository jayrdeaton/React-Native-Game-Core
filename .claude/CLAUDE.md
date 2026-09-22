# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @tastic/core

Required foundation for `@tastic/*` game packages: `Vec2` and vector math, `clamp`, a dt-clamped RAF game-loop hook, and environment-capability detection (touch-primary vs. keyboard-likely).

Part of the `@tastic` package ecosystem. Published at https://www.npmjs.com/package/@tastic/core.

## Commands

```bash
npm run build       # tsup, outputs CJS + ESM + types to dist/
npm run build:watch # tsup --watch
npm run lint         # ESLint check
npm run fix           # ESLint --fix
npm test              # Jest (30 tests)
npm run test:watch    # Jest --watchAll
npm run typecheck     # TypeScript type check (tsc --noEmit)
npm run verify         # lint + test + typecheck + build, in that order
```

Always run `npm run lint` before finishing any task.

## Release

Tag-based, using npm trusted publishing (OIDC, no token required):

```bash
npm run release:patch   # or release:minor / release:major — bumps version, then git push --follow-tags
```

`preversion` runs `npm run verify` first. The `publish.yml` workflow fires on `v*` tags and delegates to the shared `infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1` reusable workflow (`id-token: write` permission for OIDC).

## Architecture

```
src/
  index.ts                       - all public exports
  Vec2.ts                        - Vec2 interface + add/subtract/scale/length/distance/dot/normalize, each tagged 'worklet' for use inside Reanimated worklets
  clamp.ts                       - clamp(value, min, max), also 'worklet'-tagged
  computeClampedDt.ts             - converts a raw rAF timestamp gap into a clamped, frame-rate-independent dt multiplier (dt = 1 means one nominal 60fps frame); returns 1 when there's no prior timestamp
  useGameLoop.ts                  - drives onTick(dt) once per animation frame while enabled, via computeClampedDt internally; toggling enabled off/on resets the timestamp baseline so the next tick is dt = 1
  useIsTouchPrimaryDevice.ts       - native implementation: always returns true
  useIsTouchPrimaryDevice.web.ts   - web implementation: touch-primary heuristic from maxTouchPoints + matchMedia('(pointer: coarse)') + a narrow-viewport (<700px) fallback; live-updated on resize and matchMedia change
  useSettledWindowDimensions.ts     - native implementation: plain re-export of react-native's useWindowDimensions
  useSettledWindowDimensions.web.ts - web implementation: reads window.innerWidth/innerHeight directly (not react-native-web's Dimensions module) and re-checks two animation frames after mount, fixing a real race where the first reading is wrong and nothing forces a correction
```

### The web canvas-sizing race this package exists to fix

Added 2026-09-11 after a fleet-wide QA pass found several games (HexFleet, Ember-Vein, BoxHockey, and latently Asteroids/Minesweeper) rendering a blank Skia canvas or game world on the very first web load — fixed instantly by any window resize, which was the tell. Root cause: `useWindowDimensions()` from `react-native-web` can report a wrong size on the very first render through Expo Router's web output, and nothing forces a re-render to correct it unless a real `resize` event happens to fire afterward. This is a timing race in react-native-web itself, not a bug in any one game — which is why the fix lives here rather than being patched per-app. `useSettledWindowDimensions` is a drop-in replacement: same shape as `useWindowDimensions()`, but on web it independently re-reads the true window size two animation frames after mount (after layout has genuinely settled) and only ever corrects that first reading — a real resize afterward is tracked normally via its own listener, so there's no staleness risk once it's caught up. Every game with a `useWindowDimensions()`-sized Skia canvas should use this instead, even ones that haven't visibly hit the race yet — it's a timing race, not a deterministic per-game difference, so "hasn't shown it in testing" isn't the same as "isn't affected."

Platform resolution note: `package.json`'s `"react-native"` and `"browser"` export conditions both point straight at `src/index.ts` (not `dist/`), so Metro/webpack's platform-extension resolver picks `useIsTouchPrimaryDevice.web.ts` over the base `.ts` file on web builds. The `dist/` build (used by the plain Node `"import"`/`"require"` conditions, via tsup) has no such resolver, so it bakes in the native (always-`true`) implementation — a consumer resolving through those conditions never gets the web heuristic.

## Public API

- `Vec2` (type) + `add`, `subtract`, `scale`, `length`, `distance`, `dot`, `normalize` — plain 2D vector math; each function is marked `'worklet'`
- `clamp(value, min, max)` — clamps a number to a range; also `'worklet'`-tagged
- `computeClampedDt(timestamp, lastTimestamp, maxDt)` — raw rAF timestamp gap to a clamped dt multiplier
- `useGameLoop(onTick, { enabled, maxDt? })` / `UseGameLoopOptions` — drives `onTick(dt)` every animation frame while `enabled` is true; `maxDt` defaults to 2.5
- `useIsTouchPrimaryDevice()` — best-effort touch-vs-keyboard/mouse capability detection; always `true` on native

## Peer Dependencies

- `react` (>=19.0.0) — required. `Vec2`/`clamp`/`computeClampedDt`'s own source has no dependency, but the package ships as a single bundle (one `tsup` entry, `src/index.ts` re-exporting everything) alongside `useGameLoop`/`useIsTouchPrimaryDevice`, which do import `react` — so the compiled `dist/index.js`/`.mjs` has a real top-level `require("react")`/`import` regardless of which exports a consumer actually uses. Every real consumer in the fleet is a React Native app anyway (which always has `react` installed by definition), so this has never been a practical problem — just worth knowing the "dependency-free" framing describes the source files, not the shipped bundle. Would need a separate build entry (and a new subpath export) to actually decouple them; not planned unless a genuinely non-React consumer shows up.

## Testing

- Framework: Jest (`@infinitetoken/jest-config/react-native`), jsdom environment
- No mocks — nothing in `src/` imports `react-native` directly
- 30 tests across 6 suites: `Vec2.test.ts`, `clamp.test.ts`, `computeClampedDt.test.ts`, `useGameLoop.test.ts`, `useIsTouchPrimaryDevice.test.ts` (native), `useIsTouchPrimaryDevice.web.test.ts` (web heuristic)

## Bug fixes (2026-09-17)

**`createGameSettingsProvider`'s `setSettings` called `AsyncStorage.setItem` from inside its own `useState` updater — the same "impure updater" bug class found in `@rific/core`'s `createSettingsContext` (see that package's own CLAUDE.md), independently duplicated here rather than shared through it.** A `useState` updater must be pure; React can invoke it outside the originating `setSettings()` call (e.g. replaying a queued update while resolving a later render of the same provider), which fired a real, spurious `AsyncStorage` write. Fixed with a `hasPendingWrite` ref: `setSettings` sets it synchronously (never the initial-load effect, which calls `setSettingsState` directly), and a separate `useEffect` keyed on `settings` checks and clears the flag before persisting — so only a genuine `setSettings()` call ever triggers a write, and several calls made before a render flushes coalesce into one write of the final settled value.

**`OrientationProvider`'s old hand-rolled `set` had the identical bug — it called the consumer's `onLockChange` from inside its own state updater — and rather than patch it in place, the whole lock-setting half was rewritten to bind `@rific/core`'s `createSettingsContext` factory instead of hand-rolling its own `{Context, Provider}` pair.** `OrientationLockContext.ts` now does `createSettingsContext<OrientationLockSettings>(defaultOrientationLockSettings)` and re-exports its `Context`/`Provider`/`useSettings` as `OrientationLockContext`/`OrientationLockProvider`/`useOrientationLockSettings` — the same `{settings, set}` contract the hand-rolled version already had, so `useOrientationLock.ts` and `OrientationProvider.tsx` needed no contract changes, just to read `useOrientationLockSettings()` instead of `useContext(OrientationLockContext)` directly. `OrientationProvider` itself is now a thin composition: `<OrientationLockProvider initialValue={lockInitialValue} onChange={onLockChange}><OrientationStateProvider deviceMotion={deviceMotion}>{children}</OrientationStateProvider></OrientationLockProvider>` — the impure-updater bug is fixed for free by inheriting `@rific/core`'s own fix (see that package's CLAUDE.md) rather than needing a second, separate patch here. `useOrientationState.tsx` itself (the live-tilt half, unrelated to the lock setting) was left untouched after a considered rewrite of its own `latestSnapshot`-vs-`prev` comparison logic was tried and reverted — the rewrite introduced a real cross-mount state-leakage regression (caught by the test suite), and the original `prev`-based bailout was confirmed correct as-is.

Both fixes landed alongside `@rific/core@0.1.2` — `@rific/core` is now a real `peerDependencies`/`devDependencies` entry here (`>=0.1.2`) rather than an implicit transitive assumption. Now `0.6.0` (minor — `OrientationLockContext`'s public shape is unchanged, but the new peer dependency and internal rewrite are more than a patch).

## Extractions (2026-09-18)

Two more fleet-wide duplications collapsed into this package. Both are new exports as of the current `0.7.0` working tree; neither changes the shape of anything that already existed.

**`useThemedRootBackground` (`src/useThemedRootBackground.ts`) replaces an identical, independently-hand-rolled fix for an OS-level corner-flash that all 5 fleet apps (AirHockey, BoxHockey, Pong, LightCycles, Snake) had already converged on byte-for-byte.** react-native-screens' push/pop transition animates two screens' native views directly over the OS root window, so whatever that window's own background is left at (white, by default) shows through at the display's rounded corners for the duration of the transition, wherever the sliding content hasn't caught up to the corner-radius mask yet — `contentStyle` (the screen-level backing) is a separate layer from the root window itself and doesn't fix this alone. The hook returns `{ headerShown: false, gestureEnabled, contentStyle: { backgroundColor } }` for a root `<Stack screenOptions={...}>`, and fires the matching `expo-system-ui` call twice: once at module-import time (line 9 — `'#000000'` is just the earliest possible guess, before any component or the live theme is known), and again inside a `useEffect` keyed on `dark` every time a consumer actually calls the hook. Two real design choices worth knowing if you touch this file:
- **Hook, not a wrapping component**, despite `RotationAwareStatusBar` (this package's existing precedent for this exact "root `_layout.tsx` helper" shape) being a component. Snake's root `<Stack>` renders 4 explicit `<Stack.Screen>` children; the other 4 apps' `<Stack screenOptions={...} />` calls have none. A component wrapping `<Stack>` would need an explicit `children` passthrough prop for Snake's sake alone; a hook returning a plain options object composes with both shapes for free.
- **`gestureEnabled` is a parameter (default `false`), never hardcoded inside the hook**, because disabling it addresses a logically separate concern from corner-flash — iOS's native swipe-back gesture fighting an in-game swipe/Pan gesture on a specific screen — that won't apply to every future consumer. Every current fleet app happens to want `false` today; Snake and LightCycles carry real, on-device-confirmed prose comments explaining why at their own call sites, while AirHockey/BoxHockey/Pong pass `false` with no comment at all (very likely guarding the same real conflict — both have their own `TouchInputLayer.tsx` with Pan gestures — just never documented). Neither this package's job to fix; document your own reason at your own call site.

This is `@tastic/core`'s first module-scope side effect — a real call firing the instant the module is evaluated, not gated behind any function call — which is worth flagging against this package's own `package.json` `"sideEffects": false` (line 24), technically inaccurate for this one file now. It's harmless in practice today only because `tsup` bundles the whole package into a single `dist/index.js`/`dist/index.mjs` per format (confirmed by grep: the `SystemUI.setBackgroundColorAsync('#000000')` call is present, unconditionally, in both built files) — there's no per-file boundary for a downstream bundler to exploit by dropping just this call while keeping the hook itself, and the actual runtime for every real consumer (Metro, via the `"react-native"`/`"browser"` export conditions pointing straight at `src/index.ts`) doesn't tree-shake at the module level regardless. If this package ever moves to per-export code splitting, `sideEffects` will need to start listing this file explicitly, or the fix could silently vanish for some future consumer.

Needs its own Jest mock, and it's required, not optional: `src/__mocks__/expo-system-ui.ts` + a `^expo-system-ui$` entry in `jest.config.cjs`'s `moduleNameMapper`. The reason is a different mechanism than `expo-status-bar`'s existing mock, even though the fix looks identical — `expo-status-bar` needs one because its `"exports"` field resolves straight to raw, untranspiled TypeScript with no built output at all for that condition. `expo-system-ui` has no `"exports"` field whatsoever; its plain `"main"` field points at `build/SystemUI.js`, which **is** already-built — but it's genuine ESM (`import`/`export` syntax), and Jest's default `transformIgnorePatterns` still excludes `node_modules` from transformation, so it can't parse that syntax either. Same practical remedy, different root cause — the mock file's own comment says so explicitly, so a future maintainer doesn't assume the two mocks exist for the same reason and skip re-verifying if either upstream package's build shape ever changes. `expo-system-ui` (`>=57.0.0` peer, `^57.0.4` dev) is added as a real dependency the same way `expo-status-bar` was for `RotationAwareStatusBar` — every fleet consumer already has it installed at the same range. New coverage lives in `src/__tests__/useThemedRootBackground.test.tsx` (7 tests) — none of the 5 apps' own `_layout.test.tsx` ever asserted on this behavior before extraction, so this is genuinely new, not ported: the returned options for light/dark, `gestureEnabled` passthrough, the effect firing on mount for both themes, re-sync on a `dark` change vs. no-op on an unchanged rerender, and (via `jest.isolateModules` + a fresh `require`, since every other test in the file shares one `beforeEach`-cleared mock instance) the one-time import-time call observed in isolation.

**`SettingsAndProfilesGate` (`src/SettingsAndProfilesGate.tsx`) replaces the same nested-gate composition, hand-rolled 3 different ways across 4 fleet apps, down to one shared name.** AirHockey, BoxHockey, Pong, and LightCycles each wrap a `'settings'` `SplashGate` outside a `'profiles'` one around everything that reads `GameSettingsProvider`'s or `ProfilesProvider`'s own context, so no screen mounts on stale AsyncStorage defaults before the real (or, for profiles, shared-App-Group-reconciled) value loads. BoxHockey and Pong had already converged on a merged `GatedApp` component (byte-identical between the two); AirHockey (`SettingsReadyGate`/`ProfilesReadyGate`) and LightCycles (`SettingsGate`/`ProfilesGate`) each split the same composition into two separately-named components instead. The extracted component takes the app's own bound `Gate` (from `@rific/splash-gate`'s `createGate([...])`) **as a prop**, not imported by this package — `@tastic/core` deliberately never takes a dependency on `@rific/splash-gate` itself, matching the same "take the concrete thing as a prop, don't import what produces it" choice `OrientationProvider` already makes for `deviceMotion`/`expo-sensors`. This isn't just dependency hygiene: the per-app bound `Gate` is inherently non-shareable anyway, since `createGate()` returns a closure holding a real, singleton, per-app pending-`Set` and calls the real `SplashScreen.hideAsync()` — there's no single shared instance this package could own even if it wanted to. `settingsLoaded`/`profilesLoaded` are likewise plain boolean props rather than hook calls this component makes itself, because `useGameSettings()`/`useProfiles()` are app-local hooks (`@/hooks/*`) in every one of the 4 apps, not exported by any shared package — each app still needs its own small wrapper beneath both providers to supply them. Nesting order (settings outer, profiles inner) matches every app's prior implementation; it has no observable effect today since no call site anywhere in the fleet passes a custom `fallback` (both gates default to `null`), but it's preserved in case that ever changes. The prop type for `Gate` (`(props: { gate: 'settings' | 'profiles'; ready: boolean; children: ReactNode }) => ReactNode`) is deliberately narrower than any real app's bound `Gate` (typed for that app's full gate-name union, e.g. also `'theme'`/`'haptics'`/`'sound'`/`'fonts'`) — TypeScript's contravariant parameter checking accepts this safely as long as `'settings'`/`'profiles'` are members of the app's own union, which every current consumer's `createGate(...)` call already satisfies.

**Snake is correctly excluded, and it's worth knowing exactly why rather than assuming it was just skipped.** Snake's settings live in Redux (`@reduxjs/toolkit` + `redux-persist`), gated only by `PersistGate` — an entirely separate mechanism from the AsyncStorage-context-plus-`SplashGate` architecture the other 4 apps share. Snake's own `_layout.tsx` has no `GameSettingsProvider`, no `@/utils/splashGate` import, no `SplashGate` anywhere — and its `ProfilesProvider` isn't wrapped in any gate at all, not even a single one for `'profiles'` alone. This isn't a partial-adoption gap for Snake to close later; Snake genuinely doesn't have the architecture this component generalizes, so there is nothing there for it to adopt.

Tests (`src/__tests__/SettingsAndProfilesGate.test.tsx`, 4 cases) use a local `FakeGate` stand-in for an app's real `createGate()` output rather than depending on `@rific/splash-gate` in this package's own test suite — matching the "doesn't import it" design choice above: children render once both are ready; the outer settings gate holds children back even when profiles are ready; the inner profiles gate holds children back when settings are ready but profiles aren't; and a gate-order-tracking wrapper confirms profiles never even mounts while settings isn't ready (not just that it doesn't render its children). No new peer dependency comes with this component, since it never imports `@rific/splash-gate` itself.

One residual, pre-existing issue this extraction surfaced but doesn't fix: Pong's own `useProfiles.tsx` still calls `useSplashReady('profiles', loaded)` internally — a leftover twin of the same "hook reports its own readiness inline" pattern already identified and removed from the settings side during the `createGameSettingsProvider` migration (see the comment left behind in Pong's own `useGameSettings.tsx`). It's harmless — `@rific/splash-gate`'s `useReady`/`markReady` are documented idempotent no-ops for an already-satisfied gate — but it's Pong's own follow-up to make, not something this package's component needed to account for.

## Code Style

Enforced by ESLint + Prettier, run `npm run lint` before finishing any task.

**Prettier config:**
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules (warnings unless noted):**
- `simple-import-sort/imports`, `simple-import-sort/exports` — imports and exports must be sorted
- `react-native/no-inline-styles` — no inline style objects
- `react-native/no-unused-styles` — no unused StyleSheet entries
- `react-native/no-raw-text` — off
- `no-console` — no console statements
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/no-require-imports` — off
- `react-hooks/rules-of-hooks` — error, not a warning
- `react-hooks/exhaustive-deps`, `react-hooks/refs`, `react-hooks/immutability`, `react-hooks/preserve-manual-memoization`, `react-hooks/set-state-in-effect` — warnings

**`OrientationProvider portraitWhileKeyboard` (opt-in).** iOS draws the keyboard in the app's REAL interface orientation, which for a portrait-locked app faking landscape is always portrait - so in a faked landscape it is sideways and covers the wrong part of the turned screen. With the prop, `OrientationStateProvider` hands consumers `{ ...state, orientationMode: 'faceToFace', upsideDown: false }` (rotation 0 via `getViewRotation`) while `useKeyboardVisible(portraitWhileKeyboard)` is true, memoized on `[keyboardVisible, state]` so nothing re-renders when it isn't opted in. Deliberately overrides only the CONTEXT value: the sensor state underneath (and `latestSnapshot`/`getOrientationSnapshot`, the physical hold a game freezes for a match) is untouched, so a hold committed while typing shows the moment the keyboard hides. `useKeyboardVisible` (`src/useKeyboardVisible.ts`, exported) uses the `Will` events on iOS (so a screen reverts while the keyboard is still sliding in) and `Did` on Android, registers no listener while `enabled` is false, and returns `enabled && visible` so a stale `true` can't outlive being disabled. A hardware keyboard raises no events; web has none. Tests: `useKeyboardVisible.test.tsx`, `OrientationProvider.portraitWhileKeyboard.test.tsx` (the shared RN mock gained a controllable `Keyboard` + `emitKeyboard`/`keyboardListeners`).

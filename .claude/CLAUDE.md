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
```

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

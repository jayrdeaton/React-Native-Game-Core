// Same shape/rationale as this directory's expo-status-bar.ts mock, for a different underlying
// reason: expo-system-ui has no "exports" field at all — its plain "main" field ("build/SystemUI.js")
// points straight at genuine, already-built ESM (`import`/`export` syntax, not raw TypeScript), which
// Jest's default transformIgnorePatterns (excludes node_modules) still can't parse. Don't assume this
// is identical to the expo-status-bar case (raw untranspiled TS via "exports") — same practical fix,
// different mechanism; see useThemedRootBackground.ts's own doc for what this module is used for.
export const setBackgroundColorAsync = jest.fn(() => Promise.resolve())

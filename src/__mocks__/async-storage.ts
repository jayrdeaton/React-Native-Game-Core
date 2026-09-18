// Same "package resolves to something Jest can't/shouldn't load for real" category as this
// directory's expo-status-bar.ts mock, for a different underlying cause: the real package's native
// module is never linked under this package's plain jsdom Jest environment, so importing it for
// real throws at import time rather than merely being redundant — see gameSettingsValidation.ts's
// identical comment in every app this pattern was extracted from, and
// createGameSettingsProvider.tsx's own AsyncStorage import.
//
// Plain jest.fn()s, not a stateful in-memory store — createGameSettingsProvider.test.tsx's own
// tests each configure getItem's return value directly per case (mockResolvedValueOnce/
// mockRejectedValueOnce), same convention as this directory's react-native.ts mock's
// useWindowDimensions (see useOrientationState.test.tsx's own `(useWindowDimensions as
// jest.Mock).mockReturnValueOnce(...)` calls) — simpler than a shared store to reason about
// per-test, and the one test that cares about a real getItem/setItem round-trip wires that up
// itself via setItem's own mock implementation rather than needing this file to do it globally.
// Default resolutions (no stored value, a successful write) cover every test that doesn't
// override them.
const getItem = jest.fn((): Promise<string | null> => Promise.resolve(null))
const setItem = jest.fn((): Promise<void> => Promise.resolve())

export default { getItem, setItem }

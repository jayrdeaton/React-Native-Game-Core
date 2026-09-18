// Same shape/rationale as this directory's react-native.ts mock: a jest.fn() so a test can inspect
// exactly what props a render call received, wrapping a stub that renders nothing. Needed here for a
// different reason than react-native's own "no real implementation under jsdom" — expo-status-bar's
// package.json "exports" resolves its default condition straight to raw, untranspiled TypeScript
// (./src/StatusBar.ts, no built/CJS output for that condition at all), and Jest's default
// transformIgnorePatterns skips node_modules, so importing the real package here would fail to parse
// rather than just being redundant. Nothing in this package's own tests needs the real native
// module's actual OS-level effect anyway, only what RotationAwareStatusBar renders it with.
export const StatusBar = jest.fn(() => null)

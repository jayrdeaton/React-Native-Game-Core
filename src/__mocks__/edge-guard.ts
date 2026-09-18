// Same shape/rationale as this directory's expo-status-bar.ts mock: createGameSettingsProvider's
// own tests need to assert exactly what boolean this hook was called with on each render, not
// exercise its real native UserDefaults side effect (Settings.set) — which the react-native.ts mock
// in this same directory doesn't even implement (see that file's own minimal member list; adding
// Settings there just to let the real @tastic/edge-guard run for real would be scaffolding built
// for one caller, the opposite of that mock's own "only what's actually used" scope).
export const useEdgeGestureGuard = jest.fn()

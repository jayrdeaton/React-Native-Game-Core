// `@tastic/core/math`: the pure, dependency-free part of this package. The headless packages
// (@tastic/input, @tastic/physics, @tastic/sprites) only need vector math and clamp, and importing
// them from the root barrel also loads every app-level module behind it (expo-system-ui,
// expo-status-bar, AsyncStorage, @tastic/edge-guard, @rific/core) plus useThemedRootBackground's
// import-time side effect. Nothing under src/math/ may import anything outside this package's own
// pure files; src/__tests__/mathEntry.test.ts asserts that.
export { clamp } from '../clamp'
export { add, distance, dot, length, normalize, scale, subtract, type Vec2 } from '../Vec2'

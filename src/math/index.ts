// `@tastic/core/math`: the pure, dependency-free part of this package. The headless packages
// (@tastic/input, @tastic/physics, @tastic/sprites, @tastic/shooter) only need vector math, clamp and the
// fixed step, and importing
// them from the root barrel also loads every app-level module behind it (expo-system-ui) plus
// useThemedRootBackground's import-time side effect. Nothing under src/math/ may
// import anything outside this package's own pure files; src/__tests__/mathEntry.test.ts asserts that.
export { clamp } from '../clamp'
export { advanceFixedStep, createFixedStepAccumulator, createFixedStepState, type FixedStepAccumulator, fixedStepAlpha, type FixedStepState, resetFixedStep } from '../fixedStepAccumulator'
export { add, distance, dot, length, normalize, scale, subtract, type Vec2 } from '../Vec2'

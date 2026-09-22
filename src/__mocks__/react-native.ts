export const useWindowDimensions = jest.fn(() => ({ width: 402, height: 874, scale: 3, fontScale: 1 }))
export const Platform = { OS: 'ios' as const }

// Added for FakeLandscapeView.test.tsx — the first component in this package to actually render a
// View. Same shape as @tastic/split-screen's own identical mock (that's where this component lived
// until this version): a jest.fn() so a test can inspect exactly what props/style a render call
// received, wrapping a stub that renders `children` directly rather than a real native/DOM node.
// No ref/measureInWindow handling — unlike split-screen's DualZoneLayout, nothing here ever measures
// a View via ref.
interface FakeViewProps {
  children?: unknown
  style?: unknown
}
const viewStub = ({ children }: FakeViewProps) => children ?? null
export const View = jest.fn(viewStub)

export const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: unknown) => style
}

// Added for useKeyboardVisible.test.tsx / OrientationProvider.portraitWhileKeyboard.test.tsx: a Keyboard whose listeners a test can
// fire by hand. `keyboardListeners` is exported so a test can also assert how many are registered (none while a hook is disabled).
type KeyboardListener = () => void
export const keyboardListeners: Record<string, Set<KeyboardListener>> = {}
export const Keyboard = {
  addListener: jest.fn((event: string, listener: KeyboardListener) => {
    ;(keyboardListeners[event] ??= new Set()).add(listener)
    return { remove: () => keyboardListeners[event]?.delete(listener) }
  })
}
export const emitKeyboard = (event: string) => keyboardListeners[event]?.forEach((listener) => listener())

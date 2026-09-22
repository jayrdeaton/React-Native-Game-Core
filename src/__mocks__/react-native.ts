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

// flatten mirrors the real one (arrays, nesting, falsy entries; later wins) so a test can inspect
// the merged style a component splits/forwards; absoluteFill matches react-native's own constant.
type StyleValue = Record<string, unknown> | StyleValue[] | null | undefined | false
function flatten(style: StyleValue): Record<string, unknown> | undefined {
  if (!style) return undefined
  if (!Array.isArray(style)) return style
  const out: Record<string, unknown> = {}
  for (const entry of style) Object.assign(out, flatten(entry))
  return out
}
const absoluteFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const

export const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten,
  absoluteFill,
  absoluteFillObject: absoluteFill
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

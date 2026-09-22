import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

// iOS announces the keyboard BEFORE it animates (`Will`), which is what lets a caller react - e.g. re-lay out a screen - while the
// keyboard is still sliding in rather than after it has already covered something. Android has no `Will` events, only `Did`.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

/** Whether the SOFTWARE keyboard is currently showing (or about to).
 *
 * `enabled` (default true) lets a caller that only sometimes cares - e.g. OrientationProvider's opt-in
 * `portraitWhileKeyboard` - call this unconditionally without subscribing to keyboard events at all when it does not: while
 * disabled no listener is registered and the result is always false. A hardware keyboard produces no events, so this stays false
 * for it. On web `Keyboard` has no events at all, so it stays false there too. */
export function useKeyboardVisible(enabled = true): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const show = Keyboard.addListener(SHOW_EVENT, () => setVisible(true))
    const hide = Keyboard.addListener(HIDE_EVENT, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [enabled])

  // Derived rather than reset in an effect: a flag that flips back to false while the keyboard is still up must not leave a stale
  // `true` behind for the next time it is enabled, and reading `enabled &&` here makes that impossible without any extra state.
  return enabled && visible
}

import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'

// Runs once, at module import — before any component (or the live theme) has rendered, exactly like
// each app's own former per-file call. '#000000' is just the earliest possible guess; the hook's own
// effect below corrects it to the real theme the moment a consumer first calls the hook with a known
// `dark`, well before a user could navigate and trigger a react-native-screens push/pop transition
// (the OS-level corner-flash this exists to prevent — see the hook's own doc).
SystemUI.setBackgroundColorAsync('#000000')

export interface ThemedRootStackOptions {
  headerShown: false
  gestureEnabled: boolean
  contentStyle: { backgroundColor: string }
}

/**
 * Screen options for a fleet game's root <Stack>, plus the expo-system-ui root-window-background
 * sync that has to happen alongside it. react-native-screens' push/pop transition animates two
 * screens' native views directly over the OS root window, so whatever that window's own background
 * is left at (white, by default) shows through at the display's rounded corners for the duration of
 * the transition, wherever the sliding content hasn't caught up to the corner-radius mask yet.
 * contentStyle alone (the screen-level backing) doesn't fix this — it's a separate layer from the
 * root window SystemUI controls, which is why both are needed together, matching every app in the
 * fleet that already independently hand-rolled this exact pairing.
 *
 * `gestureEnabled` is NOT hardcoded here on purpose: unlike the corner-flash fix, disabling it
 * addresses a logically separate, app-specific concern (iOS's native swipe-back gesture fighting an
 * in-game swipe/Pan gesture on a specific screen) that doesn't apply to every possible consumer.
 * Every current fleet app happens to want `false`, but bundling it in unconditionally would be a
 * surprising, undocumented side effect for a future consumer that has no such conflict. Document your
 * own reason for the value you pass at the call site (see AirHockey's/LightCycles'/Pong's/Snake's own
 * _layout.tsx for the existing per-app rationale, where one exists).
 */
export function useThemedRootBackground(dark: boolean, gestureEnabled = false): ThemedRootStackOptions {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(dark ? '#000000' : '#FFFFFF')
  }, [dark])

  return {
    headerShown: false,
    gestureEnabled,
    contentStyle: { backgroundColor: dark ? '#000000' : '#FFFFFF' }
  }
}

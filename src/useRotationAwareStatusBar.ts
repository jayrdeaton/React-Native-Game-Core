import { getViewRotation } from './rotation'
import { useOrientationState } from './useOrientationState'

export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark'
export type StatusBarAnimation = 'none' | 'fade' | 'slide'

export interface RotationAwareStatusBarOptions {
  // Same contract as useRotation(locked): freezes this reading at whatever rotation was current when it
  // turned true. Not needed under OrientationProvider's freezeWhileLocked, which freezes the shared reading
  // for every consumer at once.
  locked?: boolean
  // The status bar's text and icon color. Omitted = the stack's own default ('auto' on iOS, 'light' on
  // Android, per react-native-screens).
  style?: StatusBarStyle
  // How the bar hides and shows. Omitted = react-native-screens' default ('fade').
  animation?: StatusBarAnimation
}

// The status bar keys of a react-native-screens native-stack's screen options (expo-router's Stack and
// @react-navigation/native-stack both take them as is). Declared here rather than imported, so this
// package doesn't depend on a navigation library.
export interface RotationAwareStatusBarScreenOptions {
  statusBarHidden: boolean
  statusBarStyle?: StatusBarStyle
  statusBarAnimation?: StatusBarAnimation
}

/**
 * Screen options that hide the OS status bar whenever this package's rotation has turned the content
 * (`rotation !== 0`). The status bar is glued to the device's physical top edge and can't turn with the
 * content, so left showing it reads sideways or upside down against everything else. Spread the result into
 * a root `<Stack screenOptions>` (every screen) or one screen's `options` (just that screen); a screen's own
 * `options` win over the stack's, e.g. a game screen that always passes `statusBarHidden: true`.
 *
 * Screen options, not a `<StatusBar>` component: an app linked against the iOS 27 SDK can no longer set
 * the status bar app-wide ("Setting statusBarHidden does nothing if your application ... is linked against
 * SDK versions 27.0 or later", UIApplication.h), which is the only way React Native's StatusBar (and so
 * expo-status-bar) sets it on iOS. react-native-screens sets it per view controller instead, which needs
 * `UIViewControllerBasedStatusBarAppearance` on; this package's config plugin turns it on. With it on,
 * every React Native `StatusBar` logs an error, so an app using this mounts none.
 */
export function useRotationAwareStatusBar({ locked = false, style, animation }: RotationAwareStatusBarOptions = {}): RotationAwareStatusBarScreenOptions {
  const { orientationMode, p1OnRight, upsideDown } = useOrientationState(locked)
  const options: RotationAwareStatusBarScreenOptions = { statusBarHidden: getViewRotation(orientationMode, p1OnRight, upsideDown) !== 0 }
  // Only the keys the caller set, so spreading the result never overrides an option with undefined.
  if (style !== undefined) options.statusBarStyle = style
  if (animation !== undefined) options.statusBarAnimation = animation
  return options
}

export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark'
export type StatusBarAnimation = 'none' | 'fade' | 'slide'

export interface RotationAwareStatusBarOptions {
  // Ignored since 0.15 (nothing turns, so there is nothing to freeze); kept until the apps stop passing it.
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
 * Native-stack screen options for the status bar: `statusBarHidden` plus the style and animation the
 * caller gives. Until 0.15 it hid the bar while this package's drawn rotation had turned the content;
 * nothing turns now, so `statusBarHidden` is always false. Kept until @tastic/shell and the apps move
 * to setting `statusBarStyle` themselves; it goes after that.
 *
 * Screen options rather than a `<StatusBar>` component because an app linked against the iOS 27 SDK can
 * no longer set the status bar app-wide (UIApplication.h), which is the only way React Native's
 * StatusBar sets it on iOS. react-native-screens sets it per view controller instead, which needs
 * `UIViewControllerBasedStatusBarAppearance` on in the app's Info.plist (`ios.infoPlist` in app.json).
 */
export function useRotationAwareStatusBar({ style, animation }: RotationAwareStatusBarOptions = {}): RotationAwareStatusBarScreenOptions {
  const options: RotationAwareStatusBarScreenOptions = { statusBarHidden: false }
  // Only the keys the caller set, so spreading the result never overrides an option with undefined.
  if (style !== undefined) options.statusBarStyle = style
  if (animation !== undefined) options.statusBarAnimation = animation
  return options
}

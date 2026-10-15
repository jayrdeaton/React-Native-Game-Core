// Turns on UIViewControllerBasedStatusBarAppearance, so each screen's view controller decides whether the
// status bar shows and which color it is. useRotationAwareStatusBar hands react-native-screens exactly that
// (statusBarHidden while the content is turned), and react-native-screens only applies it with this key on.
//
// The app-wide alternative is gone: an app linked against the iOS 27 SDK can no longer hide or restyle the
// status bar through UIApplication ("Setting statusBarHidden does nothing if your application ... is linked
// against SDK versions 27.0 or later", UIApplication.h), and that is the only way React Native's StatusBar
// (and so expo-status-bar) does it on iOS. Expo's template turns this key off for that component, so it is
// set here. With it on, every React Native StatusBar logs an error, so an app using this plugin mounts none.
// Android has no such key: react-native-screens sets the status bar there from the same screen options.
function withViewControllerStatusBar(config) {
  config.ios = {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      UIViewControllerBasedStatusBarAppearance: true
    }
  }
  return config
}

module.exports = withViewControllerStatusBar

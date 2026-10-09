const { AndroidConfig, WarningAggregator, withAndroidManifest } = require('expo/config-plugins')

const IPAD_ORIENTATIONS_KEY = 'UISupportedInterfaceOrientations~ipad'

// Keeps the OS in portrait on every device, so the only rotation a player ever sees is the one this
// package draws (OrientationProvider reads the accelerometer and turns the content itself). An OS
// rotation on top of that turns everything twice. Three platform settings get in the way of that,
// and this plugin owns all of them so no app hand-copies them:
//
// - `orientation: 'portrait'`. Expo turns it into the iPhone orientation list and Android's
//   `screenOrientation="portrait"`.
// - iPad. Expo's own `orientation` never touches the separate iPad list, and with `supportsTablet`
//   and `ios.requireFullScreen` off, Expo's prebuild FORCES that list to all four orientations
//   (iPad multitasking requires them, ITMS-90474). So `requireFullScreen: true` and our own list,
//   at the cost of Split View, Slide Over and Stage Manager windows. An iPad's root view controller
//   allows every orientation its list names, so the list is Portrait only: with UpsideDown in it,
//   iOS flips an upside-down iPad on top of the 180 the app already draws. `drawsRotation: false`
//   is for a portrait-only app that draws no rotation of its own: it keeps UpsideDown, since there
//   iOS's own flip is the only one.
// - Android large screens. Android 16 ignores `screenOrientation` on displays at least 600dp wide
//   (tablets, unfolded foldables) for apps targeting API 36, and Android 17 does too for API 37.
//   Apps marked `android:appCategory="game"` are exempt, so this sets it.
//
// The iPhone list stays Expo's portrait default (Portrait plus UpsideDown): an iPhone's default root
// view controller never allows upside down. (expo-screen-orientation's does, on a home-button
// iPhone, from that same list, so an app using this plugin shouldn't install it.)
function withPortraitLock(config, { drawsRotation = true } = {}) {
  if (config.orientation !== undefined && config.orientation !== 'portrait') {
    WarningAggregator.addWarningIOS('orientation', `@tastic/core keeps the OS in portrait, so "orientation": "${config.orientation}" is replaced with "portrait".`)
    WarningAggregator.addWarningAndroid('orientation', `@tastic/core keeps the OS in portrait, so "orientation": "${config.orientation}" is replaced with "portrait".`)
  }
  config.orientation = 'portrait'
  config.ios = {
    ...config.ios,
    requireFullScreen: true,
    infoPlist: {
      ...config.ios?.infoPlist,
      [IPAD_ORIENTATIONS_KEY]: drawsRotation ? ['UIInterfaceOrientationPortrait'] : ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown']
    }
  }
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults)
    application.$['android:appCategory'] = 'game'
    return config
  })
}

module.exports = withPortraitLock

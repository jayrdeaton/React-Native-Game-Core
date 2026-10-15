/**
 * @jest-environment node
 */

// app.plugin.js is what "plugins": ["@tastic/core"] resolves to. Plain CommonJS with no type
// declarations (it only ever runs in Node at prebuild time), hence require() rather than an import.
const withTasticCore = require('../../app.plugin.js')

const KEY = 'UIViewControllerBasedStatusBarAppearance'

const baseConfig = () => ({ name: 'test', slug: 'test', orientation: 'portrait', ios: { supportsTablet: true, infoPlist: { ITSAppUsesNonExemptEncryption: false } } })

describe('withViewControllerStatusBar', () => {
  it('turns on view controller-based status bar appearance, so react-native-screens can hide the bar per screen', () => {
    expect(withTasticCore(baseConfig()).ios.infoPlist[KEY]).toBe(true)
  })

  it('does so for an app that draws no rotation of its own too', () => {
    expect(withTasticCore(baseConfig(), { drawsRotation: false }).ios.infoPlist[KEY]).toBe(true)
  })

  it('overrides an explicit false (what Expo templates and React Native StatusBar setups use)', () => {
    expect(withTasticCore({ ...baseConfig(), ios: { infoPlist: { [KEY]: false } } }).ios.infoPlist[KEY]).toBe(true)
  })

  it("keeps the app's other ios settings and Info.plist keys, and the portrait lock's", () => {
    const config = withTasticCore(baseConfig())

    expect(config.ios.supportsTablet).toBe(true)
    expect(config.ios.requireFullScreen).toBe(true)
    expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false)
    expect(config.ios.infoPlist['UISupportedInterfaceOrientations~ipad']).toEqual(['UIInterfaceOrientationPortrait'])
  })

  it('works on a config with no ios section at all', () => {
    expect(withTasticCore({ name: 'test', slug: 'test' }).ios.infoPlist[KEY]).toBe(true)
  })
})

/**
 * @jest-environment node
 */
import { WarningAggregator } from 'expo/config-plugins'

// app.plugin.js is what "plugins": ["@tastic/core"] resolves to. Plain CommonJS with no type
// declarations (it only ever runs in Node at prebuild time), hence require() rather than an import.
const withPortraitLock = require('../../app.plugin.js')

const IPAD_KEY = 'UISupportedInterfaceOrientations~ipad'

type Manifest = { manifest: { $: Record<string, string>; application: { $: Record<string, string> }[] } }

const baseConfig = () => ({ name: 'test', slug: 'test', orientation: 'portrait', ios: { supportsTablet: true, infoPlist: { ITSAppUsesNonExemptEncryption: false } } })

// A manifest shaped like the one Expo's Android template prebuilds.
const manifestFixture = (): Manifest => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [{ $: { 'android:name': '.MainApplication', 'android:label': '@string/app_name' } }]
  }
})

// Runs the plugin's manifest mod through expo/config-plugins' real withAndroidManifest chain, the
// way prebuild evaluates it, minus the base mod that reads and writes the file itself.
async function applyManifest(config: { mods: { android: { manifest: (config: unknown) => Promise<{ modResults: Manifest }> } } }) {
  const result = await config.mods.android.manifest({ ...config, modResults: manifestFixture(), modRequest: {} })
  return result.modResults.manifest.application[0].$
}

describe('withPortraitLock', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('requires full screen on iPad and limits the iPad orientations to portrait', () => {
    const config = withPortraitLock(baseConfig())

    expect(config.ios.requireFullScreen).toBe(true)
    expect(config.ios.infoPlist[IPAD_KEY]).toEqual(['UIInterfaceOrientationPortrait'])
  })

  it('keeps upside down on iPad for an app that draws no rotation of its own', () => {
    const config = withPortraitLock(baseConfig(), { drawsRotation: false })

    expect(config.ios.requireFullScreen).toBe(true)
    expect(config.ios.infoPlist[IPAD_KEY]).toEqual(['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown'])
  })

  it("keeps the app's other ios settings and Info.plist keys", () => {
    const config = withPortraitLock(baseConfig())

    expect(config.ios.supportsTablet).toBe(true)
    expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false)
  })

  it('works on a config with no ios section at all', () => {
    const config = withPortraitLock({ name: 'test', slug: 'test' })

    expect(config.ios.requireFullScreen).toBe(true)
    expect(config.ios.infoPlist[IPAD_KEY]).toEqual(['UIInterfaceOrientationPortrait'])
  })

  it('overrides an explicit requireFullScreen: false and a wider iPad list', () => {
    const config = withPortraitLock({ ...baseConfig(), ios: { requireFullScreen: false, infoPlist: { [IPAD_KEY]: ['UIInterfaceOrientationLandscapeLeft'] } } })

    expect(config.ios.requireFullScreen).toBe(true)
    expect(config.ios.infoPlist[IPAD_KEY]).toEqual(['UIInterfaceOrientationPortrait'])
  })

  it('sets portrait silently when the app already asks for it', () => {
    const ios = jest.spyOn(WarningAggregator, 'addWarningIOS').mockImplementation(() => {})
    const android = jest.spyOn(WarningAggregator, 'addWarningAndroid').mockImplementation(() => {})

    expect(withPortraitLock(baseConfig()).orientation).toBe('portrait')
    expect(withPortraitLock({ name: 'test', slug: 'test' }).orientation).toBe('portrait')
    expect(ios).not.toHaveBeenCalled()
    expect(android).not.toHaveBeenCalled()
  })

  it('replaces any other orientation with portrait, and warns', () => {
    const ios = jest.spyOn(WarningAggregator, 'addWarningIOS').mockImplementation(() => {})
    const android = jest.spyOn(WarningAggregator, 'addWarningAndroid').mockImplementation(() => {})

    expect(withPortraitLock({ ...baseConfig(), orientation: 'default' }).orientation).toBe('portrait')
    expect(ios).toHaveBeenCalledWith('orientation', expect.stringContaining('"default"'))
    expect(android).toHaveBeenCalledWith('orientation', expect.stringContaining('"default"'))
  })

  it.each([
    ['draws its own rotation', {}],
    ['draws no rotation', { drawsRotation: false }]
  ])('marks the Android app as a game when it %s, so large screens keep the portrait lock', async (_label, options) => {
    const application = await applyManifest(withPortraitLock(baseConfig(), options))

    expect(application['android:appCategory']).toBe('game')
    // Everything else on <application> is left alone.
    expect(application['android:name']).toBe('.MainApplication')
    expect(application['android:label']).toBe('@string/app_name')
  })
})

import { addOrientationChangeListener, getOrientationAsync, Orientation } from 'expo-screen-orientation'
import { Dimensions, Platform } from 'react-native'

// The same module instance jest.config.cjs maps expo-screen-orientation to, imported by path for its
// test-only listener set (the real package's types don't have it).
import { orientationListeners as listeners } from '../__mocks__/expo-screen-orientation'
import { trackInterfaceOrientation } from '../interfaceOrientation/trackInterfaceOrientation'

const turn = (orientation: Orientation) => listeners.forEach((listener) => listener({ orientationInfo: { orientation } }))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('trackInterfaceOrientation', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.resolve(Orientation.PORTRAIT_UP))
    ;(Dimensions.get as jest.Mock).mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 })
    listeners.clear()
  })

  it('reads the interface orientation once, then follows every turn', async () => {
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.resolve(Orientation.LANDSCAPE_LEFT))
    const tracker = trackInterfaceOrientation()
    await flush()
    expect(tracker.current(0)).toBe(Orientation.LANDSCAPE_LEFT)
    turn(Orientation.PORTRAIT_DOWN)
    expect(tracker.current(0)).toBe(Orientation.PORTRAIT_DOWN)
    tracker.remove()
  })

  it('lets a turn that lands before the first read resolves win over that older answer', async () => {
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.resolve(Orientation.PORTRAIT_UP))
    const tracker = trackInterfaceOrientation()
    turn(Orientation.LANDSCAPE_RIGHT)
    await flush()
    expect(tracker.current(0)).toBe(Orientation.LANDSCAPE_RIGHT)
    tracker.remove()
  })

  it('stands in from the window shape and the hold on iOS while the module reports UNKNOWN', async () => {
    Platform.OS = 'ios'
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.resolve(Orientation.UNKNOWN))
    ;(Dimensions.get as jest.Mock).mockReturnValue({ width: 1376, height: 1032, scale: 2, fontScale: 1 })
    const tracker = trackInterfaceOrientation()
    await flush()
    expect(tracker.current(90)).toBe(Orientation.LANDSCAPE_LEFT)
    // Lying flat keeps the last landscape side.
    expect(tracker.current(0)).toBe(Orientation.LANDSCAPE_LEFT)
    turn(Orientation.LANDSCAPE_RIGHT)
    expect(tracker.current(90)).toBe(Orientation.LANDSCAPE_RIGHT)
    tracker.remove()
  })

  it('leaves UNKNOWN alone on Android, which always reads the display', async () => {
    Platform.OS = 'android'
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.resolve(Orientation.UNKNOWN))
    const tracker = trackInterfaceOrientation()
    await flush()
    expect(tracker.current(90)).toBe(Orientation.UNKNOWN)
    tracker.remove()
  })

  it('stays UNKNOWN (with the iOS stand-in) when the first read fails', async () => {
    Platform.OS = 'ios'
    ;(getOrientationAsync as jest.Mock).mockImplementation(() => Promise.reject(new Error('no scene')))
    const tracker = trackInterfaceOrientation()
    await flush()
    expect(tracker.current(180)).toBe(Orientation.PORTRAIT_DOWN)
    tracker.remove()
  })

  it('stops following once removed', () => {
    const tracker = trackInterfaceOrientation()
    expect(addOrientationChangeListener).toHaveBeenCalled()
    tracker.remove()
    expect(listeners.size).toBe(0)
  })
})

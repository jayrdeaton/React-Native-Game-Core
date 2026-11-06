// expo-screen-orientation's built entry is ESM that Jest can't load from node_modules (the same reason
// as expo-system-ui's mock). Mirrors the real enum's values (ScreenOrientation.types.ts); a test fires
// a turn through `orientationListeners`.
export enum Orientation {
  UNKNOWN = 0,
  PORTRAIT_UP = 1,
  PORTRAIT_DOWN = 2,
  LANDSCAPE_LEFT = 3,
  LANDSCAPE_RIGHT = 4
}

type OrientationListener = (event: { orientationInfo: { orientation: Orientation } }) => void
export const orientationListeners = new Set<OrientationListener>()
export const addOrientationChangeListener = jest.fn((listener: OrientationListener) => {
  orientationListeners.add(listener)
  return { remove: jest.fn(() => orientationListeners.delete(listener)) }
})
export const getOrientationAsync = jest.fn(() => Promise.resolve(Orientation.PORTRAIT_UP))

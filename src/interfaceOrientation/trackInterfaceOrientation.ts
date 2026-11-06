import { addOrientationChangeListener, getOrientationAsync, Orientation } from 'expo-screen-orientation'
import { Dimensions, Platform } from 'react-native'

import { interfaceOrientationFromHold } from './tilt'

export interface InterfaceOrientationTracker {
  // The interface orientation right now. `heldRotation` is DeviceMotion's own `orientation` from the
  // same sample; it's only used on iOS while expo-screen-orientation still reports UNKNOWN (see
  // interfaceOrientationFromHold). Android always reads the display, so it never needs it.
  current: (heldRotation: number) => Orientation
  remove: () => void
}

// Follows the interface orientation for a DeviceMotion listener, without re-rendering anything: start
// it where the listener is subscribed, read `current(measurement.orientation)` in each sample, and
// `remove()` it with the listener. Reads once and then follows every turn; a turn that lands before
// the first read resolves wins over that read's older answer.
export function trackInterfaceOrientation(): InterfaceOrientationTracker {
  let interfaceOrientation = Orientation.UNKNOWN
  let heldOrientation = Orientation.PORTRAIT_UP
  let changed = false
  const subscription = addOrientationChangeListener(({ orientationInfo }) => {
    changed = true
    interfaceOrientation = orientationInfo.orientation
  })
  getOrientationAsync()
    .then((orientation) => {
      if (!changed) interfaceOrientation = orientation
    })
    .catch(() => {
      // Stays UNKNOWN until the first turn, with the stand-in in current() covering it on iOS
    })
  return {
    current: (heldRotation) => {
      if (interfaceOrientation !== Orientation.UNKNOWN || Platform.OS !== 'ios') return interfaceOrientation
      const window = Dimensions.get('window')
      heldOrientation = interfaceOrientationFromHold(window.width > window.height, heldRotation, heldOrientation)
      return heldOrientation
    },
    remove: () => subscription.remove()
  }
}

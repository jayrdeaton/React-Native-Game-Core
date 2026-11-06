// `@tastic/core/interface-orientation`: turning DeviceMotion tilt into the axes of a screen the OS has
// turned. Its own entry because it imports expo-screen-orientation (an optional peer), which the root
// barrel must not load for apps that don't install it.
export { interfaceOrientationFromHold, tiltToScreenAxes } from './tilt'
export { type InterfaceOrientationTracker, trackInterfaceOrientation } from './trackInterfaceOrientation'

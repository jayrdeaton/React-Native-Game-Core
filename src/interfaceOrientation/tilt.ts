import { Orientation } from 'expo-screen-orientation'

// How far the device's right edge dips below the horizon, in radians (negative when it rises): what
// to read in place of DeviceMotion's `rotation.gamma`. Both platforms report gamma as an Euler roll,
// atan2(-up.x, up.z) for the up vector in the device's frame (Android's SensorManager.getOrientation,
// iOS's CMAttitude.roll), which only behaves while the screen faces the sky. A phone held upright has
// up.z near 0, so gamma swings tens of degrees on a hand's tremor, and once the phone tips past
// vertical it jumps by 180 (PuckTastic's paddle pinned at one end on Jay's Android, 2026-11-15). Both
// platforms give up = (-sin(gamma) cos(beta), sin(beta), cos(gamma) cos(beta)), beta being the asin
// one, so -up.x, the sine of the right edge's dip, is sin(gamma) cos(beta): the jump and the swing
// cancel out of it, and it's continuous at every hold. Lying flat it's gamma exactly. The clamp only
// keeps rounding from reaching asin's NaN.
export function edgeDip(beta: number, gamma: number): number {
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(gamma) * Math.cos(beta))))
}

// DeviceMotion reports tilt in the device's own frame, so its two angles always mean "along the edge
// that's horizontal in portrait" / "along the long edge" no matter which way the screen is turned.
// When the interface turns with the device, that vector has to be turned into the screen's own axes,
// or tilting toward the right of a landscape screen moves things toward the top instead. Pass
// edgeDip(beta, gamma) as `dip`, never raw gamma (see edgeDip), and beta as it comes.
//
// `orientation` is the interface orientation (expo-screen-orientation), not how the device is held:
// with the system rotation lock on the two differ, and tilt has to follow the screen as drawn. Its
// landscape names are the interface's (UIInterfaceOrientation on iOS, the display rotation on
// Android), so LANDSCAPE_RIGHT is the device turned counter-clockwise (its top edge pointing left)
// and LANDSCAPE_LEFT clockwise, on both platforms. UNKNOWN reads as portrait. The units are whatever
// dip and beta come in (radians from expo-sensors).
export function tiltToScreenAxes(dip: number, beta: number, orientation: Orientation): { x: number; y: number } {
  switch (orientation) {
    case Orientation.LANDSCAPE_RIGHT:
      // Screen right is the device's bottom edge, screen down its left edge.
      return { x: beta, y: -dip }
    case Orientation.LANDSCAPE_LEFT:
      // Screen right is the device's top edge, screen down its right edge.
      return { x: -beta, y: dip }
    case Orientation.PORTRAIT_DOWN:
      return { x: -dip, y: -beta }
    default:
      return { x: dip, y: beta }
  }
}

// expo-screen-orientation on iOS reports UNKNOWN until the interface first turns: it reads the window
// scene once at launch, before the scene is connected. Until then this decides it the way the module
// itself does after a turn: the window's shape says portrait or landscape, and how the device is held
// says which way round. `heldRotation` is DeviceMotion's own `orientation` on iOS (UIDevice: -90 is
// turned counter-clockwise, 90 clockwise, 180 upside down, 0 portrait or lying flat). A landscape
// window with no landscape hold to go by (lying flat, or rotation lock on) keeps `previous`'s side.
export function interfaceOrientationFromHold(windowIsLandscape: boolean, heldRotation: number, previous: Orientation): Orientation {
  if (windowIsLandscape) {
    if (heldRotation === -90) return Orientation.LANDSCAPE_RIGHT
    if (heldRotation === 90) return Orientation.LANDSCAPE_LEFT
    return previous === Orientation.LANDSCAPE_LEFT ? Orientation.LANDSCAPE_LEFT : Orientation.LANDSCAPE_RIGHT
  }
  return heldRotation === 180 ? Orientation.PORTRAIT_DOWN : Orientation.PORTRAIT_UP
}

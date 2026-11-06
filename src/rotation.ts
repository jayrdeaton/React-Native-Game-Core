import { OrientationMode } from './OrientationMode'

export type ViewRotation = 0 | 90 | 180 | -90

// Degrees to turn content for a seat mode. Until 0.15 a side by side reading on native meant the
// phone was held sideways in a portrait-locked app, and this returned ±90 to turn the content the
// rest of the way. The OS turns the interface now, and useOrientationState reads side by side from a
// wide window, which is already the right shape, so side by side is 0, as it always was on web.
// upsideDown keeps its 180 for a caller that passes it, though useOrientationState never reports it.
// p1OnRight no longer changes the angle.
export function getViewRotation(orientationMode: OrientationMode, _p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  return orientationMode === 'faceToFace' && upsideDown ? 180 : 0
}

// For a layout whose two seats sit in permanently fixed zones (the top and bottom halves of a
// portrait screen, say). A portrait reading never turns them, upside down or not: the zones can't
// swap seats because the device was spun. Since 0.15 side by side is 0 too (see getViewRotation), so
// this is always 0; kept until @tastic/split-screen stops re-exporting it.
export function getFixedZoneRotation(orientationMode: OrientationMode, p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  return orientationMode === 'sideBySide' ? getViewRotation(orientationMode, p1OnRight, upsideDown) : 0
}

// The seat on the OPPOSITE side of a getFixedZoneRotation layout from whichever seat `rotation` was
// already computed for - e.g. seat 2 in a 2-seat face-to-face split, given seat 1's own rotation.
// Landscape (±90°): both seats are held side by side, facing the same way, so the opposing seat
// reads the identical rotation, unchanged. Portrait (0°/180°): the two seats sit across the device
// from each other, so the opposing seat's content needs the other of the two portrait angles to
// read right-side-up from their side - the same fixed flip a static 2-player face-to-face layout
// has always needed, just generalized to ride on top of whatever getFixedZoneRotation produced.
export function getOpposingZoneRotation(rotation: ViewRotation): ViewRotation {
  if (Math.abs(rotation) === 90) return rotation
  return rotation === 0 ? 180 : 0
}

// The RN style object that actually applies one of the angles above to a View/Text - guarded so a
// 0° rotation contributes no transform at all, rather than an inert `rotate: '0deg'` entry, so a
// style array's own `cond && {...}` idiom short-circuits to `false` instead of an object every
// consumer would need to no-op anyway. Exists because this exact guarded expression was
// independently hand-typed at a dozen-plus call sites across the fleet's own game screens/dialogs -
// and 3 separate times inside @tastic/hud itself, which already imports ViewRotation from here - so
// it belongs beside getViewRotation/getFixedZoneRotation/getOpposingZoneRotation rather than staying
// unowned. `% 360` (not a bare `!== 0` check) matches the majority of those existing call sites; it's
// equivalent for every value ViewRotation can hold, so there's no behavior change in adopting it.
export function toRotationStyle(rotation: ViewRotation): { transform: [{ rotate: string }] } | undefined {
  return rotation % 360 !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined
}

// A ±90 turn swaps a footprint's width and height; 0 and 180 don't change it. Only an explicit ±90
// (hud's RotatedFrame and its callers) still reaches the swap; nothing in this package asks for one
// since 0.15.
export function rotateDimensions(width: number, height: number, rotation: ViewRotation): { width: number; height: number } {
  return Math.abs(rotation) === 90 ? { width: height, height: width } : { width, height }
}

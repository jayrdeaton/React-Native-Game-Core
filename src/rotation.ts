import { Platform } from 'react-native'

import { OrientationMode } from './OrientationMode'

export type ViewRotation = 0 | 90 | 180 | -90

// Degrees to rotate a portrait-locked screen's CONTENT so it reads gravity-upright regardless of
// how the device is actually being held. Needed at all only because the consuming app locks itself
// to portrait permanently at the OS level (see useOrientationState's own top comment) — the render
// surface itself never rotates anymore, so without this, content stays glued to the device's own
// physical top edge no matter which way the device is turned; today's existing "unrotated in
// sideBySide" behavior only ever made sense when the OS was the one doing the actual rotating.
//
// sideBySide's rotation direction is tied to p1OnRight (already resolved against the same physical
// hold), not computed independently — there's no separate "upside-down landscape" case, only two
// landscape directions total. faceToFace ignores p1OnRight entirely and just applies upsideDown's
// own flip. Verified against a real device: p1OnRight's sign (from useOrientationState) needed the
// OPPOSITE rotation from the first guess to read right-side-up — flip back here (not there) if a
// future hardware change ever needs it, since p1OnRight's own left/right meaning was separately
// confirmed correct on the same device.
//
// Web is excluded from sideBySide's own rotation entirely — that ±90° only exists to compensate for
// a portrait-locked OS refusing to rotate its render surface for a physically-tilted device (see
// this function's own top comment). A browser window has no such lock and no physical tilt to
// compensate for: useOrientationState's own web fallback picks sideBySide purely from the window
// already being wider than tall, so the window is already the correct shape on its own — applying
// the native compensating rotation on top would spin already-correctly-oriented content sideways
// instead of fixing anything. upsideDown's own 180° needs no matching exclusion: web's fallback
// never reports upsideDown true in the first place (there's no signal to derive it from), so that
// branch is already inert there.
export function getViewRotation(orientationMode: OrientationMode, p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  if (orientationMode === 'sideBySide' && Platform.OS !== 'web') return p1OnRight ? -90 : 90
  return upsideDown ? 180 : 0
}

// For a layout whose two seats sit in PERMANENTLY fixed zones — e.g. always the top/bottom halves
// of a portrait-locked screen, never reflowing into left/right the way a fading dual-zone layout's
// own panels do — only a genuine landscape hold means anything. Two seats held side by side
// (landscape) read the screen the same way up, so that tilt rotates both zones' content
// identically — see getOpposingZoneRotation below for the one place they then differ. A portrait
// tilt, "upside down" or not, doesn't correspond to anything real for this layout: the zones can't
// swap which physical seat each is nearest just because the device got spun while lying flat, so
// unlike getViewRotation's own faceToFace branch, this deliberately never applies its 180°
// upside-down flip — content just stays at 0° for any portrait-like reading.
export function getFixedZoneRotation(orientationMode: OrientationMode, p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  return orientationMode === 'sideBySide' ? getViewRotation(orientationMode, p1OnRight, upsideDown) : 0
}

// The seat on the OPPOSITE side of a getFixedZoneRotation layout from whichever seat `rotation` was
// already computed for — e.g. seat 2 in a 2-seat face-to-face split, given seat 1's own rotation.
// Landscape (±90°): both seats are held side by side, facing the same way, so the opposing seat
// reads the identical rotation, unchanged. Portrait (0°/180°): the two seats sit across the device
// from each other, so the opposing seat's content needs the other of the two portrait angles to
// read right-side-up from their side — the same fixed flip a static 2-player face-to-face layout
// has always needed, just generalized to ride on top of whatever getFixedZoneRotation produced.
export function getOpposingZoneRotation(rotation: ViewRotation): ViewRotation {
  if (Math.abs(rotation) === 90) return rotation
  return rotation === 0 ? 180 : 0
}

// The RN style object that actually applies one of the angles above to a View/Text — guarded so a
// 0° rotation contributes no transform at all, rather than an inert `rotate: '0deg'` entry, so a
// style array's own `cond && {...}` idiom short-circuits to `false` instead of an object every
// consumer would need to no-op anyway. Exists because this exact guarded expression was
// independently hand-typed at a dozen-plus call sites across the fleet's own game screens/dialogs —
// and 3 separate times inside @tastic/hud itself, which already imports ViewRotation from here — so
// it belongs beside getViewRotation/getFixedZoneRotation/getOpposingZoneRotation rather than staying
// unowned. `% 360` (not a bare `!== 0` check) matches the majority of those existing call sites; it's
// equivalent for every value ViewRotation can hold, so there's no behavior change in adopting it.
export function toRotationStyle(rotation: ViewRotation): { transform: [{ rotate: string }] } | undefined {
  return rotation % 360 !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined
}

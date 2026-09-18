import { StatusBar } from 'expo-status-bar'

import { getViewRotation } from './rotation'
import { useOrientationState } from './useOrientationState'

export interface RotationAwareStatusBarProps {
  // Defaults to false — matches useOrientationState's own default when called with no argument, so
  // a bare <RotationAwareStatusBar /> tracks live tilt exactly like a bare useOrientationState()
  // call would. Pass the same value a screen's own useOrientationState(lockOrientation) call uses
  // (e.g. a Redux/context-backed "Lock Orientation" setting) so this bar's hidden/shown state can
  // never diverge from whatever rotation that screen's own content is actually committed to —
  // passing nothing here would keep tracking live tilt unconditionally even while the content
  // beside it has frozen, which is exactly the divergence a locked screen exists to prevent.
  locked?: boolean
}

// Hides the real OS status bar whenever this package's own rotation system (getViewRotation, as
// consumed directly here and by FakeLandscapeView) has visually rotated content elsewhere on
// screen. The OS status bar is physically glued to the device's top edge and can't itself rotate to
// match — so the moment anything is spun into sideBySide (±90°) or upside-down faceToFace (180°),
// a status bar left showing renders sideways or upside-down against content that's otherwise
// correctly compensated, which reads as broken rather than merely unrotated. Unrotated (0°) is the
// only state where showing it is actually correct, so `hidden` is just `rotation !== 0`.
//
// All 5 apps in this package's fleet (AirHockey, BoxHockey, LightCycles, Pong, Snake) independently
// hand-rolled this exact ~10-line component in their own root _layout.tsx before it moved here —
// same "identical file duplicated per-app until extracted" story as FakeLandscapeView's own history
// note. BoxHockey's version was the reference shape the other 4 were brought in line with first
// (threading a `locked` value through their own useOrientationState call the same way BoxHockey
// already did), which is what this component now does directly instead of leaving each app to wire
// up its own thin wrapper.
//
// Reads orientation via useOrientationState directly, unlike FakeLandscapeView's optional
// orientationMode/p1OnRight/upsideDown override props — a status bar has no rendered content of its
// own that could need to desync from the ambient reading (FakeLandscapeView's fading dual-zone case
// doesn't apply here), so there's nothing an explicit override would ever be for.
//
// expo-status-bar is a real (non-peer-optional) dependency here rather than an injected-module prop
// the way OrientationProvider takes `deviceMotion` for expo-sensors: unlike expo-sensors, every
// consuming app already depends on expo-status-bar directly for its own screens (e.g. /game's own
// unconditional <StatusBar hidden />), so requiring it package-wide adds no new install burden.
export function RotationAwareStatusBar({ locked = false }: RotationAwareStatusBarProps = {}) {
  const { orientationMode, p1OnRight, upsideDown } = useOrientationState(locked)
  const rotation = getViewRotation(orientationMode, p1OnRight, upsideDown)
  return <StatusBar hidden={rotation !== 0} />
}

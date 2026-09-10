import { getViewRotation, ViewRotation } from './rotation'
import { useOrientationState } from './useOrientationState'

// Convenience hook for the common case: a caller that only ever needs the final rotation ANGLE, not
// the raw orientationMode/p1OnRight/upsideDown triple itself (e.g. a popover/dialog that just needs
// to know how many degrees to rotate its own content — see @tastic/hud's SectionedDropdown/
// BaseSettingsDialog/BaseStatsScreen/InlineColorPicker, which all consume exactly this). Collapses
// the two-step useOrientationState() + getViewRotation(...) pattern that was previously duplicated
// at every one of these call sites into one line.
//
// Not a universal replacement for the two-step call — a screen that needs the raw triple for its own
// reasons (e.g. BoxHockey's game screen, which branches its board-flip logic directly on
// orientationMode/upsideDown rather than the derived angle) should keep calling useOrientationState
// itself.
export function useRotation(locked = false): ViewRotation {
  const { orientationMode, p1OnRight, upsideDown } = useOrientationState(locked)
  return getViewRotation(orientationMode, p1OnRight, upsideDown)
}

import { ViewRotation } from './rotation'

export interface EdgeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

// Clockwise compass order — index arithmetic below walks this cycle to remap edges under rotation.
const COMPASS: (keyof EdgeInsets)[] = ['top', 'right', 'bottom', 'left']

// react-native-safe-area-context's useSafeAreaInsets() always reports insets relative to the
// device's own fixed physical frame (the notch is always "top", the home indicator always
// "bottom") — because the OS itself thinks the interface is still portrait-locked and never
// rotates, safe-area-context has no idea a FakeLandscapeView-style ancestor is rotating the content
// underneath it. Positioning something at `top: insets.top` inside rotated content puts it near the
// content's own pre-rotation top edge, which after rotation may visually land nowhere near the
// screen's real top — e.g. under a 90° rotation it ends up on a visual side edge instead. This
// remaps a physical EdgeInsets onto whichever edge it actually corresponds to once rotated by the
// same `rotation` getViewRotation already computed, so `top: rotated.top` always lands at the
// screen's real, visual top regardless of how the device is being held.
export function rotateInsets(insets: EdgeInsets, rotation: ViewRotation): EdgeInsets {
  const steps = (((rotation / 90) % 4) + 4) % 4
  const edgeFor = (visualEdge: keyof EdgeInsets) => insets[COMPASS[(COMPASS.indexOf(visualEdge) + steps) % 4]]
  return { top: edgeFor('top'), right: edgeFor('right'), bottom: edgeFor('bottom'), left: edgeFor('left') }
}

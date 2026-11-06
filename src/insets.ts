import { ViewRotation } from './rotation'

export interface EdgeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

// Clockwise compass order - index arithmetic below walks this cycle to remap edges under rotation.
const COMPASS: (keyof EdgeInsets)[] = ['top', 'right', 'bottom', 'left']

// Remaps safe-area insets (reported in the screen's own frame) onto the edges of content turned by
// `rotation`, so `top: rotated.top` lands at the screen's real top inside turned content. Since 0.15
// nothing in this package turns content, so callers pass 0 and get the insets back unchanged; it goes
// once @tastic/hud and @tastic/split-screen stop calling it.
export function rotateInsets(insets: EdgeInsets, rotation: ViewRotation): EdgeInsets {
  const steps = (((rotation / 90) % 4) + 4) % 4
  const edgeFor = (visualEdge: keyof EdgeInsets) => insets[COMPASS[(COMPASS.indexOf(visualEdge) + steps) % 4]]
  return { top: edgeFor('top'), right: edgeFor('right'), bottom: edgeFor('bottom'), left: edgeFor('left') }
}

import { clamp } from './clamp'

// One nominal 60fps frame, in milliseconds — the unit dt is expressed in, so dt = 1 means "a normal
// frame" regardless of the device's actual refresh rate.
const NOMINAL_FRAME_MS = 1000 / 60

// Converts the raw gap between two rAF timestamps into a frame-count multiplier, clamped so a single
// step never represents more than maxDt nominal frames — protects a caller's own per-frame math
// (friction decay, sub-stepped collision, a fixed-timestep tick) from a huge, destabilizing leap
// after a stutter, background/foreground cycle, or debugger pause. Returns 1 (a normal frame) when
// there's no prior timestamp yet, i.e. the first tick of a fresh loop.
export function computeClampedDt(timestamp: number, lastTimestamp: number | null, maxDt: number): number {
  if (lastTimestamp === null) return 1
  return clamp((timestamp - lastTimestamp) / NOMINAL_FRAME_MS, 0, maxDt)
}

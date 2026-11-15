// The accumulator counts time in whole ticks, never in fractional milliseconds. A tick is 1/39,600 of a
// millisecond (about 25 ns). 39,600 is the least common multiple of the usual display refresh rates
// (24, 30, 48, 50, 60, 75, 90, 100, 120, 144, 165 and 240 Hz), so one frame at any of those rates, a
// step at any of them, and any whole number of milliseconds is a whole number of ticks: a 60 Hz frame is
// 660,000, a 1/120 s step 330,000, a 144 Hz frame 275,000, and useGameLoop's worst case, 2.5 nominal
// frames (1/24 s), 1,650,000.
//
// Why: in floating point those durations don't divide evenly. 2.5 * (1000 / 60) ms is 41.666...67, and
// the textbook `while (acc >= step) { acc -= step; steps++ }` loop over it with a 1000 / 120 step runs 4
// steps and leaves 8.33333333333333 behind, just short of a fifth, so the clamp's worst case loses a step
// and the leftover drifts frame to frame. Rounding each advance's dtMs to a tick once soaks up that
// float noise (41.666...67 ms is 1,650,000.0000000002 ticks, rounded to 1,650,000), and from there it's
// integer arithmetic: 1,650,000 / 330,000 is exactly 5, and a remainder of 0 is exactly alpha 0.
//
// A tick is fine enough that a dtMs off this grid (a jittery real timestamp) loses at most half a tick,
// about 13 ns, per advance, under a millionth of a 60 Hz frame. The accumulator never holds more than
// maxSteps steps' worth of ticks (1,650,000 for five 1/120 s steps), far inside the integers a
// double holds exactly. A stepMs off the grid (say 1000 / 7) is rounded to the nearest tick once, here.
const TICKS_PER_MS = 39_600

export interface FixedStepAccumulator {
  // Adds dtMs of elapsed time and returns how many whole steps to run now, never more than maxSteps.
  // A dtMs that is zero, negative or NaN adds nothing (computeClampedDt floors a rewound clock at 0).
  advance(dtMs: number): number
  // The leftover fraction of a step after the last advance, in [0, 1): how far the next step has got,
  // for interpolating the drawn state between the last two simulated ones. 0 before any advance.
  readonly alpha: number
  // Drops every accumulated tick, so alpha is 0 and the next advance starts from nothing.
  reset(): void
}

// A fixed-timestep accumulator for a simulation stepped at a constant stepMs, driven by a variable
// frame time (useGameLoop's dt, turned into milliseconds with `dt * NOMINAL_FRAME_MS`). Each frame,
// `advance(dtMs)` says how many steps to run, and `alpha` how far between the last two states to draw.
// Time beyond maxSteps whole steps is discarded rather than carried, so a long hitch never queues up a
// backlog of steps to catch up on (no spiral of death); after such an advance alpha is 0. Pure: no
// timers, no React, no clock of its own.
export function createFixedStepAccumulator(stepMs: number, maxSteps: number): FixedStepAccumulator {
  const stepTicks = Math.round(stepMs * TICKS_PER_MS)
  if (!Number.isFinite(stepMs) || stepTicks < 1) throw new RangeError(`createFixedStepAccumulator: stepMs must be a positive, finite number of milliseconds (got ${stepMs})`)
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError(`createFixedStepAccumulator: maxSteps must be a whole number of at least 1 (got ${maxSteps})`)

  // The most ticks the accumulator ever holds: maxSteps whole steps. Clamping to it as soon as time is
  // added is what discards the excess, and keeps a huge (or Infinity) dtMs from leaving the exact
  // integer range.
  const capTicks = stepTicks * maxSteps
  let ticks = 0

  return {
    advance(dtMs: number): number {
      if (dtMs > 0) ticks = Math.min(ticks + Math.round(dtMs * TICKS_PER_MS), capTicks)
      const leftover = ticks % stepTicks
      const steps = (ticks - leftover) / stepTicks
      ticks = leftover
      return steps
    },
    get alpha(): number {
      return ticks / stepTicks
    },
    reset(): void {
      ticks = 0
    }
  }
}

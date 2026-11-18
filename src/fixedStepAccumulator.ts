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

// The accumulator's whole state as a plain object, for a simulation that runs inside a Reanimated worklet
// (a useFrameCallback on the UI thread). A closure made on the JS thread can't be called from there, but a
// plain object of numbers can live in a shared value, or inside the simulation's own state, and be stepped
// with advanceFixedStep, fixedStepAlpha and resetFixedStep, which are all 'worklet'. createFixedStepAccumulator
// is the same bookkeeping wrapped in a closure, for the JS thread.
export interface FixedStepState {
  // Ticks accumulated toward the next step, always fewer than one step's worth between advances.
  ticks: number
  // One step, in ticks.
  stepTicks: number
  // The most ticks ever held: maxSteps whole steps. Clamping to it as soon as time is added is what
  // discards the excess, and keeps a huge (or Infinity) dtMs from leaving the exact integer range.
  capTicks: number
}

// Checks the arguments and makes the state, naming the caller in the error. Declared before the worklets that call it:
// the Babel worklets plugin turns each 'worklet' function into a constant, so a worklet can't reach a function
// declared further down the file (hoisting doesn't survive the transform).
function newState(caller: string, stepMs: number, maxSteps: number): FixedStepState {
  'worklet'
  const stepTicks = Math.round(stepMs * TICKS_PER_MS)
  if (!Number.isFinite(stepMs) || stepTicks < 1) throw new RangeError(`${caller}: stepMs must be a positive, finite number of milliseconds (got ${stepMs})`)
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError(`${caller}: maxSteps must be a whole number of at least 1 (got ${maxSteps})`)
  return { ticks: 0, stepTicks, capTicks: stepTicks * maxSteps }
}

// A fresh state for a step of stepMs, at most maxSteps steps an advance. Throws a RangeError unless stepMs is a
// positive, finite number of milliseconds and maxSteps a whole number of at least 1.
export function createFixedStepState(stepMs: number, maxSteps: number): FixedStepState {
  'worklet'
  return newState('createFixedStepState', stepMs, maxSteps)
}

// Adds dtMs of elapsed time to the state and returns how many whole steps to run now, never more than
// maxSteps. A dtMs that is zero, negative or NaN adds nothing.
export function advanceFixedStep(state: FixedStepState, dtMs: number): number {
  'worklet'
  if (dtMs > 0) state.ticks = Math.min(state.ticks + Math.round(dtMs * TICKS_PER_MS), state.capTicks)
  const leftover = state.ticks % state.stepTicks
  const steps = (state.ticks - leftover) / state.stepTicks
  state.ticks = leftover
  return steps
}

// The leftover fraction of a step, in [0, 1): how far the next step has got. 0 before any advance.
export function fixedStepAlpha(state: FixedStepState): number {
  'worklet'
  return state.ticks / state.stepTicks
}

// Drops every accumulated tick, so alpha is 0 and the next advance starts from nothing.
export function resetFixedStep(state: FixedStepState): void {
  'worklet'
  state.ticks = 0
}

// A fixed-timestep accumulator for a simulation stepped at a constant stepMs, driven by a variable
// frame time (useGameLoop's dt, turned into milliseconds with `dt * NOMINAL_FRAME_MS`). Each frame,
// `advance(dtMs)` says how many steps to run, and `alpha` how far between the last two states to draw.
// Time beyond maxSteps whole steps is discarded rather than carried, so a long hitch never queues up a
// backlog of steps to catch up on (no spiral of death); after such an advance alpha is 0. Pure: no
// timers, no React, no clock of its own. The FixedStepState functions above, in a closure.
export function createFixedStepAccumulator(stepMs: number, maxSteps: number): FixedStepAccumulator {
  const state = newState('createFixedStepAccumulator', stepMs, maxSteps)

  return {
    advance(dtMs: number): number {
      return advanceFixedStep(state, dtMs)
    },
    get alpha(): number {
      return fixedStepAlpha(state)
    },
    reset(): void {
      resetFixedStep(state)
    }
  }
}

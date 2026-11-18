import { computeClampedDt, NOMINAL_FRAME_MS } from '../computeClampedDt'
import { advanceFixedStep, createFixedStepAccumulator, createFixedStepState, fixedStepAlpha, resetFixedStep } from '../fixedStepAccumulator'
import * as core from '../index'

// Labyrinth's physics step: 1/120 s, at most 5 steps a frame (useGameLoop's 2.5-frame clamp is exactly
// 5 of them).
const STEP_MS = 1000 / 120
const MAX_STEPS = 5

// useGameLoop's real path: rAF timestamps through computeClampedDt into nominal frames, then back to
// milliseconds the way a caller would (`dt * NOMINAL_FRAME_MS`), timestamps and all, float noise included.
function frameDtMs(hz: number, frame: number, start = 1000): number {
  const previous = start + ((frame - 1) * 1000) / hz
  const current = start + (frame * 1000) / hz
  return computeClampedDt(current, previous, 2.5) * NOMINAL_FRAME_MS
}

// A seeded generator, so the fuzz below is the same on every run.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('NOMINAL_FRAME_MS', () => {
  it('is one 60fps frame, the unit computeClampedDt measures dt in', () => {
    expect(NOMINAL_FRAME_MS).toBe(1000 / 60)
    expect(computeClampedDt(1000 + NOMINAL_FRAME_MS, 1000, 2.5)).toBeCloseTo(1, 10)
  })

  it('is exported from the root entry, with the accumulator', () => {
    expect(core.NOMINAL_FRAME_MS).toBe(NOMINAL_FRAME_MS)
    expect(core.createFixedStepAccumulator).toBe(createFixedStepAccumulator)
  })
})

describe('createFixedStepAccumulator', () => {
  it('runs exactly 5 steps of 1/120 s for the clamp worst case, 2.5 nominal frames', () => {
    // The trap this exists for: in floating point, the textbook subtract loop runs only 4.
    let floatAcc = 2.5 * NOMINAL_FRAME_MS
    let floatSteps = 0
    while (floatAcc >= STEP_MS) {
      floatAcc -= STEP_MS
      floatSteps++
    }
    expect(floatSteps).toBe(4)

    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    expect(accumulator.advance(2.5 * NOMINAL_FRAME_MS)).toBe(5)
    expect(accumulator.alpha).toBe(0)

    // The same through computeClampedDt's clamp, after a long stall.
    expect(accumulator.advance(computeClampedDt(1000 + 10_000, 1000, 2.5) * NOMINAL_FRAME_MS)).toBe(5)
    expect(accumulator.alpha).toBe(0)
  })

  it('runs exactly 2 steps every 60 fps frame with alpha 0, frame after frame', () => {
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    for (let frame = 1; frame <= 10_000; frame++) {
      expect(accumulator.advance(NOMINAL_FRAME_MS)).toBe(2)
      expect(accumulator.alpha).toBe(0)
    }
    for (let frame = 1; frame <= 10_000; frame++) {
      expect(accumulator.advance(frameDtMs(60, frame))).toBe(2)
      expect(accumulator.alpha).toBe(0)
    }
  })

  it('averages exactly 120 steps a second at 144 Hz, with no drift over a minute', () => {
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    let frame = 0
    for (let second = 1; second <= 60; second++) {
      let steps = 0
      for (let i = 0; i < 144; i++) {
        const ran = accumulator.advance(frameDtMs(144, ++frame))
        // A 144 Hz frame is 5/6 of a step, so each frame runs 0 or 1.
        expect(ran === 0 || ran === 1).toBe(true)
        steps += ran
      }
      expect(steps).toBe(120)
      // 144 frames are exactly 120 steps, so nothing is left over at each whole second.
      expect(accumulator.alpha).toBe(0)
    }
  })

  it('never returns more than maxSteps and discards the time beyond them', () => {
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    // 100 ms is 12 steps: 5 run, the other 7 are dropped, not queued.
    expect(accumulator.advance(100)).toBe(5)
    expect(accumulator.alpha).toBe(0)
    expect(accumulator.advance(0)).toBe(0)
    expect(accumulator.advance(NOMINAL_FRAME_MS)).toBe(2)
    expect(accumulator.alpha).toBe(0)

    // A leftover plus a big frame: 0.48 + 5 steps is over the cap, so the leftover goes too.
    expect(accumulator.advance(4)).toBe(0)
    expect(accumulator.alpha).toBeCloseTo(0.48, 10)
    expect(accumulator.advance(2.5 * NOMINAL_FRAME_MS)).toBe(5)
    expect(accumulator.alpha).toBe(0)

    // Under the cap, the leftover is kept: 40 ms is 4.8 steps.
    expect(accumulator.advance(40)).toBe(4)
    expect(accumulator.alpha).toBeCloseTo(0.8, 10)

    // An endless stall is still just the cap.
    expect(accumulator.advance(Infinity)).toBe(5)
    expect(accumulator.alpha).toBe(0)
    expect(accumulator.advance(NOMINAL_FRAME_MS)).toBe(2)
  })

  it('reset drops the leftover', () => {
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    expect(accumulator.advance(12)).toBe(1)
    expect(accumulator.alpha).toBeCloseTo(0.44, 10)
    accumulator.reset()
    expect(accumulator.alpha).toBe(0)
    // Without the reset this would be 2.44 steps, so 2 with the leftover carried; after it, 2 exactly.
    expect(accumulator.advance(NOMINAL_FRAME_MS)).toBe(2)
    expect(accumulator.alpha).toBe(0)
  })

  it('starts at alpha 0, and a zero, negative or NaN dt adds nothing', () => {
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    expect(accumulator.alpha).toBe(0)
    expect(accumulator.advance(4)).toBe(0)
    const alpha = accumulator.alpha
    expect(accumulator.advance(0)).toBe(0)
    expect(accumulator.advance(-50)).toBe(0)
    expect(accumulator.advance(NaN)).toBe(0)
    expect(accumulator.alpha).toBe(alpha)
  })

  it('keeps alpha in [0, 1) and loses no time over random frame times under the cap', () => {
    const random = mulberry32(120)
    // A cap of 10 steps is never reached by a frame of at most 60 ms (7.2 steps plus a leftover).
    const accumulator = createFixedStepAccumulator(STEP_MS, 10)
    let elapsedMs = 0
    let steps = 0
    for (let i = 0; i < 20_000; i++) {
      const dtMs = random() * 60
      elapsedMs += dtMs
      const ran = accumulator.advance(dtMs)
      expect(ran).toBeGreaterThanOrEqual(0)
      expect(ran).toBeLessThanOrEqual(10)
      expect(Number.isInteger(ran)).toBe(true)
      expect(accumulator.alpha).toBeGreaterThanOrEqual(0)
      expect(accumulator.alpha).toBeLessThan(1)
      steps += ran
    }
    // Rounding to a tick costs at most half a tick (1/79,200 ms) an advance, so the steps run plus the
    // leftover account for all the time given, to within 20,000 of those (about a quarter of a ms).
    expect(Math.abs((steps + accumulator.alpha) * STEP_MS - elapsedMs)).toBeLessThanOrEqual(20_000 / 79_200 + 1e-9)
  })

  it('keeps alpha in [0, 1) when the cap is hit often', () => {
    const random = mulberry32(5)
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    for (let i = 0; i < 20_000; i++) {
      expect(accumulator.advance(random() * 100)).toBeLessThanOrEqual(MAX_STEPS)
      expect(accumulator.alpha).toBeGreaterThanOrEqual(0)
      expect(accumulator.alpha).toBeLessThan(1)
    }
  })

  it('keeps separate accumulators separate', () => {
    const a = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    const b = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    a.advance(12)
    expect(b.alpha).toBe(0)
    expect(b.advance(NOMINAL_FRAME_MS)).toBe(2)
  })

  it.each([0, -1, NaN, Infinity, 0.00001])('rejects a stepMs of %p', (stepMs) => {
    expect(() => createFixedStepAccumulator(stepMs, MAX_STEPS)).toThrow(RangeError)
  })

  it.each([0, -1, 2.5, NaN, Infinity])('rejects a maxSteps of %p', (maxSteps) => {
    expect(() => createFixedStepAccumulator(STEP_MS, maxSteps)).toThrow(RangeError)
  })
})

describe('createFixedStepState', () => {
  it('steps exactly as the accumulator does over random frame times, alpha and all', () => {
    const random = mulberry32(42)
    const accumulator = createFixedStepAccumulator(STEP_MS, MAX_STEPS)
    const state = createFixedStepState(STEP_MS, MAX_STEPS)
    for (let i = 0; i < 20_000; i++) {
      const dtMs = random() < 0.05 ? random() * 200 : random() * 30
      expect(advanceFixedStep(state, dtMs)).toBe(accumulator.advance(dtMs))
      expect(fixedStepAlpha(state)).toBe(accumulator.alpha)
    }
  })

  it('runs exactly 5 steps for the clamp worst case, and 2 every 60 fps frame', () => {
    const state = createFixedStepState(STEP_MS, MAX_STEPS)
    expect(advanceFixedStep(state, 2.5 * NOMINAL_FRAME_MS)).toBe(5)
    expect(fixedStepAlpha(state)).toBe(0)
    for (let frame = 1; frame <= 600; frame++) expect(advanceFixedStep(state, frameDtMs(60, frame))).toBe(2)
  })

  it('is a plain object of numbers, so it survives a copy (a shared value, a worklet capture)', () => {
    const state = createFixedStepState(STEP_MS, MAX_STEPS)
    advanceFixedStep(state, 12)
    const copy = JSON.parse(JSON.stringify(state))
    expect(copy).toEqual(state)
    expect(advanceFixedStep(copy, 12)).toBe(advanceFixedStep(state, 12))
    expect(fixedStepAlpha(copy)).toBe(fixedStepAlpha(state))
  })

  it('resetFixedStep drops the leftover', () => {
    const state = createFixedStepState(STEP_MS, MAX_STEPS)
    advanceFixedStep(state, 12)
    expect(fixedStepAlpha(state)).toBeGreaterThan(0)
    resetFixedStep(state)
    expect(fixedStepAlpha(state)).toBe(0)
    expect(advanceFixedStep(state, 4)).toBe(0)
  })

  it.each([0, -1, NaN, Infinity, 0.00001])('rejects a stepMs of %p, naming itself', (stepMs) => {
    expect(() => createFixedStepState(stepMs, MAX_STEPS)).toThrow(/^createFixedStepState: stepMs/)
  })

  it.each([0, -1, 2.5, NaN, Infinity])('rejects a maxSteps of %p, naming itself', (maxSteps) => {
    expect(() => createFixedStepState(STEP_MS, maxSteps)).toThrow(/^createFixedStepState: maxSteps/)
  })

  it('is exported from the root entry', () => {
    expect(core.createFixedStepState).toBe(createFixedStepState)
    expect(core.advanceFixedStep).toBe(advanceFixedStep)
    expect(core.fixedStepAlpha).toBe(fixedStepAlpha)
    expect(core.resetFixedStep).toBe(resetFixedStep)
  })
})

import { useEffect, useRef } from 'react'

import { computeClampedDt } from './computeClampedDt'

export interface UseGameLoopOptions {
  // Whether the loop should be running at all — gate this on whatever phase/pause state your own
  // game needs (e.g. `state.phase === 'simulating' && !paused`); this hook has no opinion on that.
  enabled: boolean
  // See computeClampedDt — caps how many nominal frames a single tick can represent.
  maxDt?: number
}

const DEFAULT_MAX_DT = 2.5

// Drives `onTick(dt)` once per animation frame for as long as `enabled` stays true, computing a
// clamped, frame-rate-independent dt each time (see computeClampedDt). Starting/stopping re-enters
// cleanly: toggling `enabled` off and back on resets the timestamp baseline, so the next tick after a
// resume gets dt = 1 (a normal frame) instead of a huge dt reflecting however long the loop was
// paused — the same behavior a fresh mount gets.
export function useGameLoop(onTick: (dt: number) => void, { enabled, maxDt = DEFAULT_MAX_DT }: UseGameLoopOptions): void {
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  useEffect(() => {
    if (!enabled) return

    let rafId: ReturnType<typeof requestAnimationFrame> | null = null
    let active = true
    let lastTimestamp: number | null = null

    const step = (timestamp: number) => {
      if (!active) return
      const dt = computeClampedDt(timestamp, lastTimestamp, maxDt)
      lastTimestamp = timestamp
      onTickRef.current(dt)
      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)

    return () => {
      active = false
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [enabled, maxDt])
}

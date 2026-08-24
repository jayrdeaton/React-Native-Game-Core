import { renderHook } from '@testing-library/react'

import { useGameLoop } from '../useGameLoop'

// A controllable requestAnimationFrame stand-in: queues at most one pending callback (matching how
// useGameLoop only ever has one frame in flight) and lets a test fire it on demand with an explicit
// timestamp, rather than depending on real frame timing.
function installFakeRaf() {
  let pending: { id: number; callback: (timestamp: number) => void } | null = null
  let nextId = 1

  global.requestAnimationFrame = jest.fn((callback: (timestamp: number) => void) => {
    const id = nextId++
    pending = { id, callback }
    return id
  }) as unknown as typeof requestAnimationFrame

  global.cancelAnimationFrame = jest.fn((id: number) => {
    if (pending?.id === id) pending = null
  }) as unknown as typeof cancelAnimationFrame

  return {
    fire: (timestamp: number) => {
      const toRun = pending
      pending = null
      toRun?.callback(timestamp)
    },
    hasPending: () => pending !== null
  }
}

describe('useGameLoop', () => {
  it('does not schedule a frame while disabled', () => {
    const raf = installFakeRaf()
    renderHook(() => useGameLoop(jest.fn(), { enabled: false }))
    expect(raf.hasPending()).toBe(false)
  })

  it('calls onTick with dt = 1 on the first frame after enabling', () => {
    const raf = installFakeRaf()
    const onTick = jest.fn()
    renderHook(() => useGameLoop(onTick, { enabled: true }))
    raf.fire(1000)
    expect(onTick).toHaveBeenCalledWith(1)
  })

  it('scales dt to the elapsed time on subsequent frames', () => {
    const raf = installFakeRaf()
    const onTick = jest.fn()
    renderHook(() => useGameLoop(onTick, { enabled: true, maxDt: 10 }))
    raf.fire(1000)
    raf.fire(1000 + (1000 / 60) * 3)
    expect(onTick).toHaveBeenLastCalledWith(expect.closeTo(3, 5))
  })

  it('clamps dt to maxDt after a large gap', () => {
    const raf = installFakeRaf()
    const onTick = jest.fn()
    renderHook(() => useGameLoop(onTick, { enabled: true, maxDt: 2.5 }))
    raf.fire(1000)
    raf.fire(1000 + 10_000)
    expect(onTick).toHaveBeenLastCalledWith(2.5)
  })

  it('reschedules itself after every tick', () => {
    const raf = installFakeRaf()
    renderHook(() => useGameLoop(jest.fn(), { enabled: true }))
    raf.fire(1000)
    expect(raf.hasPending()).toBe(true)
  })

  it('cancels the pending frame on unmount', () => {
    const raf = installFakeRaf()
    const { unmount } = renderHook(() => useGameLoop(jest.fn(), { enabled: true }))
    expect(raf.hasPending()).toBe(true)
    unmount()
    expect(raf.hasPending()).toBe(false)
  })

  it('resets the timestamp baseline (dt = 1 again) after disabling and re-enabling', () => {
    const raf = installFakeRaf()
    const onTick = jest.fn()
    const { rerender } = renderHook(({ enabled }) => useGameLoop(onTick, { enabled }), { initialProps: { enabled: true } })
    raf.fire(1000)
    raf.fire(1100)

    rerender({ enabled: false })
    rerender({ enabled: true })
    raf.fire(5000)
    expect(onTick).toHaveBeenLastCalledWith(1)
  })
})

import { renderHook } from '@testing-library/react'

import { useOrientationLock } from '../useOrientationLock'

describe('useOrientationLock', () => {
  it('reads the inert default (unlocked, no-op setter) with no Provider mounted', () => {
    const { result } = renderHook(() => useOrientationLock())
    expect(result.current.locked).toBe(false)
    // Calling the no-op setter shouldn't throw — the same "nothing crashes, it just never
    // resolves" degradation every other hook in this package falls back to without its Provider.
    expect(() => result.current.setLocked(true)).not.toThrow()
  })
})

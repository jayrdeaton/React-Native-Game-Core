import { renderHook } from '@testing-library/react'

import { useSettledWindowDimensions } from '../useSettledWindowDimensions'

describe('useSettledWindowDimensions (native)', () => {
  it('is a plain pass-through to useWindowDimensions', () => {
    const { result } = renderHook(() => useSettledWindowDimensions())
    expect(result.current).toEqual({ width: 402, height: 874, scale: 3, fontScale: 1 })
  })
})

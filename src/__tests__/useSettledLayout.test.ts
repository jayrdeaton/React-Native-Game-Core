import { act, renderHook } from '@testing-library/react'

import { useSettledLayout } from '../useSettledLayout'

describe('useSettledLayout (native)', () => {
  it('starts with a null size and updates from onLayout', () => {
    const { result } = renderHook(() => useSettledLayout())
    expect(result.current.size).toBeNull()

    act(() => {
      result.current.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 480 } } } as never)
    })

    expect(result.current.size).toEqual({ width: 320, height: 480 })
  })
})

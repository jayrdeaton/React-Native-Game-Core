import { renderHook } from '@testing-library/react'

import { useIsTouchPrimaryDevice } from '../useIsTouchPrimaryDevice'

describe('useIsTouchPrimaryDevice (native)', () => {
  it('always reports touch-primary', () => {
    const { result } = renderHook(() => useIsTouchPrimaryDevice())
    expect(result.current).toBe(true)
  })
})

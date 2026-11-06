import { renderHook } from '@testing-library/react'
import { useWindowDimensions } from 'react-native'

import { useRotatedWindowDimensions } from '../useRotatedWindowDimensions'

describe('useRotatedWindowDimensions', () => {
  afterEach(() => {
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 })
  })

  it('is the window size, never swapped', () => {
    expect(renderHook(() => useRotatedWindowDimensions()).result.current).toEqual({ width: 402, height: 874 })
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 874, height: 402, scale: 3, fontScale: 1 })
    expect(renderHook(() => useRotatedWindowDimensions(true)).result.current).toEqual({ width: 874, height: 402 })
  })
})

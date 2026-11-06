import { renderHook } from '@testing-library/react'
import { useWindowDimensions } from 'react-native'

import { useRotation } from '../useRotation'

describe('useRotation', () => {
  afterEach(() => {
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 })
  })

  it('is 0° in a portrait window, locked or not', () => {
    expect(renderHook(() => useRotation()).result.current).toBe(0)
    expect(renderHook(() => useRotation(true)).result.current).toBe(0)
  })

  it('is 0° in a landscape window too: the OS turns the interface since 0.15', () => {
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 874, height: 402, scale: 3, fontScale: 1 })
    expect(renderHook(() => useRotation()).result.current).toBe(0)
  })
})

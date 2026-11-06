import { renderHook } from '@testing-library/react'
import { useWindowDimensions } from 'react-native'

import { RotationAwareStatusBarOptions, useRotationAwareStatusBar } from '../useRotationAwareStatusBar'

function renderOptions(options?: RotationAwareStatusBarOptions) {
  return renderHook(() => useRotationAwareStatusBar(options))
}

describe('useRotationAwareStatusBar', () => {
  afterEach(() => {
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 })
  })

  it('never hides the status bar, in a portrait or a landscape window: nothing turns since 0.15', () => {
    expect(renderOptions().result.current.statusBarHidden).toBe(false)
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 874, height: 402, scale: 3, fontScale: 1 })
    expect(renderOptions({ locked: true }).result.current.statusBarHidden).toBe(false)
  })

  it('passes style and animation through as the stack option names', () => {
    const { result } = renderOptions({ style: 'light', animation: 'slide' })
    expect(result.current).toEqual({ statusBarHidden: false, statusBarStyle: 'light', statusBarAnimation: 'slide' })
  })

  it('leaves out the keys it was not given, so spreading it never overrides an option with undefined', () => {
    const { result } = renderOptions()
    expect(Object.keys(result.current)).toEqual(['statusBarHidden'])
    expect({ statusBarStyle: 'dark', ...result.current }).toEqual({ statusBarStyle: 'dark', statusBarHidden: false })
  })
})

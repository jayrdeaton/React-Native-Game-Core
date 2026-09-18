import { renderHook } from '@testing-library/react'
import { setBackgroundColorAsync } from 'expo-system-ui'

import { useThemedRootBackground } from '../useThemedRootBackground'

describe('useThemedRootBackground', () => {
  beforeEach(() => {
    ;(setBackgroundColorAsync as jest.Mock).mockClear()
  })

  it('returns the fleet-wide root Stack screen options for a light theme', () => {
    const { result } = renderHook(() => useThemedRootBackground(false))
    expect(result.current).toEqual({
      headerShown: false,
      gestureEnabled: false,
      contentStyle: { backgroundColor: '#FFFFFF' }
    })
  })

  it('returns black contentStyle/root-background values for a dark theme', () => {
    const { result } = renderHook(() => useThemedRootBackground(true))
    expect(result.current.contentStyle).toEqual({ backgroundColor: '#000000' })
  })

  it('forwards a truthy gestureEnabled through unchanged, since it is a caller concern unrelated to theming', () => {
    const { result } = renderHook(() => useThemedRootBackground(false, true))
    expect(result.current.gestureEnabled).toBe(true)
  })

  it('syncs the root window background via expo-system-ui to match dark on mount', () => {
    renderHook(() => useThemedRootBackground(true))
    expect(setBackgroundColorAsync).toHaveBeenCalledWith('#000000')
  })

  it('syncs the root window background via expo-system-ui to match light on mount', () => {
    renderHook(() => useThemedRootBackground(false))
    expect(setBackgroundColorAsync).toHaveBeenCalledWith('#FFFFFF')
  })

  it('re-syncs the root window background whenever dark changes across a rerender', () => {
    const { rerender } = renderHook(({ dark }: { dark: boolean }) => useThemedRootBackground(dark), {
      initialProps: { dark: false }
    })
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#FFFFFF')

    rerender({ dark: true })
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#000000')
  })

  it('does not re-sync the root window background on a rerender where dark is unchanged', () => {
    const { rerender } = renderHook(({ dark }: { dark: boolean }) => useThemedRootBackground(dark), {
      initialProps: { dark: false }
    })
    ;(setBackgroundColorAsync as jest.Mock).mockClear()

    rerender({ dark: false })

    expect(setBackgroundColorAsync).not.toHaveBeenCalled()
  })

  // The module itself also fires a single SystemUI.setBackgroundColorAsync('#000000') call the
  // instant it's imported, before any component has rendered or any `dark` value is known — see the
  // module's own doc for why. jest.isolateModules gives this one test a private module registry so
  // the mapped expo-system-ui mock is freshly required (a fresh jest.fn(), unpolluted by the
  // beforeEach-cleared shared instance every other test in this file uses) and the import-time call
  // can be observed in isolation.
  it('syncs the root window background to black once at module import time, before any hook runs', () => {
    jest.isolateModules(() => {
      const freshSystemUI = require('expo-system-ui') as { setBackgroundColorAsync: jest.Mock }
      require('../useThemedRootBackground')
      expect(freshSystemUI.setBackgroundColorAsync).toHaveBeenCalledTimes(1)
      expect(freshSystemUI.setBackgroundColorAsync).toHaveBeenCalledWith('#000000')
    })
  })
})

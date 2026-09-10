import { act, renderHook } from '@testing-library/react'
import { ReactNode } from 'react'

import { OrientationProvider } from '../OrientationProvider'
import { useOrientationLock } from '../useOrientationLock'

describe('OrientationProvider', () => {
  it('rehydrates the lock setting from lockInitialValue, matching FeedbackPressProvider initialValue contract', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <OrientationProvider lockInitialValue={{ locked: true }}>{children}</OrientationProvider>
    const { result } = renderHook(() => useOrientationLock(), { wrapper })
    expect(result.current.locked).toBe(true)
  })

  it('defaults to unlocked when lockInitialValue is omitted', () => {
    const { result } = renderHook(() => useOrientationLock(), { wrapper: OrientationProvider })
    expect(result.current.locked).toBe(false)
  })

  it("fires onLockChange with the full settings object on every change, matching onChange/onSoundChange's contract — the app owns persistence, this Provider does not", () => {
    const onLockChange = jest.fn()
    const wrapper = ({ children }: { children: ReactNode }) => <OrientationProvider onLockChange={onLockChange}>{children}</OrientationProvider>
    const { result } = renderHook(() => useOrientationLock(), { wrapper })

    act(() => {
      result.current.setLocked(true)
    })
    expect(onLockChange).toHaveBeenCalledWith({ locked: true })
  })
})

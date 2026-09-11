import { act, renderHook } from '@testing-library/react'

import { useSettledWindowDimensions } from '../useSettledWindowDimensions.web'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })
}

async function waitTwoFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

describe('useSettledWindowDimensions (web)', () => {
  const originalWidth = window.innerWidth
  const originalHeight = window.innerHeight

  afterEach(() => {
    setViewport(originalWidth, originalHeight)
  })

  it('reads the real window size on mount', () => {
    setViewport(1024, 768)
    const { result } = renderHook(() => useSettledWindowDimensions())
    expect(result.current.width).toBe(1024)
    expect(result.current.height).toBe(768)
  })

  it('corrects itself if the window size changes between mount and the post-mount settle check', async () => {
    setViewport(0, 0)
    const { result } = renderHook(() => useSettledWindowDimensions())
    expect(result.current.width).toBe(0)

    // Simulates hydration landing after the real layout has already resolved to its final size —
    // exactly the race this hook exists to catch, with no 'resize' event ever firing to signal it.
    setViewport(1280, 720)
    await waitTwoFrames()

    expect(result.current.width).toBe(1280)
    expect(result.current.height).toBe(720)
  })

  it('keeps tracking a real resize afterward', async () => {
    setViewport(1024, 768)
    const { result } = renderHook(() => useSettledWindowDimensions())
    await waitTwoFrames()

    setViewport(500, 900)
    act(() => window.dispatchEvent(new Event('resize')))

    expect(result.current.width).toBe(500)
    expect(result.current.height).toBe(900)
  })
})

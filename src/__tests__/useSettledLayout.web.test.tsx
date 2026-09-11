import { act, render } from '@testing-library/react'
import type { Ref } from 'react'

import { useSettledLayout } from '../useSettledLayout.web'

async function waitTwoFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

describe('useSettledLayout (web)', () => {
  it('uses onLayout normally when it fires with a real size', () => {
    let captured: ReturnType<typeof useSettledLayout> | undefined
    function TestComponent() {
      captured = useSettledLayout()
      return <div ref={captured.ref as unknown as Ref<HTMLDivElement>} />
    }
    render(<TestComponent />)

    act(() => {
      captured?.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 100 } } } as never)
    })

    expect(captured?.size).toEqual({ width: 200, height: 100 })
  })

  it('falls back to measuring the container directly if onLayout never fires', async () => {
    let captured: ReturnType<typeof useSettledLayout> | undefined
    function TestComponent() {
      captured = useSettledLayout()
      return <div ref={captured.ref as unknown as Ref<HTMLDivElement>} />
    }
    render(<TestComponent />)
    expect(captured?.size).toBeNull()

    const node = captured?.ref.current as unknown as HTMLElement
    node.getBoundingClientRect = () => ({ width: 640, height: 360 }) as DOMRect

    await waitTwoFrames()

    expect(captured?.size).toEqual({ width: 640, height: 360 })
  })

  it('does not let a stale-zero fallback rect override a real onLayout measurement', async () => {
    let captured: ReturnType<typeof useSettledLayout> | undefined
    function TestComponent() {
      captured = useSettledLayout()
      return <div ref={captured.ref as unknown as Ref<HTMLDivElement>} />
    }
    render(<TestComponent />)

    act(() => {
      captured?.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 150 } } } as never)
    })

    const node = captured?.ref.current as unknown as HTMLElement
    node.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect

    await waitTwoFrames()

    expect(captured?.size).toEqual({ width: 300, height: 150 })
  })
})

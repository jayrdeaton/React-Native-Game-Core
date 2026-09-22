import { act, render } from '@testing-library/react'

import { emitKeyboard, keyboardListeners } from '../__mocks__/react-native'
import { useKeyboardVisible } from '../useKeyboardVisible'

// The mocked Platform is iOS, so the `Will` events are the ones in play (Android uses `Did` - same shape, different names).
const SHOW = 'keyboardWillShow'
const HIDE = 'keyboardWillHide'

function Probe({ enabled, onValue }: { enabled?: boolean; onValue: (visible: boolean) => void }) {
  onValue(useKeyboardVisible(enabled))
  return null
}

function renderProbe(enabled?: boolean) {
  const seen: boolean[] = []
  const utils = render(<Probe enabled={enabled} onValue={(v) => seen.push(v)} />)
  return { ...utils, current: () => seen[seen.length - 1], rerenderWith: (next?: boolean) => utils.rerender(<Probe enabled={next} onValue={(v) => seen.push(v)} />) }
}

const listenerCount = () => (keyboardListeners[SHOW]?.size ?? 0) + (keyboardListeners[HIDE]?.size ?? 0)

afterEach(() => {
  for (const event of Object.keys(keyboardListeners)) keyboardListeners[event].clear()
})

describe('useKeyboardVisible', () => {
  it('starts hidden', () => {
    expect(renderProbe().current()).toBe(false)
  })

  it('follows the keyboard: true from the show event, false from the hide event', () => {
    const probe = renderProbe()

    act(() => emitKeyboard(SHOW))
    expect(probe.current()).toBe(true)

    act(() => emitKeyboard(HIDE))
    expect(probe.current()).toBe(false)
  })

  it('subscribes to exactly the show and hide events, and unsubscribes on unmount', () => {
    const probe = renderProbe()
    expect(keyboardListeners[SHOW].size).toBe(1)
    expect(keyboardListeners[HIDE].size).toBe(1)

    probe.unmount()
    expect(listenerCount()).toBe(0)
  })

  it('registers no listener at all, and stays false, while disabled', () => {
    const probe = renderProbe(false)
    expect(listenerCount()).toBe(0)

    act(() => emitKeyboard(SHOW))
    expect(probe.current()).toBe(false)
  })

  it('reports false the moment it is disabled while the keyboard is up, and stops listening', () => {
    const probe = renderProbe(true)
    act(() => emitKeyboard(SHOW))
    expect(probe.current()).toBe(true)

    probe.rerenderWith(false)
    expect(probe.current()).toBe(false)
    expect(listenerCount()).toBe(0)
  })

  it('listens again once re-enabled', () => {
    const probe = renderProbe(false)
    probe.rerenderWith(true)
    expect(listenerCount()).toBe(2)

    act(() => emitKeyboard(SHOW))
    expect(probe.current()).toBe(true)
  })
})

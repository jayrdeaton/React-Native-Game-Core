import { act, render } from '@testing-library/react'

import { appStateListeners, emitAppState } from '../__mocks__/react-native'
import { type BackgroundPause, useBackgroundPause } from '../useBackgroundPause'

function Probe({ shouldPause, onValue }: { shouldPause: () => boolean; onValue: (result: BackgroundPause) => void }) {
  onValue(useBackgroundPause(shouldPause))
  return null
}

function renderProbe(shouldPause: () => boolean = () => true) {
  const seen: BackgroundPause[] = []
  const utils = render(<Probe shouldPause={shouldPause} onValue={(v) => seen.push(v)} />)
  return { ...utils, seen, current: () => seen[seen.length - 1], rerenderWith: (next: () => boolean) => utils.rerender(<Probe shouldPause={next} onValue={(v) => seen.push(v)} />) }
}

const listenerCount = () => appStateListeners.change?.size ?? 0

afterEach(() => {
  for (const event of Object.keys(appStateListeners)) appStateListeners[event].clear()
})

describe('useBackgroundPause', () => {
  it('starts false', () => {
    expect(renderProbe().current().backgroundPaused).toBe(false)
  })

  it("latches true on 'background' while shouldPause() is true", () => {
    const probe = renderProbe(() => true)

    act(() => emitAppState('background'))
    expect(probe.current().backgroundPaused).toBe(true)
  })

  it("latches on iOS's 'inactive' too", () => {
    const probe = renderProbe(() => true)

    act(() => emitAppState('inactive'))
    expect(probe.current().backgroundPaused).toBe(true)
  })

  it("stays true when the app returns to 'active'", () => {
    const probe = renderProbe(() => true)
    act(() => emitAppState('background'))

    act(() => emitAppState('active'))
    expect(probe.current().backgroundPaused).toBe(true)
  })

  it('resume() clears it', () => {
    const probe = renderProbe(() => true)
    act(() => emitAppState('background'))
    act(() => emitAppState('active'))

    act(() => probe.current().resume())
    expect(probe.current().backgroundPaused).toBe(false)
  })

  it('never latches when shouldPause() is false at the moment of backgrounding', () => {
    const probe = renderProbe(() => false)

    act(() => emitAppState('background'))
    act(() => emitAppState('active'))
    expect(probe.current().backgroundPaused).toBe(false)
  })

  it('reads the latest getter, not the one from mount', () => {
    const probe = renderProbe(() => false)
    probe.rerenderWith(() => true)

    act(() => emitAppState('background'))
    expect(probe.current().backgroundPaused).toBe(true)
  })

  it('keeps resume stable across renders', () => {
    const probe = renderProbe(() => true)
    const first = probe.current().resume

    probe.rerenderWith(() => true)
    act(() => emitAppState('background'))
    act(() => first())
    expect(probe.seen.length).toBeGreaterThan(3)
    expect(probe.seen.every((result) => result.resume === first)).toBe(true)
  })

  it("registers one 'change' listener while mounted, and none after unmount", () => {
    const probe = renderProbe()
    expect(listenerCount()).toBe(1)

    probe.unmount()
    expect(listenerCount()).toBe(0)
  })
})

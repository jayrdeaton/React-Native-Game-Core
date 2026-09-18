import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEdgeGestureGuard } from '@tastic/edge-guard'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'

import { createGameSettingsProvider } from '../createGameSettingsProvider'

// A small, made-up TSettings shape — genuinely different from any of the 4 apps' own GameSettings
// (no controlScheme/aiDifficulty/etc.), so these tests exercise the factory's own generic behavior
// rather than accidentally depending on one app's particular fields. `deferBottomEdgeGestures` is
// the one field the factory itself requires (see createGameSettingsProvider.tsx's own doc).
interface TestSettings {
  volume: number
  deferBottomEdgeGestures: boolean
}

const DEFAULT_SETTINGS: TestSettings = { volume: 5, deferBottomEdgeGestures: false }

function isValidTestSettings(value: unknown): value is TestSettings {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<TestSettings>
  return typeof v.volume === 'number' && typeof v.deferBottomEdgeGestures === 'boolean'
}

function createTestProvider() {
  return createGameSettingsProvider<TestSettings>({ storageKey: 'test.settings', defaultSettings: DEFAULT_SETTINGS, isValidSettings: isValidTestSettings })
}

describe('createGameSettingsProvider', () => {
  beforeEach(() => {
    ;(AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined)
    ;(useEdgeGestureGuard as jest.Mock).mockClear()
  })

  it('throws when useGameSettings is called outside its own GameSettingsProvider', () => {
    const { useGameSettings } = createTestProvider()
    // Swallow React's own console.error for the expected render failure, same convention as
    // testing any hook that throws via renderHook — the assertion below is the real check, this
    // just keeps the test's own output clean.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useGameSettings())).toThrow('useGameSettings must be used within a GameSettingsProvider')
    errorSpy.mockRestore()
  })

  it('starts at defaultSettings with loaded false, then flips loaded true once the AsyncStorage read resolves with nothing stored', async () => {
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    expect(result.current.loaded).toBe(false)

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('test.settings')
  })

  it('merges a stored blob that predates a newer field onto defaultSettings, rather than rejecting it wholesale', async () => {
    // Simulates a real, pre-existing bug scenario: a blob written before `deferBottomEdgeGestures`
    // existed on TSettings at all. Fails a naive "every field must already be present" validation,
    // but merging onto defaultSettings first (see createGameSettingsProvider.tsx's own doc) means
    // only the missing field is lost, not the whole blob.
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ volume: 9 }))
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual({ volume: 9, deferBottomEdgeGestures: false })
  })

  it('rejects a stored blob with a wrong-typed field entirely, keeping defaults', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ volume: 'loud' }))
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps defaults and still resolves loaded on a corrupt (non-JSON) stored blob', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('{not json')
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps defaults on a stored blob that parses to valid JSON but isn’t a plain object (e.g. an array)', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[1,2,3]')
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps defaults and still resolves loaded when AsyncStorage.getItem itself rejects (storage unavailable)', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage unavailable'))
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('setSettings patches live state and persists the merged result', async () => {
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.setSettings({ volume: 7 })
    })

    expect(result.current.settings).toEqual({ volume: 7, deferBottomEdgeGestures: false })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test.settings', JSON.stringify({ volume: 7, deferBottomEdgeGestures: false }))
  })

  it('round-trips a persisted write through a later load, the same way a real cold relaunch would', async () => {
    // Wires this test's own setItem mock to feed back into getItem, rather than the mock file
    // itself keeping cross-test state (see async-storage.ts's own doc for why) — a fresh
    // provider instance simulates a cold relaunch reading back what an earlier session wrote.
    let persisted: string | null = null
    ;(AsyncStorage.setItem as jest.Mock).mockImplementation((_key: string, value: string) => {
      persisted = value
      return Promise.resolve()
    })

    const first = createTestProvider()
    const { result: firstResult } = renderHook(() => first.useGameSettings(), { wrapper: first.GameSettingsProvider })
    await waitFor(() => expect(firstResult.current.loaded).toBe(true))
    act(() => {
      firstResult.current.setSettings({ volume: 2 })
    })
    expect(persisted).not.toBeNull()

    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(persisted)
    const second = createTestProvider()
    const { result: secondResult } = renderHook(() => second.useGameSettings(), { wrapper: second.GameSettingsProvider })
    await waitFor(() => expect(secondResult.current.loaded).toBe(true))
    expect(secondResult.current.settings).toEqual({ volume: 2, deferBottomEdgeGestures: false })
  })

  it('commitRoundSettings snapshots activeRoundSettings independently of later live settings edits', async () => {
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.activeRoundSettings).toBeNull()

    act(() => {
      result.current.commitRoundSettings(result.current.settings)
      result.current.setSettings({ volume: 10 })
    })

    expect(result.current.activeRoundSettings).toEqual(DEFAULT_SETTINGS)
    expect(result.current.settings).toEqual({ volume: 10, deferBottomEdgeGestures: false })
  })

  it('wires useEdgeGestureGuard to settings.deferBottomEdgeGestures && isActivelyPlaying, reactively', async () => {
    const { GameSettingsProvider, useGameSettings } = createTestProvider()
    const { result } = renderHook(() => useGameSettings(), { wrapper: GameSettingsProvider })
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(useEdgeGestureGuard).toHaveBeenLastCalledWith(false)

    act(() => {
      result.current.setIsActivelyPlaying(true)
    })
    // deferBottomEdgeGestures is still false, so the guard stays off even while actively playing.
    expect(useEdgeGestureGuard).toHaveBeenLastCalledWith(false)

    act(() => {
      result.current.setSettings({ deferBottomEdgeGestures: true })
    })
    expect(useEdgeGestureGuard).toHaveBeenLastCalledWith(true)

    act(() => {
      result.current.setIsActivelyPlaying(false)
    })
    expect(useEdgeGestureGuard).toHaveBeenLastCalledWith(false)
  })

  it('lets two independent createGameSettingsProvider calls (e.g. two different apps) keep fully separate state', async () => {
    const a = createGameSettingsProvider<TestSettings>({ storageKey: 'app-a.settings', defaultSettings: { volume: 1, deferBottomEdgeGestures: false }, isValidSettings: isValidTestSettings })
    const b = createGameSettingsProvider<TestSettings>({ storageKey: 'app-b.settings', defaultSettings: { volume: 2, deferBottomEdgeGestures: false }, isValidSettings: isValidTestSettings })

    function Wrapper({ children }: { children?: ReactNode }) {
      return (
        <a.GameSettingsProvider>
          <b.GameSettingsProvider>{children}</b.GameSettingsProvider>
        </a.GameSettingsProvider>
      )
    }

    let aValue: number | undefined
    let bValue: number | undefined
    function Consumer() {
      aValue = a.useGameSettings().settings.volume
      bValue = b.useGameSettings().settings.volume
      return null
    }

    render(<Consumer />, { wrapper: Wrapper })
    await waitFor(() => expect(aValue).toBe(1))
    expect(bValue).toBe(2)
  })
})

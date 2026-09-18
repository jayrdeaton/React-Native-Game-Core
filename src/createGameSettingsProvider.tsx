import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEdgeGestureGuard } from '@tastic/edge-guard'
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface GameSettingsContextValue<TSettings> {
  settings: TSettings
  setSettings: (update: Partial<TSettings>) => void
  // The snapshot a round-start screen (a loadout, a lobby) locks in for the round about to start,
  // as opposed to `settings` above (the editable, persisted "next round" defaults) — see
  // commitRoundSettings below.
  activeRoundSettings: TSettings | null
  commitRoundSettings: (settings: TSettings) => void
  // False until the AsyncStorage read below has resolved, one way or another (a real stored value,
  // no stored value, or a corrupt/unavailable read all count — `settings` is only ever
  // `defaultSettings` until this flips true, since it's a plain useState with the default baked
  // in). Exposed so a splash gate can hold the app's own tree back until the real, corrected value
  // exists, the same job every one of this factory's 4 originating apps already used it for.
  loaded: boolean
  // Held only in memory, never persisted, same as activeRoundSettings above — the consuming app's
  // own report of whether a round is actually live right now, read by this provider's own
  // useEdgeGestureGuard call below. Lives here (rather than only in the screen that knows the
  // answer) so that call can stay mounted once, permanently, at the provider — see that call's own
  // doc.
  isActivelyPlaying: boolean
  setIsActivelyPlaying: (value: boolean) => void
}

export interface CreateGameSettingsProviderConfig<TSettings extends { deferBottomEdgeGestures: boolean }> {
  // AsyncStorage key this app's settings are persisted under — the one genuinely per-app value in
  // this whole factory (every other field below was identical across all 4 apps this was extracted
  // from). Namespaced by convention as '<app>.settings' (e.g. 'airhockey.settings'), not enforced
  // here.
  storageKey: string
  // Seeds `settings` before the AsyncStorage read below resolves, and is what a stored blob gets
  // merged ONTO in that read (see the effect below) — so keep this a plain module-level constant in
  // the calling app, same as every app's own DEFAULT_SETTINGS, not a value that's itself derived
  // from something that can change across the app's lifetime.
  defaultSettings: TSettings
  // A type predicate, not a boolean-returning validator — every one of the 4 apps this was
  // extracted from already writes gameSettingsValidation.ts's isValidSettings this way (`(value:
  // unknown): value is TSettings`), so this is what a consuming app can pass in unwrapped, without
  // an adapter shim just to satisfy this factory.
  isValidSettings: (value: unknown) => value is TSettings
}

export interface GameSettingsProviderProps {
  children: ReactNode
}

export interface CreateGameSettingsProviderResult<TSettings> {
  // Single source of truth for game settings — mount exactly once, near the app's own root. Every
  // screen reads this same live instance via useGameSettings() below rather than each keeping its
  // own AsyncStorage-backed copy — expo-router keeps prior screens mounted underneath when
  // navigating forward, so a per-screen copy would go stale the moment another still-mounted screen
  // changed a setting, and could even clobber that change by later writing its own stale snapshot
  // back to storage.
  GameSettingsProvider: (props: GameSettingsProviderProps) => ReactNode
  useGameSettings: () => GameSettingsContextValue<TSettings>
}

// Generalizes the identical GameSettingsProvider/useGameSettings pair hand-rolled once per app in
// AirHockey, BoxHockey, Pong, and LightCycles (~100 LOC apiece, byte-for-byte identical apart from
// STORAGE_KEY and the settings shape itself) into one factory each app calls once, at module scope,
// with its own TSettings/defaultSettings/isValidSettings — same "call once, get back a bound
// Provider+hook pair" shape as @rific/splash-gate's own createGate.
//
// `deferBottomEdgeGestures` is required on TSettings (not optional, not read off an untyped index)
// because the useEdgeGestureGuard wiring below unconditionally assumes it exists — confirmed a
// genuinely universal field, present on all 4 apps' own GameSettings, not something this factory
// invents a fallback for.
//
// activeRoundSettings/commitRoundSettings and isActivelyPlaying/setIsActivelyPlaying were confirmed
// identical in shape and behavior across all 4 apps too — nothing app-specific to accommodate there
// either. The one real per-app difference found during extraction (Pong's own useGameSettings.tsx
// additionally called `useSplashReady('settings', loaded)` inline, on top of the `loaded` flag every
// app already threads out to its own _layout.tsx splash gate) is NOT reproduced here: that call is
// redundant with what Pong's _layout.tsx already does externally (`<SplashGate gate='settings'
// ready={loaded}>`, which itself calls useReady internally — see @rific/splash-gate's own Gate
// implementation), and splash-gate naming/wiring is an app-level integration choice this package has
// no opinion on, not a property of the settings pattern itself.
export function createGameSettingsProvider<TSettings extends { deferBottomEdgeGestures: boolean }>(config: CreateGameSettingsProviderConfig<TSettings>): CreateGameSettingsProviderResult<TSettings> {
  const { storageKey, defaultSettings, isValidSettings } = config
  const GameSettingsContext = createContext<GameSettingsContextValue<TSettings> | null>(null)

  function GameSettingsProvider({ children }: GameSettingsProviderProps) {
    const [settings, setSettingsState] = useState<TSettings>(defaultSettings)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
      AsyncStorage.getItem(storageKey)
        .then((stored) => {
          if (!stored) return
          try {
            const parsed = JSON.parse(stored)
            // Merge onto defaultSettings *before* validating, not after: isValidSettings has no
            // partial-merge path, so a blob written before some field existed on TSettings is
            // missing that field entirely, and would otherwise fail the all-fields check below over
            // that ONE missing field alone — silently discarding every other still-valid preference
            // in the blob too, the moment a new field ships. Filling in only what `parsed` doesn't
            // already have (defaults never win over a field `parsed` genuinely provides) means an
            // old blob only ever loses the field(s) it truly predates. A field `parsed` DOES provide
            // with the wrong type still fails isValidSettings below and rejects the merge outright,
            // same as it always has.
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const merged = { ...defaultSettings, ...(parsed as Partial<TSettings>) } as TSettings
              if (isValidSettings(merged)) setSettingsState(merged)
            }
          } catch {
            // Corrupt/stale blob — keep defaults.
          }
        })
        .catch(() => {
          // Unavailable storage — keeping defaultSettings already in state is a complete, silent
          // fallback; `loaded` still needs to flip below regardless of which branch resolved.
        })
        .finally(() => setLoaded(true))
      // storageKey/defaultSettings/isValidSettings all come from this factory's own closure over
      // `config` (createGameSettingsProvider's own parameter, not GameSettingsProvider's), fixed for
      // the lifetime of the GameSettingsProvider this call produced — nothing here can ever change
      // between renders, so there's no dependency to list.
    }, [])

    // The AsyncStorage write used to live inside setSettingsState's own updater function below —
    // moved out here because a useState updater must be pure. React can invoke it outside the
    // originating setSettings() call (e.g. replaying a queued update while resolving a later
    // render of this very provider), which fired a real, duplicate write. hasPendingWrite is set
    // synchronously by setSettings itself (never by the AsyncStorage-load effect above, which calls
    // setSettingsState directly) — so this effect only ever persists a genuine setSettings() call,
    // never the initial load's own merge, and coalesces multiple setSettings calls made before a
    // render flushes into the one write for their final settled value.
    const hasPendingWrite = useRef(false)

    const setSettings = useCallback((update: Partial<TSettings>) => {
      hasPendingWrite.current = true
      setSettingsState((prev) => ({ ...prev, ...update }))
    }, [])

    useEffect(() => {
      if (!hasPendingWrite.current) return
      hasPendingWrite.current = false
      AsyncStorage.setItem(storageKey, JSON.stringify(settings)).catch(() => {})
    }, [settings])

    // Held only in memory, never persisted — a round-start screen reads this once at mount to lock
    // in the round it's about to play, so a settings-dialog edit made mid-round (which only ever
    // touches `settings` above) can't retroactively change a round already underway.
    const [activeRoundSettings, setActiveRoundSettings] = useState<TSettings | null>(null)
    const commitRoundSettings = useCallback((next: TSettings) => setActiveRoundSettings(next), [])

    // Also held only in memory, never persisted — see its own doc on GameSettingsContextValue above.
    const [isActivelyPlaying, setIsActivelyPlaying] = useState(false)

    // Mounted once, permanently, here at the provider — not scoped to any one screen. Combining the
    // persisted setting with the app's own live isActivelyPlaying report, in the one place this hook
    // is ever called, is what keeps Edge Guard both a real opt-in AND scoped to actual gameplay,
    // without needing the hook itself mounted/unmounted per screen.
    useEdgeGestureGuard(settings.deferBottomEdgeGestures && isActivelyPlaying)

    return <GameSettingsContext.Provider value={{ settings, setSettings, activeRoundSettings, commitRoundSettings, loaded, isActivelyPlaying, setIsActivelyPlaying }}>{children}</GameSettingsContext.Provider>
  }

  function useGameSettings(): GameSettingsContextValue<TSettings> {
    const ctx = useContext(GameSettingsContext)
    if (!ctx) throw new Error('useGameSettings must be used within a GameSettingsProvider')
    return ctx
  }

  return { GameSettingsProvider, useGameSettings }
}

import { createContext } from 'react'

export type OrientationLockSettings = { locked: boolean }

// Unlocked by default — matches every existing app's own GameSettings default for this same
// setting today (nothing pins the layout until the player deliberately opts in).
export const defaultOrientationLockSettings: OrientationLockSettings = { locked: false }

export type OrientationLockContextType = {
  settings: OrientationLockSettings
  set: (patch: Partial<OrientationLockSettings>) => void
}

// Same shape as @rific/feedback-press's SoundSettingsContext/HapticSettingsContext — an inert
// default with a no-op `set` means a consumer works even without OrientationProvider mounted
// (always reads unlocked, silently drops any attempted change), the same "nothing crashes, it just
// never resolves" degradation useOrientationState's own Context has.
export const OrientationLockContext = createContext<OrientationLockContextType>({
  settings: defaultOrientationLockSettings,
  set: () => {}
})

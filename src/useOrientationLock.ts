import { useContext } from 'react'

import { OrientationLockContext } from './OrientationLockContext'

// Thin, single-purpose read/write pair over the shared "lock orientation" setting — mirrors
// @rific/feedback-press's useSoundSettings/useHapticSettings shape exactly (a {value, setValue}-style
// pair over a patch-based context, not the raw {settings, set} contract itself, which stays an
// implementation detail of OrientationProvider).
export function useOrientationLock(): { locked: boolean; setLocked: (locked: boolean) => void } {
  const { settings, set } = useContext(OrientationLockContext)
  return { locked: settings.locked, setLocked: (locked: boolean) => set({ locked }) }
}

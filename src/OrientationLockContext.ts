import { createSettingsContext } from '@rific/core'

import { ViewRotation } from './rotation'

// `rotation` is the angle the lock is holding, so an app can persist it next to `locked` and a
// relaunch reopens in the orientation the player actually locked to rather than whatever the
// sensor (or the unresolved portrait default) says at launch. Only maintained under
// OrientationProvider's `freezeWhileLocked`: recorded once a locked reading exists, cleared on
// unlock, and restored from lockInitialValue - see OrientationStateProvider.
export type OrientationLockSettings = { locked: boolean; rotation?: ViewRotation }

// Unlocked by default — matches every existing app's own GameSettings default for this same
// setting today (nothing pins the layout until the player deliberately opts in).
export const defaultOrientationLockSettings: OrientationLockSettings = { locked: false }

// Thin binding over @rific/core's createSettingsContext factory — this file used to hand-roll its
// own {Context, Provider}, the exact ~30-line shape that factory was built to generalize away (see
// its own doc comment, which names this file specifically as one of the duplicates it replaces).
// Never actually migrated when the factory landed; a later fleet-wide audit caught the gap. The
// factory's own Context value shape ({settings, set}) is identical to what this file's own
// hand-rolled OrientationLockContextType already was, so nothing downstream (useOrientationLock.ts,
// OrientationProvider.tsx) needed to change its own contract to consume this instead.
const { Context, Provider, useSettings } = createSettingsContext<OrientationLockSettings>(defaultOrientationLockSettings)

export const OrientationLockContext = Context
export const OrientationLockProvider = Provider
export const useOrientationLockSettings = useSettings

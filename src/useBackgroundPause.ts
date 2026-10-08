import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

export interface BackgroundPause {
  /** True from the moment the app left the foreground mid-match until resume() is called. Fold it into the game's own `paused`. */
  backgroundPaused: boolean
  /** Clears backgroundPaused. Wire to the Paused dialog's Resume button. */
  resume: () => void
}

/** Latches a pause when the app leaves the foreground, and holds it until the player explicitly resumes.
 *
 * Any AppState other than 'active' counts: 'background' (home, app switch, a phone call taking the screen) and iOS's 'inactive'
 * (Control Center, Notification Center, an incoming call banner), the earliest point the OS still lets JS run. On web,
 * react-native-web's AppState reports 'background' while the tab is hidden (document visibility), so no .web file is needed.
 *
 * The latch deliberately does NOT clear when the app comes back: a game that silently resumed would put the ball back in play
 * before the player has found the screen again, so the caller shows a Paused dialog and only resume() lets play continue.
 *
 * `shouldPause` is a lazy () => boolean read only when the app actually leaves the foreground, for the same reason as
 * @tastic/hud's useQuitConfirmation: the game's own `paused` (which this result feeds) has to exist before the hook that returns
 * the game's phase, so a plain boolean computed from that phase would be a circular render dependency. Return false when there
 * is nothing to protect (the match is over) or a dialog of the game's own already holds the pause. */
export function useBackgroundPause(shouldPause: () => boolean): BackgroundPause {
  const [backgroundPaused, setBackgroundPaused] = useState(false)

  const shouldPauseRef = useRef(shouldPause)
  useEffect(() => {
    shouldPauseRef.current = shouldPause
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && shouldPauseRef.current()) setBackgroundPaused(true)
    })
    return () => subscription.remove()
  }, [])

  const resume = useCallback(() => setBackgroundPaused(false), [])

  return { backgroundPaused, resume }
}

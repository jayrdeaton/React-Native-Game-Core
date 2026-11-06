import { useState } from 'react'
import { Dimensions, useWindowDimensions } from 'react-native'

import { OrientationMode } from './OrientationMode'

export interface OrientationState {
  // The seat mode the window's shape calls for: side by side in a window wider than tall, face to
  // face otherwise.
  orientationMode: OrientationMode
  // Always false: player 1 sits on the left in side by side, in reading order.
  p1OnRight: boolean
  // Always false: nothing turns content upside down any more.
  upsideDown: boolean
  // Always true: the window's shape is known from the first render.
  resolved: boolean
}

const FACE_TO_FACE: OrientationState = { orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true }
const SIDE_BY_SIDE: OrientationState = { orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true }

function stateForWindow(width: number, height: number): OrientationState {
  return width > height ? SIDE_BY_SIDE : FACE_TO_FACE
}

// Until 0.15 this read the accelerometer and drew every turn itself, for apps that kept the OS in
// portrait. Now the OS turns the interface (or keeps a phone in portrait), so the only thing left to
// read is the window's shape, the rule web always used. The four fields keep their shape so callers
// compile unchanged; the window-shape rule is what they get on every platform.

// A one-time, non-subscribing read of the same answer, for a caller seeding something it freezes
// (a match's layout, say) that must not re-render when the window changes.
export function getOrientationSnapshot(): OrientationState {
  const { width, height } = Dimensions.get('window')
  return stateForWindow(width, height)
}

// The seat mode for the current window. Follows the window live (an iPad turning, a browser window
// resized) unless `locked`, which freezes this call site at whatever it read when `locked` turned
// true, for example a round's layout. The two possible values are module constants, so a caller's
// effect or memo keyed on the result only reruns when the mode really changes.
export function useOrientationState(locked = false): OrientationState {
  const { width, height } = useWindowDimensions()
  const shared = stateForWindow(width, height)
  // Kept in sync during render while unlocked, so locking freezes the then-current value (React's
  // "adjusting some state when a prop changes" pattern; a ref read during render isn't safe).
  const [frozen, setFrozen] = useState(shared)
  if (!locked && frozen !== shared) setFrozen(shared)
  return locked ? frozen : shared
}

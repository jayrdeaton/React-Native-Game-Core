import { ReactNode } from 'react'
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native'

import { OrientationMode } from './OrientationMode'
import { getViewRotation, rotateDimensions } from './rotation'
import { useOrientationState } from './useOrientationState'

export interface FakeLandscapeViewProps {
  // All three default to a live ambient read (via useOrientationState) when omitted — a simple
  // screen that just wants "however the phone is actually being held, right now" can render
  // <FakeLandscapeView> with none of these and get correct, live-updating behavior for free.
  // Pass them explicitly only when a caller's own reading needs to differ from the ambient one —
  // e.g. a fading dual-zone layout whose panel content deliberately lags the live reading behind a
  // transition, where the ambient default would be momentarily wrong mid-fade.
  orientationMode?: OrientationMode
  p1OnRight?: boolean
  upsideDown?: boolean
  // Only consulted when the ambient default is actually being used (i.e. when orientationMode/
  // p1OnRight/upsideDown are all omitted) — matches useOrientationState's own `locked` param.
  locked?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

// Wraps `children` in whatever rotation keeps it gravity-upright for however the device is
// currently being held — see getViewRotation for the angle itself, and its own comment for why this
// is needed at all now that the app is portrait-locked at the OS level.
//
// A 90°/-90° rotation swaps the content's effective footprint (what was width becomes height), so
// those two cases render into an inner container explicitly sized/centered for the swap — the
// standard "fake landscape inside a portrait-locked app" trick — rather than just rotating in place,
// which would clip against the real (unswapped, portrait-shaped) window. 180° doesn't change the
// footprint at all, so it skips straight to a plain rotate.
//
// Safe for tap-driven content — React Native's own touch responder system hit-tests against the
// rendered/transformed layout correctly. NOT safe for continuous gesture tracking
// (react-native-gesture-handler's translation deltas read raw, untransformed native coordinates) —
// never wrap the game board/touch layer in this.
export function FakeLandscapeView({ orientationMode, p1OnRight, upsideDown, locked = false, style, children }: FakeLandscapeViewProps) {
  const { width, height } = useWindowDimensions()
  // Always subscribed, even when every field below ends up overridden by an explicit prop — the
  // ambient reading has to stay live for the zero-prop case to actually update as the phone moves,
  // and a caller supplying its own full triple (e.g. loadout's fade-lagged panelLayout) is already
  // subscribed to the same live source one level up for its own reasons, so this doesn't introduce
  // a new re-render trigger in practice — just some discarded work within a render already happening.
  const ambient = useOrientationState(locked)
  const resolvedOrientationMode = orientationMode ?? ambient.orientationMode
  const resolvedP1OnRight = p1OnRight ?? ambient.p1OnRight
  const resolvedUpsideDown = upsideDown ?? ambient.upsideDown
  const rotation = getViewRotation(resolvedOrientationMode, resolvedP1OnRight, resolvedUpsideDown)

  if (rotation === 0) return <View style={style}>{children}</View>

  if (rotation === 180) return <View style={[style, styles.flip180]}>{children}</View>

  const swapped = rotateDimensions(width, height, rotation)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <View style={[style, styles.absolute, { height: swapped.height, left: (width - swapped.width) / 2, top: (height - swapped.height) / 2, transform: [{ rotate: `${rotation}deg` }], width: swapped.width }]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute'
  },
  flip180: {
    transform: [{ rotate: '180deg' }]
  }
})

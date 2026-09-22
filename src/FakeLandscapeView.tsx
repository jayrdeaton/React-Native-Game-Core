import { ReactNode } from 'react'
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native'

import { OrientationMode } from './OrientationMode'
import { getViewRotation, rotateDimensions, toRotationStyle } from './rotation'
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
// those two cases size/center the inner container explicitly for the swap — the standard "fake
// landscape inside a portrait-locked app" trick — rather than just rotating in place, which would
// clip against the real (unswapped, portrait-shaped) window. 180° doesn't change the footprint at
// all, so it just applies a plain rotate to the same inner container.
//
// The element tree is IDENTICAL at every angle — always outer View > inner View > children — and only
// the styles differ. This is load-bearing, not tidiness: React reconciles by position and type, so a
// per-angle tree (a bare <View> at 0°, a wrapped one at ±90°) unmounts and remounts the whole
// `children` subtree every time the device is rotated between them, wiping every descendant's state
// (undo history, animation state, scroll positions) and costing a full mount's worth of JS — measured
// at ~700-800ms per rotation for a whole game screen, versus ~90-250ms for a plain update. Never
// reintroduce a per-angle branch in the returned tree; branch on the style values only.
//
// At 0°/180° the caller's flattened `style` is SPLIT so layout is exactly what a single <View style>
// would have produced (the pre-two-level implementation): the OUTER view carries everything that
// positions/sizes the view inside ITS PARENT (OUTER_STYLE_KEYS: position/insets, zIndex, flex*,
// width/height/min/max, aspectRatio, alignSelf, margins, display, transform), so an absolute overlay
// stays out of flow and a content-sized/row parent sees the same box as before. The INNER view is the
// container `children` are laid out in — every remaining key (alignItems, justifyContent,
// flexDirection, gap, padding, borders, backgroundColor, overflow, opacity, pointerEvents, ...) plus
// flexGrow:1/flexShrink:1/flexBasis:auto so it fills the outer box (or sizes to content when the outer
// is content-sized) — and carries the 180° rotate about its own centre, which equals the outer's
// centre. `direction` is copied to both (it is inherited layout state). At ±90° the outer is an
// absoluteFill box-none and the inner is the caller's style plus the explicit swapped size/position and
// rotate — identical to the original implementation. Known limit: boxSizing:'content-box' combined with
// an explicit width/height would size the outer without the inner's padding/border.
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

  const rotated = rotation === 90 || rotation === -90
  if (!rotated) {
    const { outer, inner } = splitStyle(StyleSheet.flatten(style))
    return (
      <View style={outer} pointerEvents='box-none'>
        <View style={[styles.fillOuter, inner, toRotationStyle(rotation)]}>{children}</View>
      </View>
    )
  }

  const swapped = rotateDimensions(width, height, rotation)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <View style={[style, styles.absolute, { height: swapped.height, left: (width - swapped.width) / 2, top: (height - swapped.height) / 2, transform: [{ rotate: `${rotation}deg` }], width: swapped.width }]}>{children}</View>
    </View>
  )
}

// Style keys that position/size a view within its parent. Everything else stays with the container
// the children live in. `transform`/`transformOrigin` go outer so a caller transform composes with the
// inner's rotation instead of being overridden by it.
const OUTER_STYLE_KEYS = new Set<string>(['alignSelf', 'aspectRatio', 'bottom', 'display', 'end', 'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'height', 'inset', 'insetBlock', 'insetBlockEnd', 'insetBlockStart', 'insetInline', 'insetInlineEnd', 'insetInlineStart', 'left', 'margin', 'marginBlock', 'marginBlockEnd', 'marginBlockStart', 'marginBottom', 'marginEnd', 'marginHorizontal', 'marginInline', 'marginInlineEnd', 'marginInlineStart', 'marginLeft', 'marginRight', 'marginStart', 'marginTop', 'marginVertical', 'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'position', 'right', 'start', 'top', 'transform', 'transformOrigin', 'width', 'zIndex'])
const BOTH_STYLE_KEYS = new Set<string>(['direction'])

function splitStyle(flat: ViewStyle | undefined): { outer: ViewStyle | undefined; inner: ViewStyle | undefined } {
  if (!flat) return { outer: undefined, inner: undefined }
  const outer: Record<string, unknown> = {}
  const inner: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (OUTER_STYLE_KEYS.has(key)) outer[key] = value
    else inner[key] = value
    if (BOTH_STYLE_KEYS.has(key)) outer[key] = value
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle }
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute'
  },
  // The 0°/180° inner container: fills the outer box, or sizes to content when the outer is
  // content-sized (auto basis); shrinks to a fixed-size outer so overflow clips at the outer bounds.
  fillOuter: {
    flexBasis: 'auto',
    flexGrow: 1,
    flexShrink: 1
  }
})

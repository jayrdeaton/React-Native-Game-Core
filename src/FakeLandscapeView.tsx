import { ReactNode } from 'react'
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native'

import { rotateDimensions, toRotationStyle, ViewRotation } from './rotation'

export interface FakeLandscapeViewProps {
  // The angle to turn the content by, 0 by default. The OS turns the screen itself, so only content
  // drawn to face another seat needs one (180 for player 2 across a face-to-face screen, or @tastic/
  // hud's RotatedFrame handed a dialog's rotation).
  rotation?: ViewRotation
  // Lets touches fall through the frame's own boxes to whatever is beneath it, so only its children
  // claim them: the inner View becomes box-none too (the outer one always is). For a frame laid OVER
  // other content (a root-level overlay or dialog layer); a screen that owns the whole window leaves
  // it off.
  passThrough?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

// A 90°/-90° rotation swaps the content's effective footprint (what was width becomes height), so
// those two cases size/center the inner container explicitly for the swap - the standard "fake
// landscape inside a portrait-locked app" trick - rather than just rotating in place, which would
// clip against the real (unswapped, portrait-shaped) window. 180° doesn't change the footprint at
// all, so it just applies a plain rotate to the same inner container.
//
// The element tree is IDENTICAL at every angle - always outer View > inner View > children - and only
// the styles differ. This is load-bearing, not tidiness: React reconciles by position and type, so a
// per-angle tree (a bare <View> at 0°, a wrapped one at ±90°) unmounts and remounts the whole
// `children` subtree every time the device is rotated between them, wiping every descendant's state
// (undo history, animation state, scroll positions) and costing a full mount's worth of JS - measured
// at ~700-800ms per rotation for a whole game screen, versus ~90-250ms for a plain update. Never
// reintroduce a per-angle branch in the returned tree; branch on the style values only.
//
// At 0°/180° the caller's flattened `style` is SPLIT so layout is exactly what a single <View style>
// would have produced (the pre-two-level implementation): the OUTER view carries everything that
// positions/sizes the view inside ITS PARENT (OUTER_STYLE_KEYS: position/insets, zIndex, flex*,
// width/height/min/max, aspectRatio, alignSelf, margins, display, transform), so an absolute overlay
// stays out of flow and a content-sized/row parent sees the same box as before. The INNER view is the
// container `children` are laid out in - every remaining key (alignItems, justifyContent,
// flexDirection, gap, padding, borders, backgroundColor, overflow, opacity, pointerEvents, ...) plus
// flexGrow:1/flexShrink:1/flexBasis:auto so it fills the outer box (or sizes to content when the outer
// is content-sized) - and carries the 180° rotate about its own centre, which equals the outer's
// centre. `direction` is copied to both (it is inherited layout state). At ±90° the outer is an
// absoluteFill box-none and the inner is the caller's style plus the explicit swapped size/position and
// rotate - identical to the original implementation. Known limit: boxSizing:'content-box' combined with
// an explicit width/height would size the outer without the inner's padding/border.
//
// Safe for tap-driven content - React Native's own touch responder system hit-tests against the
// rendered/transformed layout correctly. NOT safe for continuous gesture tracking
// (react-native-gesture-handler's translation deltas read raw, untransformed native coordinates) -
// never wrap the game board/touch layer in this.
export function FakeLandscapeView({ rotation = 0, passThrough = false, style, children }: FakeLandscapeViewProps) {
  const { width, height } = useWindowDimensions()
  const innerPointerEvents = passThrough ? 'box-none' : undefined

  const rotated = rotation === 90 || rotation === -90
  if (!rotated) {
    const { outer, inner } = splitStyle(StyleSheet.flatten(style))
    return (
      <View style={outer} pointerEvents='box-none'>
        <View style={[styles.fillOuter, inner, toRotationStyle(rotation)]} pointerEvents={innerPointerEvents}>
          {children}
        </View>
      </View>
    )
  }

  const swapped = rotateDimensions(width, height, rotation)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <View style={[style, styles.absolute, { height: swapped.height, left: (width - swapped.width) / 2, top: (height - swapped.height) / 2, transform: [{ rotate: `${rotation}deg` }], width: swapped.width }]} pointerEvents={innerPointerEvents}>
        {children}
      </View>
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

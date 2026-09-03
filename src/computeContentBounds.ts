import { clamp } from './clamp'

export interface ContentBounds {
  contentWidth: number
  gutterWidth: number
}

// Caps a window's width at maxContentWidth, splitting whatever's left over into two equal gutters
// instead of letting content keep growing (or sit off-center within a now-much-wider parent) past
// the point where growing further stops being useful — the domain-agnostic geometry half of
// letterboxing a wide desktop/web layout, e.g. a board game's play area. Pass
// Number.POSITIVE_INFINITY as maxContentWidth for a caller that wants no cap at all — contentWidth
// then always equals windowWidth and gutterWidth is always 0, a built-in escape hatch rather than a
// separate disable flag.
//
// Pure geometry only, by design (see this package's own README) — takes windowWidth as a plain
// number rather than reading useWindowDimensions() itself, mirroring @tastic/split-screen's
// rotateInsets(insets, rotation): the caller is always the one composing this with whatever other
// geometry (device safe-area insets, a split-screen zone boundary, ...) its own layout needs; this
// function only ever owns the clamp-and-split calculation itself.
export function computeContentBounds(windowWidth: number, maxContentWidth: number): ContentBounds {
  const contentWidth = clamp(windowWidth, 0, maxContentWidth)
  const gutterWidth = Math.max(0, (windowWidth - contentWidth) / 2)
  return { contentWidth, gutterWidth }
}

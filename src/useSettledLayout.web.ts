import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent, View } from 'react-native'

// Deliberately not imported from './useSettledLayout' — that specifier resolves to THIS file on
// web via Metro's platform-extension resolution, which would make it circular from inside itself.
export type SettledLayoutSize = { width: number; height: number }

export type UseSettledLayoutResult<T> = {
  onLayout: (event: LayoutChangeEvent) => void
  ref: React.RefObject<T | null>
  size: SettledLayoutSize | null
}

// A container's own onLayout can simply never fire on the very first mount through Expo Router on
// web — the same category of race useSettledWindowDimensions fixes for the whole window, just at
// the level of one measured container instead. Fleet games have hit this as a Skia canvas sized
// from a useState(0)/onLayout pair that never gets its first real measurement, staying stuck at its
// zero initial value until something unrelated forces a relayout.
//
// Re-measures the container directly via getBoundingClientRect() — bypassing onLayout entirely,
// same reasoning as useSettledWindowDimensions reading window.innerWidth/innerHeight directly
// rather than trusting react-native-web's own Dimensions module — two animation frames after mount,
// if onLayout hasn't already reported a real (non-zero) size by then. A real subsequent onLayout
// call (an actual resize) is unaffected; this only ever corrects a missing first measurement.
//
// Also dispatches one synthetic 'resize' event on window at that same two-frame mark, regardless of
// whether a correction was needed — see useSettledWindowDimensions.web.ts's own comment for why:
// confirmed by hand that a @shopify/react-native-skia web <Canvas> can already have the right size
// and still never paint its first frame without a real 'resize' *event*, independent of props/state.
export function useSettledLayout<T extends View = View>(): UseSettledLayoutResult<T> {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<SettledLayoutSize | null>(null)

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  useEffect(() => {
    if (size && size.width > 0 && size.height > 0) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const node = ref.current as unknown as HTMLElement | null
        if (node && typeof node.getBoundingClientRect === 'function') {
          const rect = node.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            setSize((prev) => (prev && prev.width === rect.width && prev.height === rect.height ? prev : { width: rect.width, height: rect.height }))
          }
        }
        window.dispatchEvent(new Event('resize'))
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [size])

  return { ref, onLayout, size }
}

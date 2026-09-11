import { useCallback, useRef, useState } from 'react'
import type { LayoutChangeEvent, View } from 'react-native'

export type SettledLayoutSize = { width: number; height: number }

export type UseSettledLayoutResult<T> = {
  onLayout: (event: LayoutChangeEvent) => void
  ref: React.RefObject<T | null>
  size: SettledLayoutSize | null
}

// Native's onLayout is reliable — it always fires with the real size before the first paint that
// matters, so this is a plain onLayout-backed measurement with no correction needed. See
// useSettledLayout.web.ts for the web-specific fallback this hook exists to provide there.
export function useSettledLayout<T extends View = View>(): UseSettledLayoutResult<T> {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<SettledLayoutSize | null>(null)

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  return { ref, onLayout, size }
}

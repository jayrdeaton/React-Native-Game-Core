import { useEffect, useState } from 'react'

type WindowSize = { width: number; height: number }

function readWindowSize(): WindowSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  return { width: window.innerWidth, height: window.innerHeight }
}

// react-native-web's useWindowDimensions() can get stuck reporting a wrong size through Expo
// Router's web output — several fleet games have hit this as a Skia canvas (or a whole
// ScrollView-gated screen) that renders blank at 0-size, or at a stale size, until something
// unrelated forces a real browser resize. The trigger is a timing race around hydration, not a bug
// in any one game's own code, which is why this lives here rather than being patched per-app.
//
// Reads window.innerWidth/innerHeight directly rather than trusting react-native-web's own
// Dimensions module, and re-reads once more, two animation frames after mount — by then layout has
// genuinely settled, so this catches a value that was wrong at the very first paint. A real resize
// event keeps working normally afterward; this only ever corrects the initial reading.
//
// Also dispatches one synthetic 'resize' event on window at that same two-frame mark, with no size
// change involved at all — confirmed by hand that this alone (no actual resize) is what unsticks a
// @shopify/react-native-skia web <Canvas> that never painted its first frame. That canvas can already
// have the right size (this hook's own state correction above, or a correct value from the very
// start) and still never draw anything until a real 'resize' *event* fires — evidently something in
// Skia's web canvas or CanvasKit's surface setup listens for that event specifically to trigger its
// first paint, independent of props/state. A plain React re-render, however many of them, does not
// do this; only the event does.
export function useSettledWindowDimensions(): WindowSize & { fontScale: number; scale: number } {
  const [size, setSize] = useState<WindowSize>(readWindowSize)

  useEffect(() => {
    const onResize = () => setSize(readWindowSize())
    window.addEventListener('resize', onResize)

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setSize(readWindowSize())
        window.dispatchEvent(new Event('resize'))
      })
    })

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  return { width: size.width, height: size.height, fontScale: 1, scale: typeof window === 'undefined' ? 1 : window.devicePixelRatio }
}

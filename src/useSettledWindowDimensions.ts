import { useWindowDimensions } from 'react-native'

// Native has none of react-native-web's SSR/hydration timing race — useWindowDimensions() already
// reports the real, current size synchronously on mount and stays live via RN's own
// dimension-change listener. Kept as a plain re-export so every platform can import the same hook
// name; see useSettledWindowDimensions.web.ts for the web-specific race this hook exists to fix.
export const useSettledWindowDimensions = useWindowDimensions

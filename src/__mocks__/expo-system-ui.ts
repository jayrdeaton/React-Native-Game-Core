// expo-system-ui has no "exports" field at all - its plain "main" field ("build/SystemUI.js") points
// straight at genuine, already-built ESM (`import`/`export` syntax), which Jest's default
// transformIgnorePatterns (excludes node_modules) can't parse. See useThemedRootBackground.ts's own doc
// for what this module is used for.
export const setBackgroundColorAsync = jest.fn(() => Promise.resolve())

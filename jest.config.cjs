module.exports = require('@infinitetoken/jest-config/react-native')({
  // react-native has no real implementation under jsdom. expo-system-ui (useThemedRootBackground) and
  // expo-screen-orientation (the interface-orientation entry) each ship a built entry that's ESM Jest
  // can't load from node_modules; see each mock file's own comment.
  moduleNameMapper: {
    '^expo-screen-orientation$': '<rootDir>/src/__mocks__/expo-screen-orientation.ts',
    '^expo-system-ui$': '<rootDir>/src/__mocks__/expo-system-ui.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  }
})

module.exports = require('@infinitetoken/jest-config/react-native')({
  // react-native has no real implementation under jsdom. expo-sensors needs no mock at all here -
  // this package never imports it directly (see useOrientationState.tsx's DeviceMotionModule doc);
  // tests construct their own local fake deviceMotion module and inject it directly instead.
  // expo-system-ui DOES need one, unlike expo-sensors - useThemedRootBackground imports it directly,
  // and its built entry point is ESM Jest can't load from node_modules (see the mock file's own comment).
  moduleNameMapper: {
    '^expo-system-ui$': '<rootDir>/src/__mocks__/expo-system-ui.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  }
})

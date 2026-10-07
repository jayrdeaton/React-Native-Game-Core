module.exports = require('@infinitetoken/jest-config/react-native')({
  // react-native has no real implementation under jsdom. expo-sensors needs no mock at all here —
  // this package never imports it directly (see useOrientationState.tsx's DeviceMotionModule doc);
  // tests construct their own local fake deviceMotion module and inject it directly instead.
  // expo-status-bar DOES need one, unlike expo-sensors — RotationAwareStatusBar imports it directly
  // (see that file's own doc for why that's fine to do at the package level), and its real entry
  // point resolves to raw untranspiled TypeScript with no built output Jest can load from
  // node_modules (see the mock file's own comment).
  // expo-system-ui is the same "imported directly by a package file" situation as expo-status-bar,
  // for a different underlying reason — see the mock file's own comment for the distinction.
  moduleNameMapper: {
    '^expo-status-bar$': '<rootDir>/src/__mocks__/expo-status-bar.ts',
    '^expo-system-ui$': '<rootDir>/src/__mocks__/expo-system-ui.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  }
})

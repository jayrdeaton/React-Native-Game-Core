module.exports = require('@infinitetoken/jest-config/react-native')({
  // react-native has no real implementation under jsdom. expo-sensors needs no mock at all here —
  // this package never imports it directly (see useOrientationState.tsx's DeviceMotionModule doc);
  // tests construct their own local fake deviceMotion module and inject it directly instead.
  // expo-status-bar DOES need one, unlike expo-sensors — RotationAwareStatusBar imports it directly
  // (see that file's own doc for why that's fine to do at the package level), and its real entry
  // point resolves to raw untranspiled TypeScript with no built output Jest can load from
  // node_modules (see the mock file's own comment).
  // @react-native-async-storage/async-storage and @tastic/edge-guard are the same "imported
  // directly by a package file, not injected" call as expo-status-bar (see
  // createGameSettingsProvider.tsx's own doc) — async-storage's native module is never linked under
  // jsdom, and edge-guard's real implementation reaches into react-native's Settings module, which
  // this directory's own react-native.ts mock deliberately doesn't implement (see edge-guard.ts's
  // own comment).
  // expo-system-ui is the same "imported directly by a package file" situation as expo-status-bar,
  // for a different underlying reason — see the mock file's own comment for the distinction.
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/async-storage.ts',
    '^@tastic/edge-guard$': '<rootDir>/src/__mocks__/edge-guard.ts',
    '^expo-status-bar$': '<rootDir>/src/__mocks__/expo-status-bar.ts',
    '^expo-system-ui$': '<rootDir>/src/__mocks__/expo-system-ui.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  }
})

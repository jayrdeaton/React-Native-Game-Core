module.exports = require('@infinitetoken/jest-config/react-native')({
  // react-native has no real implementation under jsdom. expo-sensors needs no mock at all here —
  // this package never imports it directly (see useOrientationState.tsx's DeviceMotionModule doc);
  // tests construct their own local fake deviceMotion module and inject it directly instead.
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  }
})

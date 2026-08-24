// Native always is touch — there's no keyboard/mouse-vs-touch ambiguity to detect on a real device.
// (LightCycles' own copy of this hook returns false here, but only because that app gates its
// keyboard-scheme UI on Platform.OS directly and never actually reads this value on native — as a
// standalone, general-purpose hook, true is the semantically correct answer for "is a real device
// touch-primary".) See useIsTouchPrimaryDevice.web.ts for the actual capability detection this stands
// in for on native.
export function useIsTouchPrimaryDevice(): boolean {
  return true
}

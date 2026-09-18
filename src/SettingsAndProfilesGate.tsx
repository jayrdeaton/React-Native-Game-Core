import type { ReactNode } from 'react'

// Structural shape of an app's own bound `Gate` component from `@rific/splash-gate`'s
// `createGate([...])` call — NOT imported from `@rific/splash-gate` itself (that would make this
// package newly depend on it just for a type). Same "take the concrete thing as a prop, don't
// import what produces it" choice `OrientationProvider` already makes for `deviceMotion`/
// expo-sensors. Any app's real bound Gate (typed as `SplashGate<T>['Gate']` for that app's own
// full gate-name union, e.g. 'theme'|'haptics'|'sound'|'fonts'|'settings'|'profiles') satisfies
// this narrower shape structurally, as long as 'settings' and 'profiles' are members of that
// union — which every one of this component's current consumers' own createGate(...) calls
// already include.
export interface SettingsAndProfilesGateComponentProps {
  gate: 'settings' | 'profiles'
  ready: boolean
  children: ReactNode
}

export interface SettingsAndProfilesGateProps {
  // The app's own bound Gate — e.g. `SplashGate` from `@/utils/splashGate` (every current consumer
  // already exports it under exactly that name).
  Gate: (props: SettingsAndProfilesGateComponentProps) => ReactNode
  settingsLoaded: boolean
  profilesLoaded: boolean
  children: ReactNode
}

// Generalizes the double-SplashGate wrapper hand-rolled once per app (AirHockey, BoxHockey, Pong,
// LightCycles) — nesting a 'settings' gate outside a 'profiles' gate around everything that reads
// GameSettingsProvider's or ProfilesProvider's own context, so no screen mounts on stale defaults
// before its real AsyncStorage-backed (or, for profiles, shared-App-Group-reconciled) value exists.
// Implemented 3 different ways before this — a merged 'GatedApp' component (BoxHockey, Pong;
// byte-identical between the two), and split into two separately-named components at each app's own
// call site (AirHockey's SettingsReadyGate/ProfilesReadyGate, LightCycles' SettingsGate/ProfilesGate)
// — same composition, 3 local names. This component owns only the nesting/gate-name/fallback-default
// shape; it has no AsyncStorage/context opinion of its own — `settingsLoaded`/`profilesLoaded` are
// the calling app's own useGameSettings()/useProfiles() `loaded` fields, read by a small per-app
// wrapper (see migration notes) since neither hook can be called here directly — both live in
// app-local `@/hooks/*` files, not in any shared package. Order (settings outer, profiles inner)
// matches every app's prior implementation; it has no observable effect today since no call site
// anywhere in the fleet passes a custom `fallback` (both gates default to `null`), but keep the
// order as documented here in case that ever changes.
export function SettingsAndProfilesGate({ Gate, settingsLoaded, profilesLoaded, children }: SettingsAndProfilesGateProps) {
  return (
    <Gate gate='settings' ready={settingsLoaded}>
      <Gate gate='profiles' ready={profilesLoaded}>
        {children}
      </Gate>
    </Gate>
  )
}

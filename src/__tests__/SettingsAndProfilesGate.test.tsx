import { render, screen } from '@testing-library/react'

import { SettingsAndProfilesGate, type SettingsAndProfilesGateComponentProps } from '../SettingsAndProfilesGate'

// A minimal stand-in for an app's own createGate(...)-produced Gate component — real ones render
// `fallback` (defaulting to null) until `ready`, then render `children`. This fake mirrors that
// contract closely enough to exercise the nesting/ordering this component is actually responsible
// for, without depending on @rific/splash-gate (which this package deliberately does not import —
// see SettingsAndProfilesGate.tsx's own doc).
function FakeGate({ gate, ready, children }: SettingsAndProfilesGateComponentProps) {
  if (!ready) {
    return <>{`waiting:${gate}`}</>
  }
  return <>{children}</>
}

describe('SettingsAndProfilesGate', () => {
  it('renders children once both settings and profiles are ready', () => {
    render(
      <SettingsAndProfilesGate Gate={FakeGate} settingsLoaded={true} profilesLoaded={true}>
        <>content</>
      </SettingsAndProfilesGate>
    )
    expect(screen.getByText('content')).toBeTruthy()
  })

  it('holds children back on the outer settings gate when settings are not yet loaded, even if profiles are', () => {
    render(
      <SettingsAndProfilesGate Gate={FakeGate} settingsLoaded={false} profilesLoaded={true}>
        <>content</>
      </SettingsAndProfilesGate>
    )
    expect(screen.getByText('waiting:settings')).toBeTruthy()
    expect(screen.queryByText('content')).toBeNull()
  })

  it('holds children back on the inner profiles gate when settings are ready but profiles are not', () => {
    render(
      <SettingsAndProfilesGate Gate={FakeGate} settingsLoaded={true} profilesLoaded={false}>
        <>content</>
      </SettingsAndProfilesGate>
    )
    expect(screen.getByText('waiting:profiles')).toBeTruthy()
    expect(screen.queryByText('content')).toBeNull()
  })

  it('nests settings outside profiles, so an unready settings gate never even mounts the profiles gate', () => {
    const gateOrder: Array<'settings' | 'profiles'> = []
    function OrderTrackingGate(props: SettingsAndProfilesGateComponentProps) {
      gateOrder.push(props.gate)
      return <FakeGate {...props} />
    }

    render(
      <SettingsAndProfilesGate Gate={OrderTrackingGate} settingsLoaded={false} profilesLoaded={true}>
        <>content</>
      </SettingsAndProfilesGate>
    )

    expect(gateOrder).toEqual(['settings'])
  })
})

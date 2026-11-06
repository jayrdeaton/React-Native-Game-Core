import { readFileSync } from 'fs'
import { join } from 'path'

import * as interfaceOrientation from '../interfaceOrientation'

describe('@tastic/core/interface-orientation', () => {
  it('exposes the tilt helpers and the tracker', () => {
    expect(Object.keys(interfaceOrientation).sort()).toEqual(['interfaceOrientationFromHold', 'tiltToScreenAxes', 'trackInterfaceOrientation'])
  })

  // expo-screen-orientation is an optional peer, so the root barrel must never load this entry.
  it('is not reachable from the root barrel', () => {
    const barrel = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(barrel).not.toMatch(/interfaceOrientation|expo-screen-orientation/)
  })
})

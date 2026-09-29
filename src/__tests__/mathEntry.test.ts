import { readFileSync } from 'fs'
import { join } from 'path'

import * as math from '../math'

// The ./math entry exists so headless consumers can use vector math without loading the root
// barrel's native peers or its import-time side effect. That only holds while every module it
// re-exports stays import-free, so the boundary is asserted from the source itself.
const SOURCES = ['math/index.ts', 'clamp.ts', 'Vec2.ts']

describe('@tastic/core/math', () => {
  it('exposes the vector helpers and clamp', () => {
    expect(Object.keys(math).sort()).toEqual(['add', 'clamp', 'distance', 'dot', 'length', 'normalize', 'scale', 'subtract'])
  })

  it.each(SOURCES)('%s imports nothing outside the pure math files', (file) => {
    const source = readFileSync(join(__dirname, '..', file), 'utf8')
    const specifiers = [...source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
    for (const specifier of specifiers) expect(['../clamp', '../Vec2']).toContain(specifier)
  })
})

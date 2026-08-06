import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const adapters = readFileSync(join(__dirname, '../../apps/web/src/runtime/projectionAdapters.ts'), 'utf8')

describe('projection adapters boundary (Phase 2)', () => {
  it('maps contracts to web view models without touching React or features', () => {
    expect(adapters).not.toMatch(/from ['"]react['"]/)
    expect(adapters).not.toMatch(/from ['"].*features\//)
    expect(adapters).not.toMatch(/from ['"].*runtime\//)
    expect(adapters).toMatch(/@local-creative-os\/contracts/)
    expect(adapters).toMatch(/from ['"]\.\.\/model['"]/)
  })

  it('exposes the full projection surface used by the shell', () => {
    for (const name of ['parseArtifactRevisions', 'parseWorkspaceStates', 'parseProcessProjection']) {
      expect(adapters).toMatch(new RegExp(`export function ${name}`))
    }
  })
})

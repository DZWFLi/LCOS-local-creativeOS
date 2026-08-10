import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const app = readFileSync(join(root, 'apps/web/src/App.tsx'), 'utf8')
const modeHelper = readFileSync(join(root, 'apps/web/src/runtime/projectMode.ts'), 'utf8')

describe('Production / Fixture storage boundary (Phase A)', () => {
  it('defines an explicit runtime-mode helper', () => {
    expect(modeHelper).toContain('export const isRuntimeProjectMode')
    expect(modeHelper).toContain("mode === 'runtime'")
    expect(modeHelper).toContain('prototypeStorage')
  })

  it('production runtime mutations go to Core, not prototypeStorage', () => {
    // Invariant: in runtime mode the save branch calls bridge.saveMutations;
    // savePrototypeState must only be reachable on the non-runtime path.
    const runtimeSaveIndex = app.indexOf('if (isRuntimeProjectMode(bootMode))')
    expect(runtimeSaveIndex).toBeGreaterThanOrEqual(0)
    const branch = app.slice(runtimeSaveIndex, runtimeSaveIndex + 1600)
    expect(branch).toContain('bridge.saveMutations(snapshot)')
    const fallback = branch.slice(branch.indexOf('} else {') + 1)
    expect(fallback).toContain('savePrototypeState(activeProjectId, snapshot)')
  })

  it('fixture mode may still use prototypeStorage', () => {
    expect(app).toContain('savePrototypeState(activeProjectId, snapshot)')
    expect(app).toContain('loadPrototypeState')
  })
})

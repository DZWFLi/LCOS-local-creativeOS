import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const projectionSource = readFileSync(new URL('../src/features/surfaces/ProjectionSurfaces.tsx', import.meta.url), 'utf8')

describe('presentation membership contract', () => {
  it('does not promote transient Selection to Context or Workflow membership', () => {
    expect(projectionSource).not.toContain('explicitObjectIds:props.selectedIds')
    expect(projectionSource).toContain('explicitObjectIds:props.presentationIds')
  })
})

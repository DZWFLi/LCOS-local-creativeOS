import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ARTIFACT_RETURN_STATUSES,
  LCOS_RUN_STATUSES,
  RUNTIME_DISPATCH_STATUSES,
} from '../../packages/domain/src'

const repositorySource = readFileSync(
  join(process.cwd(), 'apps/local-core/src/metadata-repository.ts'),
  'utf8',
)

describe('ARCH-RUNTIME-001 canonical execution boundaries', () => {
  it('keeps canonical Run statuses independent from provider statuses', () => {
    expect(LCOS_RUN_STATUSES).toEqual([
      'created',
      'queued',
      'running',
      'waiting_input',
      'completed',
      'failed',
      'cancelled',
    ])
    expect(LCOS_RUN_STATUSES).not.toContain('assigned')
    expect(LCOS_RUN_STATUSES).not.toContain('review')
    expect(LCOS_RUN_STATUSES).not.toContain('retrying')
    expect(LCOS_RUN_STATUSES).not.toContain('timeout')
  })

  it('keeps Dispatch and ArtifactReturn lifecycles explicit', () => {
    expect(RUNTIME_DISPATCH_STATUSES).toEqual([
      'planned',
      'dispatching',
      'bound',
      'failed',
      'recovery_required',
    ])
    expect(ARTIFACT_RETURN_STATUSES).toEqual([
      'pending_review',
      'adopted',
      'rejected',
    ])
  })

  it('defines five separate runtime persistence tables', () => {
    for (const table of [
      'context_manifests',
      'runs',
      'runtime_dispatches',
      'runtime_bindings',
      'artifact_returns',
    ]) {
      expect(repositorySource).toContain(`CREATE TABLE ${table}`)
    }
    expect(repositorySource).toMatch(/CREATE TABLE runs[\s\S]*?CREATE TABLE runtime_dispatches/)
    expect(repositorySource).toMatch(/CREATE TABLE runtime_bindings[\s\S]*?provider_status TEXT/)
  })
})

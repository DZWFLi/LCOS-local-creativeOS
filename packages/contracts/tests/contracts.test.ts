import { describe, expectTypeOf, it } from 'vitest'
import type {
  ArtifactContract,
  ContextContract,
  ExecutionRuntimeContract,
  HealthStatus,
  ProjectCatalog,
  ProjectCatalogEntry,
  PreviewContract,
  ProjectContract,
  Result,
  ValidateProjectRootInput,
  ValidatedProjectRoot,
  WorkspaceQueryContract,
} from '../src/index'

describe('Frontend Alpha contract boundaries', () => {
  it('keeps project, artifact, context, and runtime boundaries distinct', () => {
    expectTypeOf<ProjectContract>().not.toEqualTypeOf<ArtifactContract>()
    expectTypeOf<ContextContract>().not.toEqualTypeOf<ExecutionRuntimeContract>()
    expectTypeOf<WorkspaceQueryContract>().not.toEqualTypeOf<PreviewContract>()
    expectTypeOf<Result<string>>().toMatchTypeOf<Result<unknown>>()
  })
})

describe('Local Core Phase 1A contracts', () => {
  it('keeps health and read-only project shapes available at the boundary', () => {
    expectTypeOf<HealthStatus>().toMatchTypeOf<{
      status: 'ok'
      service: 'local-core'
      mode: 'read_only_phase_1a' | 'phase_2_lite'
      version: string
    }>()
    expectTypeOf<ValidateProjectRootInput>().toHaveProperty('rootPath')
    expectTypeOf<ValidatedProjectRoot>().toHaveProperty('readable')
    expectTypeOf<ProjectCatalogEntry>().toHaveProperty('id')
    expectTypeOf<ProjectCatalog>().toHaveProperty('list')
  })
})

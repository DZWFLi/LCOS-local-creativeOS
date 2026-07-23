import { describe, expectTypeOf, it } from 'vitest'
import type {
  ArtifactContract,
  ContextContract,
  ExecutionRuntimeContract,
  PreviewContract,
  ProjectContract,
  Result,
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

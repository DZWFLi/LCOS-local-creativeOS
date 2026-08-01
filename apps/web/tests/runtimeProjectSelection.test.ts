import { describe, expect, it } from 'vitest'

import { selectRuntimeProject } from '../src/runtime/runtimeProjectSelection'

const SAMPLE_ID = 'disposable-mvp-sample'

describe('Runtime project selection Source Gate', () => {
  it('opens the explicitly requested project when it exists in the catalog', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-real' }, { id: SAMPLE_ID }],
      'project-real',
      SAMPLE_ID,
    )).toEqual({ kind: 'found', projectId: 'project-real' })
  })

  it('NEVER silently falls back when the requested project is missing', () => {
    expect(selectRuntimeProject(
      [{ id: SAMPLE_ID }, { id: 'project-other' }],
      'project-missing',
      SAMPLE_ID,
    )).toEqual({ kind: 'missing-requested', requestedProjectId: 'project-missing' })

    expect(selectRuntimeProject([], 'project-missing', SAMPLE_ID))
      .toEqual({ kind: 'missing-requested', requestedProjectId: 'project-missing' })
  })

  it('prefers the fallback sample only when no project was explicitly requested', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-other' }, { id: SAMPLE_ID }],
      null,
      SAMPLE_ID,
    )).toEqual({ kind: 'found', projectId: SAMPLE_ID })
  })

  it('falls back to the first catalog project when sample is absent and nothing requested', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-other' }],
      null,
      SAMPLE_ID,
    )).toEqual({ kind: 'found', projectId: 'project-other' })
  })

  it('reports an empty catalog distinctly', () => {
    expect(selectRuntimeProject([], null, SAMPLE_ID)).toEqual({ kind: 'empty-catalog' })
  })
})

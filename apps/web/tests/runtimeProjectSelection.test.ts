import { describe, expect, it } from 'vitest'

import { selectRuntimeProject } from '../src/runtime/runtimeProjectSelection'

describe('Runtime project selection Source Gate', () => {
  it('opens the explicitly requested project when it exists in the catalog', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-real' }, { id: 'disposable-mvp-sample' }],
      'project-real',
    )).toEqual({ kind: 'found', projectId: 'project-real' })
  })

  it('NEVER silently falls back when the requested project is missing', () => {
    expect(selectRuntimeProject(
      [{ id: 'disposable-mvp-sample' }, { id: 'project-other' }],
      'project-missing',
    )).toEqual({ kind: 'missing-requested', requestedProjectId: 'project-missing' })

    expect(selectRuntimeProject([], 'project-missing'))
      .toEqual({ kind: 'missing-requested', requestedProjectId: 'project-missing' })
  })

  it('uses catalog order and does not promote the sample implicitly', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-real' }, { id: 'disposable-mvp-sample' }],
      null,
    )).toEqual({ kind: 'found', projectId: 'project-real' })
  })

  it('does not treat the legacy sample as a production project', () => {
    expect(selectRuntimeProject([{ id: 'disposable-mvp-sample' }], null))
      .toEqual({ kind: 'empty-catalog' })
  })

  it('falls back to the first catalog project when sample is absent and nothing requested', () => {
    expect(selectRuntimeProject(
      [{ id: 'project-other' }],
      null,
    )).toEqual({ kind: 'found', projectId: 'project-other' })
  })

  it('reports an empty catalog distinctly', () => {
    expect(selectRuntimeProject([], null)).toEqual({ kind: 'empty-catalog' })
  })
})

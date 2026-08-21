import { describe, expect, it } from 'vitest'
import { createBlankProjectState, fixtureStateForProject } from './qa-fixtures/projectFixtures'

describe('v0.6 phase 3 Project Drive sessions', () => {
  it('keeps different project packages on different graphs', () => {
    const porta = fixtureStateForProject('project-portasplit')
    const huaxin = fixtureStateForProject('project-huaxin')
    expect(porta.projectId).not.toBe(huaxin.projectId)
    expect(porta.nodes.some((node) => node.title.includes('Thinker'))).toBe(true)
    expect(huaxin.nodes.some((node) => node.title.includes('Value_Poster'))).toBe(true)
    expect(porta.activeScopeId).not.toBe(huaxin.activeScopeId)
  })

  it('creates a blank project with one Root Canvas and one workspace', () => {
    const state = createBlankProjectState({ id: 'project-new', label: 'New', localPath: 'C:/New', updatedAt: 'now', pendingCount: 0, rootScopeId: 'scope-new-root' })
    expect(state.nodes).toHaveLength(0)
    expect(state.scopes).toHaveLength(1)
    expect(state.scopes[0].kind).toBe('root')
    expect(state.workspaces[0].scopeId).toBe('scope-new-root')
  })
})

import type { PersistedPrototypeState, ProjectPackage } from '../model'

const now = '2026-07-22T00:00:00.000Z'

/** 真实项目的空白初始状态（非演示数据，可安全进生产包）。 */
export function createBlankProjectState(project: ProjectPackage, railWidth = 350): PersistedPrototypeState {
  const rootScopeId = project.rootScopeId ?? `scope-${project.id}-root`
  const workspaceId = `workspace-${project.id}-main`
  return {
    version: 9,
    projectId: project.id,
    nodes: [],
    edges: [],
    scopes: [{ id: rootScopeId, label: '项目主画布', kind: 'root', parentScopeId: null, camera: { x: 160, y: 90, zoom: 1 }, layoutMode: 'manual', updatedAt: now }],
    workspaces: [{ id: workspaceId, label: '项目现场', intent: null, scopeId: rootScopeId, camera: { x: 160, y: 90, zoom: 1 }, visibleLayers: ['core', 'process'], focusedViewIds: [], contextPolicy: 'workspace-related', createdAt: now, updatedAt: now }],
    activeWorkspaceId: workspaceId,
    activeScopeId: rootScopeId,
    workRail: { pinned: true, collapsed: false, width: railWidth },
  }
}

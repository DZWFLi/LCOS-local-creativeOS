import { fixtureEdges, fixtureNodes, fixtureProjects, fixtureScopes, fixtureWorkspaces } from '../fixtures'
import type { CanvasEdge, CanvasNode, CanvasScope, PersistedPrototypeState, ProjectPackage, Workspace } from '../model'

const now = '2026-07-22T00:00:00.000Z'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function fixtureStateForProject(projectId: string, railWidth = 350): PersistedPrototypeState {
  if (projectId === 'project-huaxin') return huaxinState(railWidth)
  return {
    version: 9,
    projectId: 'project-portasplit',
    nodes: clone(fixtureNodes),
    edges: clone(fixtureEdges),
    workspaces: clone(fixtureWorkspaces),
    scopes: clone(fixtureScopes),
    activeWorkspaceId: fixtureWorkspaces[0].id,
    activeScopeId: fixtureScopes[0].id,
    workRail: { pinned: true, collapsed: false, width: railWidth },
  }
}

export function createBlankProjectState(project: ProjectPackage, railWidth = 350): PersistedPrototypeState {
  const rootScopeId = project.rootScopeId ?? `scope-${project.id}-root`
  const workspaceId = `workspace-${project.id}-main`
  return {
    version: 9,
    projectId: project.id,
    nodes: [],
    edges: [],
    scopes: [{ id: rootScopeId, label: '项目主画布', kind: 'root', parentScopeId: null, camera: { x: 160, y: 90, zoom: 1 }, layoutMode: 'manual', updatedAt: now }],
    workspaces: [{ id: workspaceId, label: '项目现场', intent: null, scopeId: rootScopeId, camera: { x: 160, y: 90, zoom: 1 }, visibleLayers: ['core', 'process'], focusedNodeIds: [], contextPolicy: 'workspace-related', createdAt: now, updatedAt: now }],
    activeWorkspaceId: workspaceId,
    activeScopeId: rootScopeId,
    workRail: { pinned: true, collapsed: false, width: railWidth },
  }
}

function huaxinState(railWidth: number): PersistedPrototypeState {
  const root = 'scope-huaxin-root'
  const delivery = 'scope-huaxin-delivery'
  const nodes: CanvasNode[] = [
    { id: 'hx-brief', artifactId: 'hx-artifact-brief', kind: 'source', title: '华新出海 VI Brief.pptx', subtitle: '飞书快照 · 18 页', x: 52, y: 124, width: 264, height: 190, displayMode: 'standard', scopeId: root, editable: false, contextOnly: true },
    { id: 'hx-feedback', artifactId: 'hx-artifact-feedback', kind: 'source', title: '价值观海报反馈.md', subtitle: '红色元素 · 美好生活场景', x: 56, y: 402, width: 264, height: 190, displayMode: 'standard', scopeId: root, editable: false, contextOnly: true },
    { id: 'hx-working', artifactId: 'hx-artifact-poster', revisionId: 'hx-poster-v2', followsCurrentRevision: true, kind: 'working', title: 'Value_Poster_Direction_V2.pptx', subtitle: '当前版本 · 8 页', x: 430, y: 274, width: 320, height: 246, displayMode: 'expanded', scopeId: root, editable: true, current: true, pageCount: 8 },
    { id: 'hx-reference', artifactId: 'hx-artifact-reference', kind: 'context', title: 'Nigeria 与生活场景参考', subtitle: '6 张图片 · 2 条设计判断', x: 392, y: 72, width: 250, height: 146, displayMode: 'standard', scopeId: root, opensScopeId: delivery, contextOnly: true },
    { id: 'hx-generated', artifactId: 'hx-artifact-poster', revisionId: 'hx-poster-v3-draft', kind: 'generated', title: 'Value_Poster_Direction_V3_AI.pptx', subtitle: '待确认 · 红色视觉加强', x: 858, y: 276, width: 264, height: 190, displayMode: 'standard', scopeId: root, editable: true, draft: true, revisionOf: 'hx-poster-v2' },
    { id: 'hx-decision', kind: 'decision', title: '价值观表达已锁定', subtitle: '美好世界从我们开始', x: 854, y: 520, width: 270, height: 118, displayMode: 'standard', scopeId: root, positionLocked: true },
    { id: 'hx-run', kind: 'process', title: 'RUN-018 · 扩展系列海报', subtitle: '已完成 · 3 个方向', x: 470, y: 586, width: 220, height: 72, displayMode: 'compact', scopeId: root, runStatus: 'completed' },
    { id: 'hx-ref-1', artifactId: 'hx-ref-nigeria', kind: 'source', title: 'Nigeria Campaign.jpg', subtitle: '红色视觉参考', x: 90, y: 140, width: 264, height: 190, displayMode: 'standard', scopeId: delivery, contextOnly: true },
    { id: 'hx-ref-2', artifactId: 'hx-ref-life', kind: 'source', title: 'Better Life Scenes.jpg', subtitle: '社区与家庭场景', x: 410, y: 140, width: 264, height: 190, displayMode: 'standard', scopeId: delivery, contextOnly: true },
    { id: 'hx-lock', kind: 'decision', title: '锁定元素', subtitle: '红色只做价值锚点 · 避免工程高楼', x: 270, y: 390, width: 320, height: 142, displayMode: 'expanded', scopeId: delivery, positionLocked: true },
  ]
  const edges: CanvasEdge[] = [
    { id: 'hx-e1', from: 'hx-brief', to: 'hx-working', kind: 'reference' },
    { id: 'hx-e2', from: 'hx-feedback', to: 'hx-working', kind: 'feedback' },
    { id: 'hx-e3', from: 'hx-reference', to: 'hx-working', kind: 'reference' },
    { id: 'hx-e4', from: 'hx-working', to: 'hx-run', kind: 'modify' },
    { id: 'hx-e5', from: 'hx-run', to: 'hx-generated', kind: 'generate' },
    { id: 'hx-e6', from: 'hx-generated', to: 'hx-decision', kind: 'reference' },
    { id: 'hx-e7', from: 'hx-ref-1', to: 'hx-lock', kind: 'reference' },
    { id: 'hx-e8', from: 'hx-ref-2', to: 'hx-lock', kind: 'reference' },
  ]
  const scopes: CanvasScope[] = [
    { id: root, label: '项目主画布', kind: 'root', parentScopeId: null, camera: { x: 94, y: 44, zoom: .94 }, layoutMode: 'manual', updatedAt: now },
    { id: delivery, label: 'Nigeria 与生活场景参考', kind: 'context', parentScopeId: root, containerNodeId: 'hx-reference', camera: { x: 210, y: 110, zoom: 1 }, layoutMode: 'semantic', updatedAt: now },
  ]
  const workspaces: Workspace[] = [
    { id: 'hx-understand', label: '客户反馈与价值观', intent: 'understand', scopeId: root, camera: { x: 174, y: 54, zoom: 1.02 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['hx-brief', 'hx-feedback', 'hx-working'], contextPolicy: 'workspace-related', createdAt: now, updatedAt: now },
    { id: 'hx-explore', label: '系列海报方向', intent: 'explore', scopeId: root, camera: { x: 48, y: 42, zoom: .95 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['hx-reference', 'hx-working', 'hx-generated'], contextPolicy: 'workspace-related', createdAt: now, updatedAt: now },
    { id: 'hx-decide', label: '手册交付确认', intent: 'decide', scopeId: root, camera: { x: -90, y: -20, zoom: 1 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['hx-generated', 'hx-decision'], contextPolicy: 'workspace-related', createdAt: now, updatedAt: now },
  ]
  return { version: 9, projectId: 'project-huaxin', nodes, edges, scopes, workspaces, activeWorkspaceId: workspaces[0].id, activeScopeId: root, workRail: { pinned: true, collapsed: false, width: railWidth } }
}

export function defaultProjectCatalog(): ProjectPackage[] {
  return clone(fixtureProjects)
}

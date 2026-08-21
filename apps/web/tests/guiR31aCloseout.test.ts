import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const projection = source('features/surfaces/ProjectionSurfaces.tsx')
const workflowGraph = source('features/surfaces/WorkflowGraphSurface.tsx')
const contextGraph = source('features/surfaces/ContextRelationshipHomeSurface.tsx')
const entityProjection = source('features/entities/projectEntityProjection.ts')
const semanticDrop = source('features/spatial/semanticDrop.ts')
const scopeCreate = source('features/create/ScopeCreateDialog.tsx')
const scopeState = source('state/canvasScopes.ts')
const membership = source('state/projectPresentationMembership.ts')
const runtimeBridge = source('runtime/runtimeBridge.ts')
const closeoutCss = source('r31a-closeout.css')
const contract = readFileSync(new URL('../../../packages/contracts/src/presentations.ts', import.meta.url), 'utf8')

const main = source('main.tsx')

describe('R3.1-A semantic foundation closeout', () => {
  it('keeps Main Canvas / Context / Workflow on one Project-node universe', () => {
    expect(app).toContain('const projectPresentationNodes')
    expect(app).toContain('nodes: projectPresentationNodes')
    expect(app).toContain('materializeProjectEntityNodes')
    expect(contract).toContain('Main Canvas / Context Graph / Workflow are parallel projections over Project Truth')
  })

  it('makes aggregate entities presentation members without fake member clones', () => {
    expect(contract).toContain('memberEntityRefs?: PresentationEntityRefV0[]')
    expect(membership).toContain('appendProjectPresentationEntityRefs')
    expect(membership).toContain('removeProjectPresentationEntityRefs')
    expect(entityProjection).toContain("id: `workspace:${workspace.id}`")
    expect(entityProjection).toContain("id: `scope:${scope.id}`")
    expect(entityProjection).toContain('semanticRefsForSourceIds')
  })

  it('treats Workspace / Current Scene as a saved working surface that can contain aggregate entities', () => {
    expect(app).toContain("ownerId: `workspace:${workspace.id}`")
    expect(app).toContain("renderer: 'workspace-scene'")
    expect(app).toContain('activeWorkspaceEntityNodes')
    expect(app).toContain('sceneCanvasNodes')
    expect(app).toContain('const semantic = semanticRefsForSourceIds(selectedIds, projectPresentationNodes)')
    expect(app).toContain("appendExactPresentationEntityRefs('custom', `workspace:${workspaceId}`")
    expect(app).toContain("removeExactPresentationEntityRefs('custom', `workspace:${workspaceId}`")
  })

  it('stops new Collection creation from cloning a child canvas', () => {
    expect(scopeState).toContain('createAggregateScopeEntity')
    expect(app).toContain('createAggregateScopeEntity({')
    expect(scopeCreate).toContain('节点集合')
    expect(scopeCreate).not.toContain('交付集合')
    expect(scopeCreate).not.toContain('创建子画布')
    expect(app).not.toContain('createChildScopeFromSelection(')
  })

  it('keeps Context strictly two-level and renders level 1 as an associative constellation', () => {
    expect(projection).toContain("props.surface==='context-graph'?<ContextRelationshipHomeSurface")
    expect(contextGraph).toContain('Obsidian-like associative constellation')
    expect(contextGraph).toContain('lcos-context-dot-core')
    expect(contextGraph).toContain('contextDimensions')
    expect(closeoutCss).toContain('.lcos-context-dot-core')
    expect(app).toContain("if (normalized === 'context-graph') { setActiveContextId(null)")
    expect(app).toContain('setActiveContextId(contextId)')
  })

  it('adds a first-level directional Workflow Graph before Workflow detail', () => {
    expect(projection).toContain("props.surface==='workflow'&&!props.activeWorkflowId?<WorkflowGraphSurface")
    expect(workflowGraph).toContain('project action network')
    expect(workflowGraph).toContain('markerEnd="url(#lcos-workflow-arrow)"')
    expect(workflowGraph).toContain('memberEntityNodeIds')
    expect(workflowGraph).toContain('data-project-view-drop-kind="workflow"')
    expect(app).toContain('setActiveWorkflowId(null)')
    expect(app).toContain('setActiveWorkflowId(workflowId)')
    expect(closeoutCss).toContain('.lcos-workflow-graph-workflow')
  })

  it('uses one right-button semantic Drop language in non-main project surfaces', () => {
    expect(semanticDrop).toContain('event.button === 2')
    expect(semanticDrop).toContain("closest<HTMLElement>('[data-project-view-drop-target]')")
    expect(projection).toContain('onDirectProjectViewDrop={props.onDirectProjectViewDrop}')
    expect(source('features/surfaces/WorkflowSurface.tsx')).toContain('onDirectProjectViewDrop?:')
    expect(contextGraph).toContain('beginSemanticDrop')
    expect(workflowGraph).toContain('beginSemanticDrop')
  })

  it('persists semantic relation endpoints as Scope/Workspace identities instead of relation-to-proxy artifacts', () => {
    expect(runtimeBridge).toContain("? { type: 'workspace' as const")
    expect(runtimeBridge).toContain("? { type: 'scope' as const")
    expect(runtimeBridge).toContain('aggregateScopeByNodeId')
  })

  it('loads the consolidated interaction layer after the existing product styles', () => {
    expect(main).toContain("import './interaction-system.css'")
    expect(main).not.toContain("import './r31a-closeout.css'")
  })
})

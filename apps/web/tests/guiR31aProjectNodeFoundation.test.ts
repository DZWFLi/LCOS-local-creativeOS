import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const model = source('model.ts')
const projections = source('features/surfaces/ProjectionSurfaces.tsx')
const dock = source('features/shell/SurfaceDock.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const contextHome = source('features/surfaces/ContextRelationshipHomeSurface.tsx')
const signal = source('features/surfaces/ContextFlowSurface.tsx')
const contextSpace = source('features/surfaces/ContextSpaceSurface.tsx')
const rail = source('features/shell/WorkspaceRailVNext.tsx')
const scopeState = source('state/canvasScopes.ts')
const contract = readFileSync(new URL('../../../packages/contracts/src/presentations.ts', import.meta.url), 'utf8')

describe('R3.1-A Project-node presentation foundation', () => {
  it('passes the project-wide node universe to Context and Workflow presentations', () => {
    const projectionBlock = app.match(/projection: \{[\s\S]*?workspaceFocusIds:/)?.[0] ?? ''
    expect(projectionBlock).toContain('nodes: projectPresentationNodes')
    expect(projectionBlock).toContain('edges,')
    expect(projectionBlock).not.toContain('nodes: visibleNodes')
    expect(projectionBlock).not.toContain('edges: visibleEdges')
    expect(projections).toContain('explicitViewIds:props.presentationIds')
    expect(projections).toContain('includeOneHop:false')
  })

  it('defines Presentation Scope as owner identity rather than member boundary', () => {
    expect(contract).toContain('it is NOT a membership boundary')
    expect(contract).toContain('may reference any')
    expect(contract).toContain("regardless of the View's physical Scope")
  })

  it('gives Context Graph its own project-level exact membership plus automatic project context population', () => {
    expect(app).toContain('contextGraphPresentationIds')
    expect(app).toContain("renderer: 'context-graph'")
    expect(app).toContain('contextGraphResolvedIds')
    expect(app).toContain('deriveContextGraphAutoNodeIds')
    expect(projections).toContain("props.surface==='context-graph'")
    expect(contextHome).toContain('projectNodes')
    expect(contextHome).toContain('onAddMembersToGraph')
  })

  it('keeps Context Graph as a project-level lens while Context capability opens the understanding worksite directly', () => {
    expect(dock).toContain("if(next === 'context') onSurface('context-space')")
    expect(dock).not.toContain('ProjectionPills')
    expect(app).toContain("setActiveSurface('context-space')")
    expect(app).toContain('setActiveContextId(contextId)')
    expect(contextSpace).toContain('ContextLensSwitch active="context-space"')
    expect(contextHome).toContain('onOpenContextView')
  })

  it('makes bottom Context / Workflow Drop use the same canonical worksite as click navigation', () => {
    expect(app).toContain("targetViewId === 'capability:context'")
    expect(app).toContain('const ownerId = activeContextId ?? rootScope.id')
    expect(app).toContain("appendExactPresentationMembers('context', ownerId")
    expect(app).toContain("targetViewId === 'capability:workflow'")
    expect(app).toContain('const ownerId = activeWorkflowId ?? rootScope.id')
    expect(app).toContain("appendExactPresentationMembers('workflow', ownerId")
    expect(app).toContain("targetViewId === 'generate:context'")
    expect(app).toContain('createContextFromMembersDirect(viewIds, undefined, entityRefs)')
    expect(app).toContain("targetViewId === 'generate:workflow'")
    expect(app).toContain('createWorkflowFromMembersDirect(viewIds, undefined, entityRefs)')
    expect(dock).toContain("'data-project-view-drop-target':`capability:${id}`")
    expect(dock).toContain("onProjectViewDrop?.(id as Extract<CapabilityId, 'context' | 'workflow'>, members)")
  })

  it('persists a real Workflow entity owner instead of requiring a pre-created Workflow page shell', () => {
    expect(model).toContain("'workflow'")
    expect(scopeState).toContain("input.kind === 'workflow' ? 'workflow'")
    expect(app).toContain("kind: 'workflow'")
    expect(app).toContain("entityKind: 'workflow'")
    expect(app).toContain("appendExactPresentationMembers('workflow', result.scope.id")
    expect(app).toContain('setActiveWorkflowId(result.scope.id)')
  })

  it('uses exact Context/Workflow Presentation membership without physical Context/Workflow member cloning', () => {
    expect(app).toContain("appendExactPresentationMembers('context'")
    expect(app).toContain("appendExactPresentationMembers('workflow'")
    expect(app).toContain("if (target.kind === 'context'")
    expect(app).not.toMatch(/target\.kind === 'context'[\s\S]{0,500}projectViewsIntoScope/)
    expect(app).toContain('does not create a physical child copy')
  })

  it('keeps Right-button drag as the canvas cross-space Drop gesture', () => {
    expect(canvas).toContain('if (semanticDropTriggerFromPointer(event))')
    expect(canvas).toContain('beginCanvasSemanticDrop(')
    expect(canvas).toContain('commitProjectViewTarget(hit.target.id, item.ids)') // R2D：统一提交分发器
    expect(contextHome).toContain('data-project-view-drop-target={viewId}')
    expect(contextHome).toContain('data-project-view-drop-kind="context"')
  })

  it('uses the same right-button semantic Drop gesture for Project Rail entities', () => {
    expect(rail).toContain('semanticDropTriggerFromPointer(event)')
    expect(rail).toContain('onDirectProjectViewDrop')
    expect(rail).toContain("closest<HTMLElement>('[data-project-view-drop-target]')")
    expect(rail).toContain('draggable={false}')
  })

  it('makes Signal Track cover every exact Context member even when old segment ids are stale', () => {
    expect(signal).toContain('ensureTrackSegmentsCoverMembers')
    expect(signal).toContain('props.nodes.map((node) => node.id)')
    expect(signal).toContain('onRemoveMember')
    expect(signal).toContain('fitSpatialBounds')
    expect(contextHome).toContain('fitSpatialBounds')
  })
})

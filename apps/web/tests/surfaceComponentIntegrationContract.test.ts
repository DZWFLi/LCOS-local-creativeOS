import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const dock = source('features/shell/SurfaceDock.tsx')
const projection = source('features/surfaces/ProjectionSurfaces.tsx')
const context = source('features/surfaces/ContextSpaceSurface.tsx')
const workflow = source('features/surfaces/WorkflowSurface.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const draft = source('state/presentationDraftState.ts')

 describe('v0.4 Surface Component integration contract', () => {
  it('renders Main Fence through the trusted registry while keeping legacy durable bounds as adapter state', () => {
    expect(canvas).toContain("resolveSurfaceComponent('fence')")
    expect(canvas).toContain("type: 'fence'")
    expect(canvas).toContain('onRegionBoundsCommit?.(region.id, next)')
    expect(canvas).toContain('onClearRegion?.(region.id)')
  })

  it('persists Context/Workflow SurfaceElements through the existing Presentation bridge', () => {
    expect(draft).toContain('usePresentationSurfaceElements')
    expect(draft).toContain('surfaceElements: value')
    expect(context).toContain("usePresentationSurfaceElements(props.projectId, props.scopeId, 'context-space')")
    expect(workflow).toContain("usePresentationSurfaceElements(props.projectId, props.scopeId, 'workflow')")
  })

  it('opens the three first-class worksites directly instead of forcing Graph homepages', () => {
    expect(dock).toContain("if(next === 'context') onSurface('context-space')")
    expect(projection).toContain("props.surface==='workflow'?<WorkflowSurface")
    expect(projection).not.toContain("!props.activeWorkflowId?<WorkflowGraphSurface")
  })

  it('keeps legacy Structure/Evolution/Relationship renderers as lenses rather than deleting compatibility code', () => {
    expect(projection).toContain("props.surface==='context-flow'")
    expect(projection).toContain("props.surface==='context-tree'")
    expect(projection).toContain("props.surface==='context-graph'?<ContextRelationshipHomeSurface")
  })
})

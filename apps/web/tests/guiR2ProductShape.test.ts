import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const dock=source('features/shell/SurfaceDock.tsx')
const rail=source('features/shell/WorkspaceRailVNext.tsx')
const projections=source('features/surfaces/ProjectionSurfaces.tsx')
const relationship=source('features/surfaces/ContextRelationshipHomeSurface.tsx')
const contextSpace=source('features/surfaces/ContextSpaceSurface.tsx')
const contextLens=source('features/surfaces/ContextLensSwitch.tsx')
const signal=source('features/surfaces/ContextFlowSurface.tsx')
const mind=source('features/surfaces/ContextTreeSurface.tsx')
const workflow=source('features/surfaces/WorkflowSurface.tsx')
const spatial=source('features/spatial/SpatialCanvas.tsx')

describe('GUI R2 product-shape regression',()=>{
  it('keeps Collection, Context Version and Workflow as flat, visually distinct rail peers',()=>{
    expect(rail).toContain("ProjectRailViewKind = 'scene' | 'collection' | 'context' | 'workflow'")
    expect(rail).toContain('CollectionPreview')
    expect(rail).toContain('ContextPreview')
    expect(rail).toContain('WorkflowPreview')
    expect(rail).toContain('data-rail-kind={view.kind}')
    expect(rail).toContain("application/x-lcos-project-view")
  })

  it('opens Context directly into the understanding worksite while keeping Graph as an optional legacy lens',()=>{
    expect(dock).toContain("if(next === 'context') onSurface('context-space')")
    expect(dock).not.toContain('ProjectionPills')
    expect(projections).toContain('ContextSpaceSurface')
    expect(projections).toContain("props.surface==='context-space'")
    expect(contextSpace).toContain('理解现场')
    expect(contextLens).toContain("label: '结构'")
    expect(contextLens).toContain("label: '演进'")
    expect(relationship).toContain('ContextRelationshipHomeSurface')
  })

  it('renders Context as one vertical Signal Track rather than old parallel Strand bands',()=>{
    expect(signal).toContain('lcos-signal-spine')
    expect(signal).toContain('材料会沿理解顺序展开')
    expect(signal).toContain('lcos-signal-wave')
    expect(signal).toContain('lcos-signal-insert-gap')
    expect(signal).toContain('application/x-lcos-project-view')
    expect(signal).not.toContain('Context Strands')
    expect(signal).not.toContain('lcos-context-strand-band')
  })

  it('keeps Mind Map as the same hierarchy editor without depending on Outline',()=>{
    expect(mind).toContain('moveHierarchySubtreeAfter')
    expect(mind).toMatch(/before|inside|after/i)
    expect(mind).not.toContain('与大纲无损同构')
  })

  it('accepts Huabu-style casual URI/text drag payloads through the shared spatial drop shell',()=>{
    expect(spatial).toContain("text/uri-list")
    expect(spatial).toContain("text/plain")
    expect(spatial).toContain("onExternalDrop(uri ? 'uri' : 'text'")
  })

  it('makes Workflow an action scene where Step owns ports and Project materials stay attachments',()=>{
    expect(workflow).toContain('Workflow is an action scene, not a second material graph')
    expect(workflow).toContain('data-workflow-action-input={action.id}')
    expect(workflow).toContain('lcos-workflow-action-attachments')
    expect(workflow).toContain('data-workflow-material-id={node.id}')
    expect(workflow).not.toContain('data-workflow-input={node.id}')
    expect(workflow).toContain('lcos-workflow-edge-inspector')
    expect(workflow).toContain('updateSelectedEdgeLabel')
    expect(workflow).not.toContain('lcos-workflow-operator-palette')
    expect(workflow).not.toContain('application/x-lcos-workflow-operator')
    expect(workflow).not.toContain('workflowPageTargetAt')
  })
})

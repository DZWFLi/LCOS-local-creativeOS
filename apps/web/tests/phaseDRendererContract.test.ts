import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const dock=source('features/shell/SurfaceDock.tsx')
const projection=source('features/surfaces/ProjectionSurfaces.tsx')
const outline=source('features/surfaces/OutlineSurface.tsx')
const mind=source('features/surfaces/ContextTreeSurface.tsx')
const graph=source('features/surfaces/ContextGraphSurface.tsx')
const flow=source('features/surfaces/ContextFlowSurface.tsx')
const workflow=source('features/surfaces/WorkflowSurface.tsx')
const surfaceObject=source('features/surfaces/SurfaceObject.tsx')
const hierarchyState=source('state/presentationHierarchyState.ts')

describe('Phase D renderer isomorphism contract',()=>{
  it('moves Outline into the Context renderer family and resolves the same membership',()=>{
    expect(dock).toContain("{id:'outline',label:'大纲'}")
    expect(dock).toContain("normalized === 'outline' || normalized === 'context-flow'")
    expect(projection).toContain("const isContext=props.surface==='outline'||props.surface==='context-flow'")
  })

  it('shares one hierarchy repository between Outline and Mind Map',()=>{
    expect(outline).toContain("'context-hierarchy'")
    expect(mind).toContain("'context-hierarchy'")
    expect(hierarchyState).toContain('does not use localStorage')
    expect(hierarchyState).not.toContain('window.localStorage')
  })

  it('keeps Relation Graph relation-native and manual-anchor capable',()=>{
    expect(graph).toContain('buildLocalRelationNodes')
    expect(graph).toContain('usePresentationDraftPinnedIds')
    expect(graph).toContain("hops: 1")
    expect(graph).not.toContain('outgoingMap')
  })

  it('renders Context Flow as multiple relation-derived strands',()=>{
    expect(flow).toContain('layoutContextStrands')
    expect(flow).toContain('lcos-context-strand-band')
    expect(flow).toContain('context-flow-edge-cuts')
    expect(flow).toContain('context-flow-temp-edges')
    expect(flow).toContain('spliceSelection')
    expect(flow).toContain('cutSelectedEdge')
    expect(flow).not.toContain('layoutContextTrail')
  })


  it('keeps rich hover as overlay and double-click as detail entry',()=>{
    expect(surfaceObject).toContain('lcos-glyph-hover-card')
    expect(surfaceObject).toContain('onDoubleClick={() => onDoubleClick(node.id)}')
    expect(mind).toContain('lcos-mind-hover-card')
    expect(mind).toContain('onDoubleClick={() => props.onDoubleClick(item.node.id)}')
  })

  it('keeps Workflow manual-first with explicit arranged preview',()=>{
    expect(workflow).toContain('layoutManualSpatial')
    expect(workflow).toContain("strategy:'layered'")
    expect(workflow).toContain('lcos-layout-ghost-workflow')
  })
})

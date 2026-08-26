import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const dock=source('features/shell/SurfaceDock.tsx')
const projection=source('features/surfaces/ProjectionSurfaces.tsx')
const outline=source('features/surfaces/OutlineSurface.tsx')
const mind=source('features/surfaces/ContextTreeSurface.tsx')
const flow=source('features/surfaces/ContextFlowSurface.tsx')
const contextSpace=source('features/surfaces/ContextSpaceSurface.tsx')
const contextLens=source('features/surfaces/ContextLensSwitch.tsx')
const workflow=source('features/surfaces/WorkflowSurface.tsx')
const surfaceObject=source('features/surfaces/SurfaceObject.tsx')
const hierarchyState=source('state/presentationHierarchyState.ts')

describe('Phase D renderer isomorphism contract',()=>{
  it('retires Outline from the dock and opens Context directly into the understanding worksite with optional lenses',()=>{
    expect(dock).not.toContain("{id:'outline',label:'大纲'}")
    expect(dock).toContain("if(next === 'context') onSurface('context-space')")
    expect(dock).not.toContain('ProjectionPills')
    expect(projection).toContain('ContextRelationshipHomeSurface')
    expect(projection).toContain("props.surface==='context-space'?<ContextSpaceSurface")
    expect(contextSpace).toContain('理解现场')
    expect(contextLens).toContain("id: 'context-tree'")
    expect(contextLens).toContain("id: 'context-flow'")
  })

  it('shares one hierarchy repository between Outline and Mind Map',()=>{
    expect(outline).toContain("'context-hierarchy'")
    expect(mind).toContain("'context-hierarchy'")
    expect(hierarchyState).toContain('does not use localStorage')
    expect(hierarchyState).not.toContain('window.localStorage')
  })

  it('deletes the old ContextGraphSurface page entirely; relation logic lives on in the relationship home (RC-8 2R closeout)',()=>{
    // 2R 收口：旧平行入口整页删除（RC-8），关系模型函数由 ContextRelationshipHomeSurface 继续使用。
    expect(()=>source('features/surfaces/ContextGraphSurface.tsx')).toThrow()
    expect(source('features/presentation/relationGraphModel.ts')).toContain('buildLocalRelationNodes')
    expect(dock).not.toContain("label:'关系'")
    expect(dock).toContain("if (surface === 'outline') return 'context-tree'")
    expect(projection).not.toContain('<ContextGraphSurface')
  })

  it('renders Context Signal Track as a vertical spine with insertion gaps',()=>{
    expect(flow).toContain('lcos-context-signal')
    expect(flow).toContain('lcos-signal-spine')
    expect(flow).toContain('lcos-signal-insert-gap')
    expect(flow).toContain('insertTrackSegment')
    expect(flow).toContain('trackSegmentDensity(segment)')
    // 旧 horizontal Strand 渲染带已退役；layoutContextStrands 仅作迁移种子保留。
    expect(flow).not.toContain('lcos-context-strand-band')
  })


  it('keeps inline signal states and double-click as detail entry',()=>{
    expect(surfaceObject).not.toContain('lcos-glyph-hover-card')
    expect(surfaceObject).toContain('data-surface-role={role}')
    expect(surfaceObject).toContain('SurfaceIdentityGlyph')
    expect(surfaceObject).toContain("<GlythAvatar state={selected && signal.glyph === 'stable' ? 'absorb' : signal.glyph}")
    expect(surfaceObject).toContain('onDoubleClick={() => onDoubleClick(node.id)}')
    expect(mind).toContain('lcos-mind-hover-card')
    expect(mind).toContain('onDoubleClick={() => props.onDoubleClick(item.node.id)}')
  })

  it('keeps Workflow manual-first with explicit arranged preview',()=>{
    expect(workflow).toContain('layoutManualSpatial')
    expect(workflow).toContain('strategy: chooseLayoutStrategy(layoutInput)')
    expect(workflow).toContain('lcos-layout-ghost-workflow')
  })
})

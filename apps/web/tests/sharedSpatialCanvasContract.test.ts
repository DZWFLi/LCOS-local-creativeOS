import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const arrange=source('features/canvas/ProjectCanvas.tsx')
const spatial=source('features/spatial/SpatialCanvas.tsx')
const viewport=source('features/spatial/SpatialViewport.tsx')
const flow=source('features/surfaces/ContextFlowSurface.tsx')
const tree=source('features/surfaces/ContextTreeSurface.tsx')
const workflow=source('features/surfaces/WorkflowSurface.tsx')
const outline=source('features/surfaces/OutlineSurface.tsx')

describe('Phase B shared spatial canvas contract',()=>{
  it('moves camera, transform and screen overlay ownership into the shared substrate',()=>{
    expect(spatial).toContain('applySpatialWheelGesture')
    expect(spatial).toContain('beginSpatialPan')
    expect(spatial).toContain('<SpatialViewport')
    expect(spatial).toContain('<SpatialOverlayLayer>')
    expect(viewport).toContain('spatialCameraTransform(camera)')
    expect(arrange).not.toContain('wheelZoom = useRef')
    expect(arrange).not.toContain('wheelPan = useRef')
  })

  it('renders Arrange through shared node/edge layers without moving domain state into them',()=>{
    expect(arrange).toContain('<SpatialCanvas')
    expect(arrange).toContain('<SpatialNodeLayer')
    expect(arrange).toContain('<SpatialEdgeLayer')
    expect(spatial).not.toContain('CanvasNode')
    // 域类型隔离：substrate 不 import 画布域（CanvasEdgePinLayer 是 spatial 本地导航组件，非域 CanvasEdge，名字撞前缀属正常）
    expect(spatial).not.toContain("from '../canvas/'") // 域类型隔离：substrate 不 import 画布域（CanvasEdgePinLayer 为 spatial 本地导航组件，非域 CanvasEdge）
  })

  it('uses the same spatial substrate for every spatial Context renderer and Workflow',()=>{
    for(const renderer of [flow,tree,workflow]){ // ContextGraphSurface 已删除（RC-8）：关系场由 RelationshipHome 组件承载
      expect(renderer).toContain('<SpatialCanvas')
      expect(renderer).toContain('<SpatialNodeLayer')
    }
    expect(flow).toContain('<SpatialEdgeLayer')
    expect(tree).toContain('<SpatialEdgeLayer')
    expect(workflow).toContain('<SpatialEdgeLayer')
  })

  it('does not force the document Outline renderer into a 2D camera model',()=>{
    expect(outline).not.toContain('<SpatialCanvas')
  })

  it('keeps temporary Presentation geometry memory-only until the Local Core contract is approved',()=>{
    const draft=source('state/presentationDraftState.ts')
    const session=source('state/spatialSessionState.ts')
    expect(draft).toContain('const positionMemory = new Map')
    expect(draft).toContain('usePresentationDraftHiddenIds')
    expect(draft).toContain('usePresentationDraftEdges')
    expect(draft).not.toContain('localStorage.')
    expect(session).toContain('const memory = new Map')
    expect(session).not.toContain('localStorage.')
  })
})

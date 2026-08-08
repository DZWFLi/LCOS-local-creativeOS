import { CheckCircle2, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import type { CanvasScope } from '../../model'
import { ArrangeGlyph, BenchGlyph, ContextGlyph, DeliverGlyph, RootGlyph, WorkGlyph } from '../design/LcosGlyphs'

export type SurfaceId = 'arrange' | 'outline' | 'context-flow' | 'context-tree' | 'context-graph' | 'work' | 'deliver'
export type LensId = 'arrange' | 'context' | 'work' | 'deliver'

interface Props {
  surface: SurfaceId
  scopePath: CanvasScope[]
  activeScopeId: string
  workbenchScopeId?: string | null
  onSurface: (surface: SurfaceId) => void
  onScope: (scopeId: string) => void
  onWorkbench?: () => void
  onMergeWorkbench?: () => void
  zoom?: number
  onZoomBy?: (factor: number) => void
  onZoomReset?: () => void
}

const lensForSurface = (surface: SurfaceId): LensId =>
  surface === 'outline' || surface === 'arrange'
    ? 'arrange'
    : surface === 'context-flow' || surface === 'context-tree' || surface === 'context-graph'
      ? 'context'
      : surface
const LENSES: Array<{ id: LensId; label: string; Glyph: typeof ArrangeGlyph }> = [
  { id:'arrange', label:'整理', Glyph:ArrangeGlyph },
  { id:'context', label:'上下文', Glyph:ContextGlyph },
  { id:'work', label:'运行', Glyph:WorkGlyph },
  { id:'deliver', label:'交付', Glyph:DeliverGlyph },
]

export function SurfaceDock({ surface, scopePath, activeScopeId, workbenchScopeId, onSurface, onScope, onWorkbench, onMergeWorkbench, zoom, onZoomBy, onZoomReset }: Props) {
  const lens = lensForSurface(surface)
  const currentScope = scopePath.at(-1)
  const parent = scopePath.length > 1 ? scopePath.at(-2) : null
  const setLens = (next: LensId) => { if(next==='arrange')onSurface('arrange'); if(next==='context')onSurface('context-flow'); if(next==='work')onSurface('work'); if(next==='deliver')onSurface('deliver') }
  return <nav className="vnext-bottom-dock lcos-bottom-dock" data-testid="vnext-bottom-dock" aria-label="Scope 与工作视图">
    <div className="vnext-scope-axis lcos-scope-axis" aria-label="Scope">
      <button type="button" className={scopePath.length===1?'active':''} data-label="主画布" aria-label="主画布" onClick={() => scopePath[0] && onScope(scopePath[0].id)}><RootGlyph/></button>
      {onWorkbench && <button type="button" className={workbenchScopeId===activeScopeId?'active':''} data-label="当前现场" aria-label="当前现场" onClick={onWorkbench}><BenchGlyph/></button>}
      {parent && <button type="button" data-label={`返回 ${parent.label}`} aria-label={`返回 ${parent.label}`} onClick={()=>onScope(parent.id)}><ChevronUp size={14}/></button>}
      {currentScope && scopePath.length>1 && <button type="button" className="lcos-scope-breadcrumb" title={currentScope.label} onClick={()=>onScope(currentScope.id)}><span>{currentScope.label}</span></button>}
      {onMergeWorkbench && workbenchScopeId===activeScopeId && <button type="button" className="vnext-merge-workbench lcos-merge-workbench" data-label="并回" aria-label="并回主画布并清空现场" onClick={onMergeWorkbench}><CheckCircle2 size={14}/></button>}
    </div>
    <span className="lcos-dock-divider"/>
    <div className="vnext-lens-axis lcos-lens-axis" aria-label="观察方式">
      {LENSES.map(({id,label,Glyph})=><button key={id} type="button" className={lens===id?'active':''} data-label={label} aria-label={label} onClick={()=>setLens(id)}><Glyph/></button>)}
      {lens==='arrange' && <div className="vnext-projection-switch lcos-projection-switch"><button className={surface==='arrange'?'active':''} onClick={()=>onSurface('arrange')}>自由</button><button className={surface==='outline'?'active':''} onClick={()=>onSurface('outline')}>大纲</button></div>}
      {lens==='context' && <div className="vnext-projection-switch lcos-projection-switch"><button className={surface==='context-flow'?'active':''} onClick={()=>onSurface('context-flow')}>流</button><button className={surface==='context-tree'?'active':''} onClick={()=>onSurface('context-tree')}>树</button><button className={surface==='context-graph'?'active':''} onClick={()=>onSurface('context-graph')}>图</button></div>}
    </div>
    {onZoomBy && onZoomReset && <div className="lcos-zoom-controls" aria-label="画布缩放">
      <button type="button" aria-label="缩小" title="缩小画布" onClick={() => onZoomBy(1 / 1.25)}><ZoomOut size={15}/></button>
      <button type="button" className="lcos-zoom-value" aria-label="重置缩放" title="重置为 100%" onClick={onZoomReset}>{Math.round((zoom ?? 1) * 100)}%</button>
      <button type="button" aria-label="放大" title="放大画布" onClick={() => onZoomBy(1.25)}><ZoomIn size={15}/></button>
    </div>}
  </nav>
}

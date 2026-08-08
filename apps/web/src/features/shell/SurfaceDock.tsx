import { CheckCircle2, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import type { CSSProperties } from 'react'
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
  workbenchCount?: number
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

function ProjectionPills({ options, active, onSelect }: {
  options: Array<{ id: string; label: string }>
  active: string
  onSelect: (id: string) => void
}) {
  const index = Math.max(0, options.findIndex((option) => option.id === active))
  return <div className="vnext-projection-switch lcos-projection-switch" style={{ '--n': options.length, '--pi': index } as CSSProperties}>
    <span className="lcos-projection-pill" aria-hidden="true" />
    {options.map((option) => <button key={option.id} type="button" className={option.id === active ? 'active' : ''} onClick={() => onSelect(option.id)}>{option.label}</button>)}
  </div>
}

export function SurfaceDock({ surface, scopePath, activeScopeId, workbenchScopeId, onSurface, onScope, onWorkbench, onMergeWorkbench, workbenchCount, zoom, onZoomBy, onZoomReset }: Props) {
  const lens = lensForSurface(surface)
  const currentScope = scopePath.at(-1)
  const parent = scopePath.length > 1 ? scopePath.at(-2) : null
  const setLens = (next: LensId) => { if(next==='arrange')onSurface('arrange'); if(next==='context')onSurface('context-flow'); if(next==='work')onSurface('work'); if(next==='deliver')onSurface('deliver') }
  return <nav className="vnext-bottom-dock lcos-bottom-dock" data-testid="vnext-bottom-dock" aria-label="Scope 与工作视图">
    <div className="vnext-scope-axis lcos-scope-axis" aria-label="Scope">
      <button type="button" className={scopePath.length===1?'active':''} data-label="主画布" aria-label="主画布" onClick={() => scopePath[0] && onScope(scopePath[0].id)}><RootGlyph/></button>
      {onWorkbench && <>
        <ChevronRight className="lcos-scope-chevron" size={13} aria-hidden="true" />
        <button type="button" className={`${workbenchScopeId===activeScopeId?'active':''} lcos-workbench-entry`} data-label="当前现场" aria-label="当前现场" onClick={onWorkbench}><BenchGlyph/>{workbenchCount !== undefined && workbenchCount > 0 && <span className="lcos-workbench-badge">{workbenchCount}</span>}</button>
      </>}
      {parent && <button type="button" data-label={`返回 ${parent.label}`} aria-label={`返回 ${parent.label}`} onClick={()=>onScope(parent.id)}><ChevronUp size={14}/></button>}
      {currentScope && scopePath.length>1 && <button type="button" className="lcos-scope-breadcrumb" title={currentScope.label} onClick={()=>onScope(currentScope.id)}><span>{currentScope.label}</span></button>}
      {onMergeWorkbench && workbenchScopeId===activeScopeId && <button type="button" className="vnext-merge-workbench lcos-merge-workbench" data-label="并回" aria-label="并回主画布并清空现场" onClick={onMergeWorkbench}><CheckCircle2 size={14}/></button>}
    </div>
    <span className="lcos-dock-divider"/>
    <div className="vnext-lens-axis lcos-lens-axis" aria-label="观察方式">
      {LENSES.map(({id,label,Glyph})=><button key={id} type="button" className={lens===id?'active':''} data-label={label} aria-label={label} onClick={()=>setLens(id)}><Glyph/></button>)}
      {lens==='arrange' && <ProjectionPills options={[{id:'arrange',label:'自由'},{id:'outline',label:'大纲'}]} active={surface==='outline'?'outline':'arrange'} onSelect={(id)=>onSurface(id as SurfaceId)}/>}
      {lens==='context' && <ProjectionPills options={[{id:'context-flow',label:'流'},{id:'context-tree',label:'树'},{id:'context-graph',label:'图'}]} active={surface==='context-tree'?'context-tree':surface==='context-graph'?'context-graph':'context-flow'} onSelect={(id)=>onSurface(id as SurfaceId)}/>}
    </div>
    {onZoomBy && onZoomReset && <div className="lcos-zoom-controls" aria-label="画布缩放">
      <button type="button" aria-label="缩小" title="缩小画布" onClick={() => onZoomBy(1 / 1.25)}><ZoomOut size={15}/></button>
      <button type="button" className="lcos-zoom-value" aria-label="重置缩放" title="重置为 100%" onClick={onZoomReset}>{Math.round((zoom ?? 1) * 100)}%</button>
      <button type="button" aria-label="放大" title="放大画布" onClick={() => onZoomBy(1.25)}><ZoomIn size={15}/></button>
    </div>}
  </nav>
}

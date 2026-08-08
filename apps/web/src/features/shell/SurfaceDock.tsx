import { CheckCircle2, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { CanvasScope } from '../../model'
import { ArrangeGlyph, BenchGlyph, ContextGlyph, RootGlyph, WorkflowGlyph } from '../design/LcosGlyphs'

/**
 * `SurfaceId` deliberately keeps the old work / deliver ids for persisted-project
 * compatibility. The user-facing dock no longer exposes them as product modes.
 * They are migrated to `workflow` when restored.
 */
export type SurfaceId =
  | 'arrange'
  | 'outline'
  | 'context-flow'
  | 'context-tree'
  | 'context-graph'
  | 'workflow'
  | 'work'
  | 'work-free'
  | 'deliver'
  | 'deliver-versions'
  | 'deliver-pack'

export type CapabilityId = 'arrange' | 'context' | 'workflow'

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

export const normalizeSurfaceId = (surface?: string | null): SurfaceId => {
  if (!surface) return 'arrange'
  if (surface === 'work' || surface === 'work-free' || surface === 'deliver' || surface === 'deliver-versions' || surface === 'deliver-pack') return 'workflow'
  if (surface === 'arrange' || surface === 'outline' || surface === 'context-flow' || surface === 'context-tree' || surface === 'context-graph' || surface === 'workflow') return surface
  return 'arrange'
}

const capabilityForSurface = (surface: SurfaceId): CapabilityId => {
  const normalized = normalizeSurfaceId(surface)
  if (normalized === 'arrange' || normalized === 'outline') return 'arrange'
  if (normalized === 'context-flow' || normalized === 'context-tree' || normalized === 'context-graph') return 'context'
  return 'workflow'
}

const CAPABILITIES: Array<{ id: CapabilityId; label: string; hint: string; Glyph: typeof ArrangeGlyph }> = [
  { id:'arrange', label:'整理', hint:'项目空间与内容', Glyph:ArrangeGlyph },
  { id:'context', label:'上下文', hint:'对话与上下文视图', Glyph:ContextGlyph },
  { id:'workflow', label:'工作流', hint:'Skill 与 Agent 协作', Glyph:WorkflowGlyph },
]

function ProjectionPills({ options, active, onSelect }: {
  options: Array<{ id: string; label: string }>
  active: string
  onSelect: (id: string) => void
}) {
  const index = Math.max(0, options.findIndex((option) => option.id === active))
  return <div className="vnext-projection-switch lcos-projection-switch" style={{ '--n': options.length, '--pi': index } as CSSProperties} aria-label="视图方式">
    <span className="lcos-projection-pill" aria-hidden="true" />
    {options.map((option) => <button key={option.id} type="button" className={option.id === active ? 'active' : ''} onClick={() => onSelect(option.id)}>{option.label}</button>)}
  </div>
}

export function SurfaceDock({ surface, scopePath, activeScopeId, workbenchScopeId, onSurface, onScope, onWorkbench, onMergeWorkbench, workbenchCount, zoom, onZoomBy, onZoomReset }: Props) {
  const normalizedSurface = normalizeSurfaceId(surface)
  const capability = capabilityForSurface(normalizedSurface)
  const currentScope = scopePath.at(-1)
  const parent = scopePath.length > 1 ? scopePath.at(-2) : null
  const setCapability = (next: CapabilityId) => {
    // Capability buttons are capability presets, not workflow gates. Preserve a
    // compatible sub-projection when possible instead of forcing a fixed route.
    if(next === 'arrange') onSurface(capability === 'arrange' ? normalizedSurface : 'arrange')
    if(next === 'context') onSurface(capability === 'context' ? normalizedSurface : 'context-flow')
    if(next === 'workflow') onSurface('workflow')
  }
  return <nav className="vnext-bottom-dock lcos-bottom-dock" data-testid="vnext-bottom-dock" aria-label="Scope 与能力入口">
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
    <div className="vnext-lens-axis lcos-lens-axis" aria-label="LCOS 能力">
      {CAPABILITIES.map(({id,label,hint,Glyph})=><button key={id} type="button" className={capability===id?'active':''} data-label={label} aria-label={`${label}：${hint}`} title={hint} onClick={()=>setCapability(id)}><Glyph/></button>)}
      {capability==='arrange' && <ProjectionPills options={[{id:'arrange',label:'自由'},{id:'outline',label:'大纲'}]} active={normalizedSurface==='outline'?'outline':'arrange'} onSelect={(id)=>onSurface(id as SurfaceId)}/>} 
      {capability==='context' && <ProjectionPills options={[{id:'context-flow',label:'自由'},{id:'context-tree',label:'大纲'},{id:'context-graph',label:'关系'}]} active={normalizedSurface==='context-tree'?'context-tree':normalizedSurface==='context-graph'?'context-graph':'context-flow'} onSelect={(id)=>onSurface(id as SurfaceId)}/>} 
      {capability==='workflow' && <span className="lcos-capability-hint" aria-hidden="true">自由搭建</span>}
    </div>
    {onZoomBy && onZoomReset && <div className="lcos-zoom-controls" aria-label="画布缩放">
      <button type="button" aria-label="缩小" title="缩小画布" onClick={() => onZoomBy(1 / 1.25)}><ZoomOut size={15}/></button>
      <button type="button" className="lcos-zoom-value" aria-label="重置缩放" title="重置为 100%" onClick={onZoomReset}>{Math.round((zoom ?? 1) * 100)}%</button>
      <button type="button" aria-label="放大" title="放大画布" onClick={() => onZoomBy(1.25)}><ZoomIn size={15}/></button>
    </div>}
  </nav>
}

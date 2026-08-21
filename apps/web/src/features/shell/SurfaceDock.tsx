import { CheckCircle2, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import type { CanvasScope } from '../../model'
import { BenchGlyph, ContextGlyph, RootGlyph, WorkflowGlyph } from '../design/LcosGlyphs'

/**
 * `SurfaceId` deliberately keeps the old work / deliver ids for persisted-project
 * compatibility. The user-facing dock no longer exposes them as product modes.
 * They are migrated to `workflow` when restored.
 */
export type SurfaceId =
  | 'arrange'
  | 'outline'
  | 'context-space'
  | 'context-flow'
  | 'context-tree'
  | 'context-graph'
  | 'workflow'
  | 'work'
  | 'work-free'
  | 'deliver'
  | 'deliver-versions'
  | 'deliver-pack'

export type CapabilityId = 'main' | 'context' | 'workflow'

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
  /** HTML5 rail/entity Drop into a capability. Pointer Semantic Drop uses the same App target ids. */
  onProjectViewDrop?: (capability: Extract<CapabilityId, 'context' | 'workflow'>, memberViewIds: readonly string[]) => void
}

export const normalizeSurfaceId = (surface?: string | null): SurfaceId => {
  if (!surface) return 'arrange'
  if (surface === 'work' || surface === 'work-free' || surface === 'deliver' || surface === 'deliver-versions' || surface === 'deliver-pack') return 'workflow'
  // Legacy persisted Outline opens as Structure. Concrete Contexts now open in
  // a default understanding space; Structure / Evolution are optional lenses.
  if (surface === 'outline') return 'context-tree'
  if (surface === 'arrange' || surface === 'context-space' || surface === 'context-flow' || surface === 'context-tree' || surface === 'context-graph' || surface === 'workflow') return surface
  return 'arrange'
}

const capabilityForSurface = (surface: SurfaceId): CapabilityId => {
  const normalized = normalizeSurfaceId(surface)
  if (normalized === 'outline' || normalized === 'context-space' || normalized === 'context-flow' || normalized === 'context-tree' || normalized === 'context-graph') return 'context'
  if (normalized === 'workflow') return 'workflow'
  return 'main'
}


function readProjectViewMembers(dataTransfer: DataTransfer): string[] {
  const raw = dataTransfer.getData('application/x-lcos-project-view')
  if (!raw) return []
  try {
    const payload = JSON.parse(raw) as { memberViewIds?: unknown }
    return Array.isArray(payload.memberViewIds)
      ? [...new Set(payload.memberViewIds.filter((item): item is string => typeof item === 'string' && item.length > 0))]
      : []
  } catch {
    return []
  }
}

const SURFACE_ENTRIES = [
  { id:'main' as const, label:'主画布', hint:'项目材料与空间', Icon: RootGlyph },
  { id:'context' as const, label:'上下文', hint:'共同理解现场', Icon: ContextGlyph },
  { id:'workflow' as const, label:'工作流', hint:'行动骨架', Icon: WorkflowGlyph },
]

export function SurfaceDock({ surface, scopePath, activeScopeId, workbenchScopeId, onSurface, onScope, onWorkbench, onMergeWorkbench, workbenchCount, zoom, onZoomBy, onZoomReset, onProjectViewDrop }: Props) {
  const [dropCapability, setDropCapability] = useState<Extract<CapabilityId, 'context' | 'workflow'> | null>(null)
  const normalizedSurface = normalizeSurfaceId(surface)
  const capability = capabilityForSurface(normalizedSurface)
  const currentScope = scopePath.at(-1)
  const parent = scopePath.length > 1 ? scopePath.at(-2) : null
  const setCapability = (next: CapabilityId) => {
    if(next === 'main') { scopePath[0] && onScope(scopePath[0].id); onSurface('arrange') }
    // Context button is always level 1: the project Context Graph. A concrete
    // Context is entered only by clicking that Context object in the Graph.
    if(next === 'context') onSurface('context-graph')
    if(next === 'workflow') onSurface('workflow')
  }
  return <nav className="vnext-bottom-dock lcos-bottom-dock" data-testid="vnext-bottom-dock" aria-label="LCOS 工作现场" onContextMenu={(event) => event.preventDefault()}>
    <div className="vnext-lens-axis lcos-lens-axis lcos-primary-surface-axis" aria-label="工作现场">
      {SURFACE_ENTRIES.map(({id,label,hint,Icon}) => {
        const semanticTarget = id === 'context' || id === 'workflow'
        return <button key={id} type="button" className={`${capability===id?'active':''} ${dropCapability===id?'is-direct-drop-target':''}`.trim()} aria-label={`${label}：${hint}`} title={semanticTarget ? `点击进入${label}；拖入对象直接用于${label}` : hint} onClick={()=>setCapability(id)}
          {...(semanticTarget ? {'data-project-view-drop-target':`capability:${id}`,'data-project-view-drop-label':`用于${label}`} : {})}
          onDragEnter={semanticTarget ? (event) => {
            if (!event.dataTransfer.types.includes('application/x-lcos-project-view')) return
            setDropCapability(id as Extract<CapabilityId, 'context' | 'workflow'>)
          } : undefined}
          onDragOver={semanticTarget ? (event) => {
            if (!event.dataTransfer.types.includes('application/x-lcos-project-view')) return
            event.preventDefault(); event.dataTransfer.dropEffect = 'copy'
            setDropCapability(id as Extract<CapabilityId, 'context' | 'workflow'>)
          } : undefined}
          onDragLeave={semanticTarget ? () => setDropCapability((current) => current === id ? null : current) : undefined}
          onDrop={semanticTarget ? (event) => {
            event.preventDefault(); event.stopPropagation(); setDropCapability(null)
            const members = readProjectViewMembers(event.dataTransfer)
            if (members.length) onProjectViewDrop?.(id as Extract<CapabilityId, 'context' | 'workflow'>, members)
          } : undefined}>
          <span className="lcos-dock-signal lcos-dock-object-icon" aria-hidden="true"><Icon/></span><span className="lcos-dock-label">{label}</span>
        </button>
      })}
    </div>
    {(onWorkbench || scopePath.length > 1) && <><span className="lcos-dock-divider"/><div className="vnext-scope-axis lcos-scope-axis" aria-label="当前现场">
      {onWorkbench && <button type="button" className={`${workbenchScopeId===activeScopeId?'active':''} lcos-workbench-entry`} aria-label="当前现场" onClick={onWorkbench}><BenchGlyph/><span className="lcos-dock-label">当前现场</span>{workbenchCount !== undefined && workbenchCount > 0 && <span className="lcos-workbench-badge">{workbenchCount}</span>}</button>}
      {parent && <button type="button" data-label={`返回 ${parent.label}`} aria-label={`返回 ${parent.label}`} onClick={()=>onScope(parent.id)}><ChevronUp size={14}/></button>}
      {currentScope && scopePath.length>1 && workbenchScopeId!==activeScopeId && <button type="button" className="lcos-scope-breadcrumb" title={currentScope.label} onClick={()=>onScope(currentScope.id)}><span>{currentScope.label}</span></button>}
      {onMergeWorkbench && workbenchScopeId===activeScopeId && <button type="button" className="vnext-merge-workbench lcos-merge-workbench" data-label="并回" aria-label="并回主画布并清空现场" onClick={onMergeWorkbench}><CheckCircle2 size={14}/></button>}
    </div></>}
    {onZoomBy && onZoomReset && <div className="lcos-zoom-controls" aria-label="画布缩放">
      <button type="button" aria-label="缩小" title="缩小画布" onClick={() => onZoomBy(1 / 1.25)}><ZoomOut size={15}/></button>
      <button type="button" className="lcos-zoom-value" aria-label="重置缩放" title="重置为 100%" onClick={onZoomReset}>{Math.round((zoom ?? 1) * 100)}%</button>
      <button type="button" aria-label="放大" title="放大画布" onClick={() => onZoomBy(1.25)}><ZoomIn size={15}/></button>
    </div>}
  </nav>
}

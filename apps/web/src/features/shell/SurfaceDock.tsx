import { Boxes, CheckCircle2, ChevronUp, GitBranch, Layers3, PackageCheck, Sparkles } from 'lucide-react'
import type { CanvasScope } from '../../model'

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
}

const lensForSurface = (surface: SurfaceId): LensId =>
  surface === 'outline' || surface === 'arrange'
    ? 'arrange'
    : surface === 'context-flow' || surface === 'context-tree' || surface === 'context-graph'
      ? 'context'
      : surface

export function SurfaceDock({ surface, scopePath, activeScopeId, workbenchScopeId, onSurface, onScope, onWorkbench, onMergeWorkbench }: Props) {
  const lens = lensForSurface(surface)
  const currentScope = scopePath.at(-1)
  const parent = scopePath.length > 1 ? scopePath.at(-2) : null
  const setLens = (next: LensId) => {
    if (next === 'arrange') onSurface('arrange')
    if (next === 'context') onSurface('context-flow')
    if (next === 'work') onSurface('work')
    if (next === 'deliver') onSurface('deliver')
  }
  return <nav className="vnext-bottom-dock" data-testid="vnext-bottom-dock" aria-label="Scope 与工作视图">
    <div className="vnext-scope-axis" aria-label="Scope">
      <button type="button" className={scopePath.length === 1 ? 'active' : ''} title={scopePath[0]?.label ?? '主画布'} onClick={() => scopePath[0] && onScope(scopePath[0].id)}><Boxes size={15} /></button>
      {onWorkbench && <button type="button" className={workbenchScopeId === activeScopeId ? 'active' : ''} title="当前现场" onClick={onWorkbench}><Sparkles size={15} /></button>}
      {onMergeWorkbench && workbenchScopeId === activeScopeId && <button type="button" className="vnext-merge-workbench" title="并回主画布并清空现场" onClick={onMergeWorkbench}><CheckCircle2 size={15} /></button>}
      {parent && <button type="button" title={`返回 ${parent.label}`} onClick={() => onScope(parent.id)}><ChevronUp size={15} /></button>}
      {currentScope && scopePath.length > 1 && <span className="vnext-scope-current">{currentScope.label}</span>}
    </div>
    <div className="vnext-lens-axis" aria-label="工作视图">
      <button type="button" className={lens === 'arrange' ? 'active' : ''} data-label="整理" aria-label="整理" onClick={() => setLens('arrange')}><Layers3 size={16} /></button>
      <button type="button" className={lens === 'context' ? 'active' : ''} data-label="上下文" aria-label="上下文" onClick={() => setLens('context')}><GitBranch size={16} /></button>
      <button type="button" className={lens === 'work' ? 'active' : ''} data-label="运行" aria-label="运行" onClick={() => setLens('work')}><Sparkles size={16} /></button>
      <button type="button" className={lens === 'deliver' ? 'active' : ''} data-label="交付" aria-label="交付" onClick={() => setLens('deliver')}><PackageCheck size={16} /></button>
      {lens === 'arrange' && <div className="vnext-projection-switch"><button className={surface === 'arrange' ? 'active' : ''} onClick={() => onSurface('arrange')}>自由</button><button className={surface === 'outline' ? 'active' : ''} onClick={() => onSurface('outline')}>大纲</button></div>}
      {lens === 'context' && <div className="vnext-projection-switch"><button className={surface === 'context-flow' ? 'active' : ''} onClick={() => onSurface('context-flow')}>流</button><button className={surface === 'context-tree' ? 'active' : ''} onClick={() => onSurface('context-tree')}>树</button><button className={surface === 'context-graph' ? 'active' : ''} onClick={() => onSurface('context-graph')}>图</button></div>}
    </div>
  </nav>
}

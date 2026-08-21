import type { SurfaceId } from '../shell/SurfaceDock'

export type ContextLensId = 'context-space' | 'context-tree' | 'context-flow'

const LENSES: readonly { id: ContextLensId; label: string; title: string }[] = [
  { id: 'context-space', label: '现场', title: '理解现场：一起阅读、摆放和组织当前 Context' },
  { id: 'context-tree', label: '结构', title: '结构：查看和编辑当前 Context 的层级' },
  { id: 'context-flow', label: '演进', title: '演进：查看当前 Context 的理解顺序与变化' },
]

export function ContextLensSwitch({ active, onSelect }: { active: ContextLensId; onSelect?: (surface: SurfaceId) => void }) {
  return <div className="lcos-context-lens-switch" aria-label="上下文视图">
    {LENSES.map((lens) => <button key={lens.id} type="button" className={active === lens.id ? 'active' : ''} title={lens.title} onClick={() => onSelect?.(lens.id)}>{lens.label}</button>)}
  </div>
}

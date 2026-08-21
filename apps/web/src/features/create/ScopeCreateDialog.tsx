import { useEffect, useRef, useState } from 'react'
import { FolderKanban, GitBranch, Layers3, X } from 'lucide-react'
import type { ScopeKind } from '../../model'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

interface Props {
  open: boolean
  selectedCount: number
  leftInset: number
  rightInset: number
  onCancel: () => void
  onCreate: (value: { label: string; kind: Exclude<ScopeKind, 'root'> }) => void
}

type CreateKind = 'collection' | 'context' | 'workflow'
const options: Array<{ value: CreateKind; label: string; description: string; icon: typeof Layers3 }> = [
  { value: 'collection', label: '节点集合', description: '把这组对象常态化收纳；仍留在当前画布，可原地展开/收起', icon: FolderKanban },
  { value: 'context', label: '上下文', description: '沉淀为可编辑 Context；进入理解现场后可切换结构 / 演进', icon: Layers3 },
  { value: 'workflow', label: '工作流', description: '把当前对象组织成独立 Workflow，并进入工作流画布', icon: GitBranch },
]

export function ScopeCreateDialog({ open, selectedCount, leftInset, rightInset, onCancel, onCreate }: Props) {
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<CreateKind>('collection')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setKind('collection')
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onCreate({ label: label.trim(), kind })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [kind, label, onCancel, onCreate, open])

  if (!open) return null

  return <div className="scope-create-layer" style={{ '--scope-left-inset': `${leftInset}px`, '--scope-right-inset': `${rightInset}px` } as React.CSSProperties} data-testid="scope-create-layer" onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}>
    <section className="scope-create-dialog" role="dialog" aria-modal="true" aria-labelledby="scope-create-title" onPointerDown={(event) => event.stopPropagation()}>
      <header><div><span>从选择创建</span><h2 id="scope-create-title">组织这 {selectedCount} 个对象</h2></div><button aria-label="关闭" onClick={onCancel}><X size={17} /></button></header>
      <div className="scope-create-body">
        <label className="scope-name-field"><span>名称（可选）</span><input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="留空自动命名" /></label>
        <div className="scope-kind-options">{options.map((option) => {
          const Icon = option.icon
          return <button key={option.value} className={kind === option.value ? 'active' : ''} onClick={() => setKind(option.value)}><Icon size={17} /><span><b>{option.label}</b><small>{option.description}</small></span></button>
        })}</div>
        <div className="scope-create-note">原对象保持原身份和原位置。创建只是增加一个新的组织/呈现关系，不复制、不搬迁，也不再创建 Collection 子画布。</div>
      </div>
      <footer><button className="secondary" onClick={onCancel}>取消</button><button className="primary" onClick={() => onCreate({ label: label.trim(), kind })}>立即创建</button></footer>
    </section>
  </div>
}

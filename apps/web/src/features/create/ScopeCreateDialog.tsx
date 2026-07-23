import { useEffect, useRef, useState } from 'react'
import { FolderKanban, Layers3, PackageCheck, X } from 'lucide-react'
import type { ScopeKind } from '../../model'

interface Props {
  open: boolean
  selectedCount: number
  leftInset: number
  rightInset: number
  onCancel: () => void
  onCreate: (value: { label: string; kind: Exclude<ScopeKind, 'root'> }) => void
}

const options: Array<{ value: Exclude<ScopeKind, 'root'>; label: string; description: string; icon: typeof Layers3 }> = [
  { value: 'collection', label: '内容集合', description: '把一组资料或方向放进独立子画布', icon: FolderKanban },
  { value: 'context', label: '参考与上下文', description: '整理参考图、反馈和锁定元素', icon: Layers3 },
  { value: 'delivery', label: '交付集合', description: '组织候选版本和最终交付内容', icon: PackageCheck },
]

export function ScopeCreateDialog({ open, selectedCount, leftInset, rightInset, onCancel, onCreate }: Props) {
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Exclude<ScopeKind, 'root'>>('collection')
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
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && label.trim()) onCreate({ label: label.trim(), kind })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [kind, label, onCancel, onCreate, open])

  if (!open) return null

  return <div className="scope-create-layer" style={{ '--scope-left-inset': `${leftInset}px`, '--scope-right-inset': `${rightInset}px` } as React.CSSProperties} data-testid="scope-create-layer" onPointerDown={(event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }} onPointerMove={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerUp={(event) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }}>
    <section className="scope-create-dialog" role="dialog" aria-modal="true" aria-labelledby="scope-create-title" onPointerDown={(event) => event.stopPropagation()}>
      <header><div><span>创建子画布</span><h2 id="scope-create-title">把 {selectedCount} 个对象整理成一个空间</h2></div><button aria-label="关闭" onClick={onCancel}><X size={17} /></button></header>
      <div className="scope-create-body">
        <label className="scope-name-field"><span>子画布名称</span><input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：第二轮客户反馈" /></label>
        <div className="scope-kind-options">{options.map((option) => {
          const Icon = option.icon
          return <button key={option.value} className={kind === option.value ? 'active' : ''} onClick={() => setKind(option.value)}><Icon size={17} /><span><b>{option.label}</b><small>{option.description}</small></span></button>
        })}</div>
        <div className="scope-create-note">原对象仍保留在当前画布。系统会在新子画布中创建同一 Artifact 的引用视图，并复制所选对象之间的内部关系。</div>
      </div>
      <footer><button className="secondary" onClick={onCancel}>取消</button><button className="primary" disabled={!label.trim()} onClick={() => onCreate({ label: label.trim(), kind })}>创建并进入</button></footer>
    </section>
  </div>
}

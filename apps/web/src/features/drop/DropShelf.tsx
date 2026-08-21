import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, Boxes, Layers3, LayoutPanelLeft, X } from 'lucide-react'
import type { CanvasScope, Workspace } from '../../model'

export type DropAnchor = 'left' | 'bottom'
export type TransferVerb = '加入' | '移动' | '继续工作'
export type DropDestination =
  | { kind: 'workbench'; id: string; label: string }
  | { kind: 'workspace'; id: string; label: string }
  | { kind: 'scope'; id: string; label: string }
  | { kind: 'root'; id: string; label: string }

interface Props {
  open: boolean
  anchor: DropAnchor
  count: number
  workspaces: Workspace[]
  scopes: CanvasScope[]
  rootScopeId: string
  currentScopeId: string
  excludedScopeIds?: readonly string[]
  onCancel: () => void
  onSend: (destination: DropDestination, verb: TransferVerb) => void
}

export function DropShelf({ open, anchor, count, workspaces, scopes, rootScopeId, currentScopeId, excludedScopeIds = [], onCancel, onSend }: Props) {
  const shelfRef = useRef<HTMLDivElement>(null)
  const [verb, setVerb] = useState<TransferVerb>('加入')
  useEffect(() => {
    if (!open) return
    setVerb('加入')
    const focusFrame = window.requestAnimationFrame(() => shelfRef.current?.focus({ preventScroll: true }))
    const onPointerDown = (event: PointerEvent) => {
      if (shelfRef.current?.contains(event.target as Node)) return
      onCancel()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel, open])
  if (!open) return null
  const destinations: DropDestination[] = [
    { kind: 'workbench', id: 'current-workbench', label: '当前现场' },
    ...workspaces.map((workspace) => ({ kind: 'workspace' as const, id: workspace.id, label: workspace.label })),
    ...scopes.filter((scope) => scope.id !== currentScopeId && scope.kind !== 'root' && !excludedScopeIds.includes(scope.id)).slice(0, 4).map((scope) => ({ kind: 'scope' as const, id: scope.id, label: scope.label })),
    ...(currentScopeId !== rootScopeId ? [{ kind: 'root' as const, id: rootScopeId, label: '主画布' }] : []),
  ]
  const iconFor = (destination: DropDestination) => destination.kind === 'workspace' ? <LayoutPanelLeft size={15} /> : destination.kind === 'scope' ? <Layers3 size={15} /> : <Boxes size={15} />
  return <div ref={shelfRef} className={`vnext-drop-shelf anchor-${anchor}`} role="dialog" aria-modal="false" aria-labelledby="drop-shelf-title" tabIndex={-1} data-testid="drop-shelf">
    <header className="vnext-drop-heading">
      <span className="vnext-drop-payload" aria-hidden="true"><span className="lcos-drop-stack">{Array.from({length:Math.min(3,count)},(_,index)=><i key={index} style={{'--stack-index':index} as CSSProperties}><Layers3 size={13}/></i>)}</span><strong>{count}</strong></span>
      <div><strong id="drop-shelf-title">投送 {count} 个对象</strong><span>选择处理方式和目标空间</span></div>
    </header>
    <div className="vnext-drop-verbs" aria-label="投送方式">
      {(['加入', '移动', '继续工作'] as const).map((item) =>
        <button key={item} type="button" className={verb === item ? 'active' : ''} aria-pressed={verb === item} title={item === '加入' ? '保留原位置，并在目标中建立引用' : item === '移动' ? '从当前空间移出并放入目标' : '复制到当前现场并立即进入'} onClick={() => setVerb(item)}>{item}</button>
      )}
    </div>
    <div className="vnext-drop-destinations">
      {destinations.map((destination) => <div className="vnext-destination" key={`${destination.kind}:${destination.id}`}>
        <button type="button" className="vnext-destination-main" title={`${verb} ${destination.label}`} onClick={() => onSend(destination, verb)}>{iconFor(destination)}<span>{destination.label}</span></button>
        <button type="button" className="vnext-destination-follow" title={`继续工作：${destination.label}`} aria-label={`继续工作：${destination.label}`} onClick={() => onSend(destination, '继续工作')}><ArrowRight size={14} /></button>
      </div>)}
    </div>
    <button type="button" className="vnext-drop-close" aria-label="取消投送" onClick={onCancel}><X size={14} /></button>
  </div>
}

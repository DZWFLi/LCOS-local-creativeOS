import { useEffect, useRef } from 'react'
import { ArrowRight, Boxes, Layers3, LayoutPanelLeft, X } from 'lucide-react'
import type { CanvasScope, Workspace } from '../../model'

export type DropAnchor = 'left' | 'bottom'
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
  onSend: (destination: DropDestination, follow: boolean) => void
}

export function DropShelf({ open, anchor, count, workspaces, scopes, rootScopeId, currentScopeId, excludedScopeIds = [], onCancel, onSend }: Props) {
  const shelfRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
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
  return <div ref={shelfRef} className={`vnext-drop-shelf anchor-${anchor}`} role="dialog" aria-label="投送到其他空间" data-testid="drop-shelf">
    <div className="vnext-drop-payload"><span className="vnext-payload-stack"><i /><i /><i /></span><strong>{count}</strong></div>
    <div className="vnext-drop-destinations">
      {destinations.map((destination) => <div className="vnext-destination" key={`${destination.kind}:${destination.id}`}>
        <button type="button" className="vnext-destination-main" title={`放入 ${destination.label}`} onClick={() => onSend(destination, false)}>{iconFor(destination)}<span>{destination.label}</span></button>
        <button type="button" className="vnext-destination-follow" title={`放入并前往 ${destination.label}`} aria-label={`放入并前往 ${destination.label}`} onClick={() => onSend(destination, true)}><ArrowRight size={14} /></button>
      </div>)}
    </div>
    <button type="button" className="vnext-drop-close" aria-label="取消投送" onClick={onCancel}><X size={14} /></button>
  </div>
}

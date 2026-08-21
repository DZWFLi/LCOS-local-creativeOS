import { GitCompareArrows, History, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ContextHistoryEntry, SessionHandoffProjection } from './surfaceContracts'

interface Props {
  history: ContextHistoryEntry[]
  handoffs: SessionHandoffProjection[]
  onBranch: (entry: ContextHistoryEntry) => void
  onCompare: (entry: ContextHistoryEntry) => void
  onSource: (entry: ContextHistoryEntry) => void
}

export function ContextHistoryRail({ history, handoffs, onBranch, onCompare, onSource }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  const open = history.find((entry) => entry.id === openId) ?? null
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenId(null) }
    const onPointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpenId(null) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer) }
  }, [open])
  if (!history.length && !handoffs.length) return null
  return <aside ref={ref} className="lcos-context-history" aria-label="Context history">
    <div className="lcos-context-history-head"><History size={11}/><span>Context history</span></div>
    {history.length > 0 && <div className="lcos-context-version-beads">{history.slice(-6).map((entry) => <button key={entry.id} type="button" className={entry.current ? 'current' : ''} onClick={() => setOpenId(entry.id)} aria-label={`打开 ${entry.label}`}><i/><span>{entry.label}</span></button>)}</div>}
    {handoffs.length > 0 && <div className="lcos-handoff-mini-list">{handoffs.slice(-4).map((handoff) => <div key={handoff.id} className="lcos-handoff-mini"><span>{handoff.from} → {handoff.to}</span><small>{handoff.label || 'Handoff'}</small>{handoff.meta ? <em>{handoff.meta}</em> : null}</div>)}</div>}
    {open && <div className="lcos-context-history-popover" role="dialog" aria-label={`${open.label} history preview`}>
      <button className="lcos-popover-close" type="button" onClick={() => setOpenId(null)} aria-label="关闭"><X size={11}/></button>
      <small>{open.label}{open.current ? ' · Current' : ''}</small><strong>{open.title}</strong><p>{open.summary || `${open.objectIds.length} context refs`}</p>
      <div><button type="button" onClick={() => onSource(open)}><Play size={10}/>来源</button><button type="button" onClick={() => onCompare(open)}><GitCompareArrows size={10}/>对比当前</button><button type="button" className="primary" onClick={() => onBranch(open)}>从这里分支</button></div>
    </div>}
  </aside>
}

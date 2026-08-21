import type { CSSProperties } from 'react'
import { CopyPlus, Link2 } from 'lucide-react'

interface Props {
  zoom: number
  onAi: () => void
  onRelation: () => void
  onDuplicate: () => void
}

export function NodeContextToolbar({ zoom, onRelation, onDuplicate }: Props) {
  if (zoom <= .2) return null
  return <div className="node-context-toolbar" style={{ '--node-toolbar-scale': String(1 / zoom) } as CSSProperties} onPointerDown={(event) => event.stopPropagation()}>
    <button className="pressable" title="建立长期关系" onClick={(event) => { event.stopPropagation(); onRelation() }}><Link2 size={13} />关系</button>
    <button className="pressable" title="创建额外 View" onClick={(event) => { event.stopPropagation(); onDuplicate() }}><CopyPlus size={13} /></button>
  </div>
}

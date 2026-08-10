import { GitBranch, Route, Sparkles, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { CanvasNode } from '../../model'
import { detectFileIdentity, nodeTypeIcon } from '../canvas/CanvasNodeVisual'
import { nodeRole, statusLabel } from './surfaceModel'

interface Props {
  node: CanvasNode
  selected: boolean
  compact?: boolean
  glyph?: boolean
  dim?: boolean
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
}

export function SurfaceObject({ node, selected, compact = false, glyph = false, dim = false, onSelect, onDoubleClick }: Props) {
  const [hover, setHover] = useState(false)
  const Icon = nodeTypeIcon(node)
  const role = nodeRole(node)
  const fileKind = detectFileIdentity(node)
  const previewCandidate = node.previewDataUrl ?? node.previewUrl
  const preview = previewCandidate && (node.previewMimeType?.startsWith('image/') || previewCandidate.startsWith('data:image/')) ? previewCandidate : null
  const state = statusLabel(node)
  const provider = node.sourceProvider || (/chatgpt|gpt/i.test(node.title) ? 'GPT' : /codex/i.test(node.title) ? 'Codex' : /workbuddy|buddy/i.test(node.title) ? 'Buddy' : '')
  if (glyph) {
    return <button type="button" data-surface-role={role} className={`lcos-surface-glyph role-${role} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`} aria-label={node.title} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)} onDoubleClick={() => onDoubleClick(node.id)}>
      {selected && <><span className="lcos-selected-bloom"/><span className="lcos-selected-ring"/></>}
      <Icon/>
      {(hover || selected) && <span className="lcos-glyph-label">{node.title}</span>}
      {hover && <span className="lcos-surface-hover-card lcos-glyph-hover-card" aria-hidden="true"><strong>{node.title}</strong><small>{node.subtitle || node.previewText || '双击查看详细内容与一度关系'}</small><em>{node.observedPath || node.sourceProvider || role}</em></span>}
    </button>
  }
  return <button type="button" data-surface-role={role} className={`lcos-surface-object role-${role} file-${fileKind} ${selected ? 'selected' : ''} ${compact ? 'compact' : ''} ${dim ? 'dim' : ''}`} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)} onDoubleClick={() => onDoubleClick(node.id)}>
    {selected && <><span className="lcos-selected-bloom"/><span className="lcos-selected-ring"/></>}
    <span className={`lcos-surface-object-icon ${preview ? 'has-preview' : ''}`}>{preview ? <img src={preview} alt="" draggable={false}/> : <Icon/>}</span>
    <span className="lcos-surface-object-copy"><strong>{node.title}</strong>{!compact && node.subtitle && <small>{node.revisionLabel || node.subtitle}</small>}</span>
    {role === 'session' && <span className="lcos-surface-semantic"><Route size={10}/>{provider || 'Session'}</span>}
    {role === 'run' && <span className="lcos-surface-semantic"><Sparkles size={10}/>{provider || 'Run'}</span>}
    {role === 'skill' && <span className="lcos-surface-semantic"><Wrench size={10}/>Skill</span>}
    {role === 'context' && <span className="lcos-surface-version-beads" aria-label={`${node.revisionCount ?? node.contextCount ?? 1} context versions`}>{Array.from({length:Math.max(1,Math.min(3,node.revisionCount ?? node.contextCount ?? 1))},(_,index)=><i key={index}/>)}</span>}
    {(node.current || node.draft || node.historical) && <span className="lcos-surface-semantic"><GitBranch size={10}/>{node.revisionLabel || (node.draft?'Draft':node.current?'Current':'History')}</span>}
    {state && <span className={`lcos-surface-state state-${state.toLowerCase()}`}>{state}</span>}
    {hover && <span className="lcos-surface-hover-card" aria-hidden="true"><strong>{node.title}</strong><small>{node.subtitle || node.previewText || '双击查看详细内容与一度关系'}</small><em>{node.observedPath || node.sourceProvider || role}</em></span>}
  </button>
}

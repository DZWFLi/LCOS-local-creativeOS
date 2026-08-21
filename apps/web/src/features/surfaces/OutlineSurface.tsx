import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CSSProperties, DragEvent, KeyboardEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import {
  adjustHierarchyDepth,
  buildHierarchySeed,
  moveHierarchySubtreeBefore,
  moveHierarchySubtreeBy,
  toggleHierarchyCollapsed,
  visibleHierarchyRows,
  type PresentationHierarchyRow,
} from '../presentation/presentationHierarchy'
import { usePresentationHierarchyState } from '../../state/presentationHierarchyState'
import { nodeTypeIcon } from '../canvas/CanvasNodeVisual'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  source?: { kind: string; label: string }
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
}

/** Context Outline renderer. It edits the same Presentation hierarchy used by Mind Map. */
export function OutlineSurface(props: Props) {
  const seed = useMemo(() => buildHierarchySeed(props.nodes, props.edges), [props.edges, props.nodes])
  const [state, setState] = usePresentationHierarchyState(props.projectId, props.scopeId, 'context-hierarchy', seed, props.nodes)
  const [dragId, setDragId] = useState<string | null>(null)
  const rows = useMemo(() => visibleHierarchyRows(props.nodes, state), [props.nodes, state])

  const toggleCollapse = (id: string) => setState((current) => toggleHierarchyCollapsed(current, id))
  const updateDepth = (id: string, delta: number) => setState((current) => adjustHierarchyDepth(current, id, delta))
  const move = (id: string, direction: -1 | 1) => setState((current) => moveHierarchySubtreeBy(current, id, direction))
  const reorder = (from: string, to: string) => setState((current) => moveHierarchySubtreeBefore(current, from, to))

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, row: PresentationHierarchyRow) => {
    if (event.key === 'Tab') { event.preventDefault(); updateDepth(row.node.id, event.shiftKey ? -1 : 1) }
    else if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); move(row.node.id, -1) }
    else if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); move(row.node.id, 1) }
    else if (event.key === 'ArrowLeft' && row.hasChildren && !state.collapsedIds.includes(row.node.id)) { event.preventDefault(); toggleCollapse(row.node.id) }
    else if (event.key === 'ArrowRight' && row.hasChildren && state.collapsedIds.includes(row.node.id)) { event.preventDefault(); toggleCollapse(row.node.id) }
  }

  return <section className="lcos-dedicated-surface lcos-outline-surface" data-testid="surface-outline">
    <header className="lcos-surface-heading">
      <div><strong>上下文</strong><span>大纲</span></div>
      <small>{rows.length} / {props.nodes.length} objects · 与思维导图共用层级</small>
    </header>
    {props.source && <div className={`lcos-renderer-source source-${props.source.kind}`}><i/><span>{props.source.label}</span><small>Presentation hierarchy v{state.version}</small></div>}
    <div className="lcos-outline-sheet" role="tree">
      {rows.map((row, index) => {
        const Icon = nodeTypeIcon(row.node)
        const selected = props.selectedIds.includes(row.node.id)
        const collapsed = state.collapsedIds.includes(row.node.id)
        return <div
          key={row.node.id}
          className={`lcos-outline-row ${selected ? 'selected' : ''} ${dragId === row.node.id ? 'dragging' : ''}`}
          style={{ '--outline-depth': row.depth, '--i': index } as CSSProperties}
          role="treeitem"
          aria-level={row.depth + 1}
          aria-expanded={row.hasChildren ? !collapsed : undefined}
          draggable
          onDragStart={(event: DragEvent<HTMLDivElement>) => { setDragId(row.node.id); event.dataTransfer.setData('text/plain', row.node.id); event.dataTransfer.effectAllowed = 'move' }}
          onDragEnd={() => setDragId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); reorder(event.dataTransfer.getData('text/plain'), row.node.id); setDragId(null) }}
        >
          <span className="lcos-outline-guides" aria-hidden="true">{Array.from({ length: row.depth }, (_, level) => <i key={level} className={level === row.depth - 1 ? 'current' : ''} style={{ left: `${level * 22 + 6}px` }}/>)}</span>
          <span className="lcos-outline-grip" aria-hidden="true"><GripVertical size={11}/></span>
          <button className="lcos-outline-fold" type="button" disabled={!row.hasChildren} aria-label={collapsed ? '展开' : '折叠'} onClick={() => toggleCollapse(row.node.id)}>{row.hasChildren ? (collapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>) : null}</button>
          <button type="button" className="lcos-outline-main" onKeyDown={(event) => onKey(event, row)} onClick={(event) => props.onSelect(row.node.id, event.shiftKey || event.metaKey || event.ctrlKey)} onDoubleClick={() => props.onDoubleClick(row.node.id)}>
            <Icon/><strong>{row.node.title}</strong><small>{row.node.revisionLabel || row.node.subtitle}</small>
          </button>
          {(row.node.current || row.node.draft) && <span className={`lcos-outline-status ${row.node.draft ? 'draft' : 'current'}`}>{row.node.draft ? 'Draft' : 'Current'}</span>}
        </div>
      })}
    </div>
  </section>
}

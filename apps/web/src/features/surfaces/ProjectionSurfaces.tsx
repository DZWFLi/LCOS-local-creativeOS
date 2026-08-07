import { useMemo } from 'react'
import { FileText, GitBranch, Image, MessageSquareText, PackageCheck, Play, Sparkles } from 'lucide-react'
import type { CanvasEdge, CanvasNode } from '../../model'
import type { SurfaceId } from '../shell/SurfaceDock'

interface Props {
  surface: Exclude<SurfaceId, 'arrange'>
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
}

type VM = { node: CanvasNode; x: number; y: number; w: number; h: number; group?: string; muted?: boolean }

function iconFor(node: CanvasNode) {
  if (node.kind === 'process') return <Play size={14} />
  if (node.kind === 'decision') return <GitBranch size={14} />
  if (node.kind === 'generated') return <Sparkles size={14} />
  if (node.fileType?.toLowerCase().includes('image') || node.previewUrl) return <Image size={14} />
  if (node.kind === 'note') return <MessageSquareText size={14} />
  return <FileText size={14} />
}

function stableSort(nodes: CanvasNode[]) {
  return [...nodes].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.title.localeCompare(b.title))
}

function layout(surface: Props['surface'], nodes: CanvasNode[], edges: CanvasEdge[], selectedIds: string[]): VM[] {
  const ordered = stableSort(nodes)
  if (surface === 'outline') {
    return ordered.map((node, index) => ({ node, x: 190 + (node.kind === 'source' ? 0 : node.kind === 'process' ? 48 : node.kind === 'generated' ? 76 : 24), y: 92 + index * 48, w: 520 - (node.kind === 'generated' ? 76 : 0), h: 36 }))
  }
  if (surface === 'context-flow') {
    const lanes = new Map<CanvasNode['kind'], number>([['source', 0], ['context', 0], ['note', 0], ['working', 1], ['process', 1], ['decision', 1], ['generated', 2]])
    const counters = [0, 0, 0]
    return ordered.map((node) => {
      const lane = lanes.get(node.kind) ?? 1
      const index = counters[lane]++
      return { node, x: 170 + index * 230, y: 132 + lane * 205, w: 176, h: 82, group: `axis-${lane}` }
    })
  }
  if (surface === 'context-tree') {
    const incoming = new Map<string, number>()
    edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1))
    const roots = ordered.filter((node) => !incoming.get(node.id))
    const rootIds = new Set(roots.map((node) => node.id))
    let branch = 0
    return ordered.map((node, index) => {
      if (rootIds.has(node.id)) return { node, x: 130, y: 90 + roots.indexOf(node) * 120, w: 172, h: 76 }
      const parents = edges.filter((edge) => edge.to === node.id).map((edge) => edge.from)
      const depth = parents.some((id) => rootIds.has(id)) ? 1 : parents.length ? 2 : 1
      const row = branch++
      return { node, x: 390 + (depth - 1) * 260, y: 90 + row * 100, w: 178, h: 76 }
    })
  }
  if (surface === 'context-graph') {
    const focusId = selectedIds.at(-1) ?? ordered[0]?.id
    const first = new Set(edges.filter((edge) => edge.from === focusId || edge.to === focusId).flatMap((edge) => [edge.from, edge.to]).filter((id) => id !== focusId))
    const second = new Set(edges.filter((edge) => first.has(edge.from) || first.has(edge.to)).flatMap((edge) => [edge.from, edge.to]).filter((id) => id !== focusId && !first.has(id)))
    const centerX = 560, centerY = 330
    let a = 0, b = 0
    return ordered.map((node) => {
      if (node.id === focusId) return { node, x: centerX - 82, y: centerY - 44, w: 164, h: 88 }
      if (first.has(node.id)) { const angle = (a++ / Math.max(1, first.size)) * Math.PI * 2; return { node, x: centerX + Math.cos(angle) * 245 - 68, y: centerY + Math.sin(angle) * 190 - 34, w: 136, h: 68 } }
      if (second.has(node.id)) { const angle = (b++ / Math.max(1, second.size)) * Math.PI * 2 + .4; return { node, x: centerX + Math.cos(angle) * 390 - 54, y: centerY + Math.sin(angle) * 270 - 28, w: 108, h: 56, muted: true } }
      return { node, x: -1000, y: -1000, w: 1, h: 1, muted: true }
    })
  }
  if (surface === 'work') {
    const context = ordered.filter((node) => node.kind === 'source' || node.kind === 'context' || node.kind === 'note')
    const run = ordered.filter((node) => node.kind === 'process')
    const output = ordered.filter((node) => !context.includes(node) && !run.includes(node))
    return [
      ...context.map((node, i) => ({ node, x: 140, y: 120 + i * 110, w: 190, h: 78, group: 'context' })),
      ...run.map((node, i) => ({ node, x: 490, y: 170 + i * 155, w: 220, h: 96, group: 'run' })),
      ...output.map((node, i) => ({ node, x: 840, y: 120 + i * 112, w: 210, h: 82, group: 'output' })),
    ]
  }
  const revisions = ordered.filter((node) => node.managed || node.current || node.draft || node.historical)
  const packageNodes = ordered.filter((node) => !revisions.includes(node))
  return [
    ...revisions.map((node, i) => ({ node, x: 180 + i * 240, y: 190, w: 205, h: 96, group: 'revision' })),
    ...packageNodes.map((node, i) => ({ node, x: 750 + (i % 2) * 190, y: 120 + Math.floor(i / 2) * 110, w: 165, h: 74, group: 'package' })),
  ]
}

function edgePath(from: VM, to: VM) {
  const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = to.x, y2 = to.y + to.h / 2
  return `M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`
}

export function ProjectionSurface({ surface, nodes, edges, selectedIds, onSelect, onDoubleClick }: Props) {
  const placements = useMemo(() => layout(surface, nodes, edges, selectedIds), [edges, nodes, selectedIds, surface])
  const byId = useMemo(() => new Map(placements.map((item) => [item.node.id, item])), [placements])
  const title = surface === 'outline' ? '幕布大纲' : surface === 'context-flow' ? '上下文流' : surface === 'context-tree' ? '上下文树' : surface === 'context-graph' ? '局部关系图' : surface === 'work' ? '运行现场' : '版本与交付'
  return <section className={`vnext-projection-surface projection-${surface}`} data-testid={`surface-${surface}`}>
    <div className="vnext-projection-title"><span>{title}</span><small>同一 Project Truth · 独立布局</small></div>
    {surface === 'context-flow' && <div className="vnext-axis-decoration"><i style={{ top: 172 }} /><i style={{ top: 377 }} /><i style={{ top: 582 }} /></div>}
    {surface === 'work' && <div className="vnext-work-bands"><i /><i /><i /><span>Context</span><span>Run</span><span>Target / Return</span></div>}
    {surface === 'deliver' && <div className="vnext-delivery-zone"><PackageCheck size={16} /><span>Delivery Pack</span></div>}
    <svg className="vnext-projection-edges" viewBox="0 0 1200 760" preserveAspectRatio="none">{edges.map((edge) => { const from = byId.get(edge.from), to = byId.get(edge.to); return from && to && from.w > 1 && to.w > 1 ? <path key={edge.id} className={`${edge.kind} ${edge.active ? 'active' : ''}`} d={edgePath(from, to)} /> : null })}</svg>
    {placements.filter((item) => item.w > 1).map(({ node, x, y, w, h, muted }) => {
      const selected = selectedIds.includes(node.id)
      return <button key={node.id} type="button" className={`vnext-projection-node kind-${node.kind} ${selected ? 'selected' : ''} ${muted ? 'muted' : ''}`} style={{ left: x, top: y, width: w, height: h }} onClick={(event) => onSelect(node.id, event.shiftKey)} onDoubleClick={() => onDoubleClick(node.id)}>
        {selected && <><span className="vnext-edge-light" /><span className="vnext-edge-bloom" /></>}
        <span className="vnext-projection-icon">{iconFor(node)}</span>
        <span className="vnext-projection-copy"><strong>{node.title}</strong>{surface !== 'context-graph' && <small>{node.revisionLabel ?? node.subtitle}</small>}</span>
        {(node.current || node.draft || node.runStatus) && <span className={`vnext-status-mark ${node.draft ? 'draft' : node.current ? 'current' : `run-${node.runStatus}`}`} />}
      </button>
    })}
  </section>
}

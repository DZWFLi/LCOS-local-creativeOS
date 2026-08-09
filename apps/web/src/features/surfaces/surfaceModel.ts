import type { CanvasEdge, CanvasNode } from '../../model'

export function orderedNodes(nodes: readonly CanvasNode[]) {
  return [...nodes].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.title.localeCompare(b.title))
}

export function incomingMap(edges: readonly CanvasEdge[]) {
  const map = new Map<string, CanvasEdge[]>()
  for (const edge of edges) map.set(edge.to, [...(map.get(edge.to) ?? []), edge])
  return map
}

export function outgoingMap(edges: readonly CanvasEdge[]) {
  const map = new Map<string, CanvasEdge[]>()
  for (const edge of edges) map.set(edge.from, [...(map.get(edge.from) ?? []), edge])
  return map
}

export function adjacency(edges: readonly CanvasEdge[]) {
  const map = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!map.has(edge.from)) map.set(edge.from, new Set())
    if (!map.has(edge.to)) map.set(edge.to, new Set())
    map.get(edge.from)!.add(edge.to)
    map.get(edge.to)!.add(edge.from)
  }
  return map
}

export function nodeRole(node: CanvasNode): 'artifact' | 'feedback' | 'session' | 'run' | 'skill' | 'decision' | 'context' | 'note' {
  if (/(^|[\\/])SKILL\.md$/i.test(node.observedPath ?? node.title)) return 'skill'
  if (node.kind === 'process') {
    const text = `${node.title} ${node.subtitle}`.toLowerCase()
    return /session|chatgpt|conversation|handoff|对话|会话/.test(text) ? 'session' : 'run'
  }
  if (node.kind === 'decision') return 'decision'
  if (node.kind === 'context') return 'context'
  if (node.kind === 'note') {
    const text = `${node.title} ${node.subtitle}`.toLowerCase()
    return /feedback|反馈|change:|change：|keep:|keep：/.test(text) ? 'feedback' : 'note'
  }
  const text = `${node.title} ${node.subtitle}`.toLowerCase()
  if (/feedback|反馈|change:|change：|keep:|keep：/.test(text)) return 'feedback'
  return 'artifact'
}

export function statusLabel(node: CanvasNode) {
  if (node.draft) return 'Draft'
  if (node.current) return 'Current'
  if (node.historical) return 'History'
  if (node.runStatus === 'running') return 'Running'
  if (node.runStatus === 'waiting_input') return 'Waiting'
  if (node.runStatus === 'review') return 'Review'
  if (node.runStatus === 'failed') return 'Failed'
  return ''
}

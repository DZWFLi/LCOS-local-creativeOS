import type { CanvasEdge, CanvasNode } from '../../model'

export interface PresentationHierarchyState {
  orderIds: string[]
  depthById: Record<string, number>
  collapsedIds: string[]
  version: number
}

export interface PresentationHierarchyRow {
  id: string
  node: CanvasNode
  depth: number
  parentId: string | null
  hasChildren: boolean
  hidden: boolean
  subtreeEnd: number
}

const clampDepth = (value: number) => Math.max(0, Math.min(12, Math.floor(value || 0)))

const stableNodes = (nodes: readonly CanvasNode[]) => [...nodes].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))

/**
 * Build an initial presentation hierarchy from canonical relations without pretending
 * the canonical graph itself is a tree. Multiple-parent/cyclic relations are reduced
 * deterministically only for the initial renderer seed; later edits are Presentation-only.
 */
export function buildHierarchySeed(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): PresentationHierarchyState {
  const ordered = stableNodes(nodes)
  const byId = new Map(ordered.map((node) => [node.id, node]))
  const incomingCount = new Map(ordered.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()
  edges.forEach((edge) => {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) return
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
    const current = outgoing.get(edge.from) ?? []
    if (!current.includes(edge.to)) outgoing.set(edge.from, [...current, edge.to])
  })
  const rank = new Map(ordered.map((node, index) => [node.id, index]))
  outgoing.forEach((ids, id) => outgoing.set(id, [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || a.localeCompare(b))))

  const orderIds: string[] = []
  const depthById: Record<string, number> = {}
  const seen = new Set<string>()
  const walk = (id: string, depth: number) => {
    if (seen.has(id) || !byId.has(id)) return
    seen.add(id)
    orderIds.push(id)
    depthById[id] = clampDepth(depth)
    for (const child of outgoing.get(id) ?? []) walk(child, depth + 1)
  }
  ordered.filter((node) => (incomingCount.get(node.id) ?? 0) === 0).forEach((node) => walk(node.id, 0))
  ordered.forEach((node) => walk(node.id, 0))
  return { orderIds, depthById, collapsedIds: [], version: 1 }
}

export function normalizeHierarchyState(state: PresentationHierarchyState, nodes: readonly CanvasNode[], seed?: PresentationHierarchyState): PresentationHierarchyState {
  const ids = new Set(nodes.map((node) => node.id))
  const orderIds = state.orderIds.filter((id, index, source) => ids.has(id) && source.indexOf(id) === index)
  const seedOrder = seed?.orderIds.filter((id) => ids.has(id)) ?? []
  const missing = [...seedOrder, ...stableNodes(nodes).map((node) => node.id)].filter((id, index, source) => !orderIds.includes(id) && source.indexOf(id) === index)
  orderIds.push(...missing)
  const depthById: Record<string, number> = {}
  let previousDepth = 0
  orderIds.forEach((id, index) => {
    const proposed = clampDepth(state.depthById[id] ?? seed?.depthById[id] ?? 0)
    const depth = index === 0 ? 0 : Math.min(proposed, previousDepth + 1)
    depthById[id] = depth
    previousDepth = depth
  })
  const collapsedIds = state.collapsedIds.filter((id) => ids.has(id))
  const changed = orderIds.join('|') !== state.orderIds.join('|')
    || collapsedIds.join('|') !== state.collapsedIds.join('|')
    || orderIds.some((id) => depthById[id] !== state.depthById[id])
  return changed ? { ...state, orderIds, depthById, collapsedIds, version: state.version + 1 } : state
}

export function hierarchyRows(nodes: readonly CanvasNode[], state: PresentationHierarchyState): PresentationHierarchyRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const order = state.orderIds.filter((id) => byId.has(id))
  const rows: PresentationHierarchyRow[] = []
  const parentStack: string[] = []
  const collapsedDepths: number[] = []

  order.forEach((id, index) => {
    const node = byId.get(id)
    if (!node) return
    const depth = clampDepth(state.depthById[id] ?? 0)
    parentStack.length = depth
    const parentId = depth > 0 ? parentStack[depth - 1] ?? null : null
    parentStack[depth] = id

    while (collapsedDepths.length && depth <= collapsedDepths[collapsedDepths.length - 1]!) collapsedDepths.pop()
    const hidden = collapsedDepths.length > 0
    const nextDepth = index + 1 < order.length ? clampDepth(state.depthById[order[index + 1]!] ?? 0) : 0
    const hasChildren = nextDepth > depth
    let subtreeEnd = index + 1
    while (subtreeEnd < order.length && clampDepth(state.depthById[order[subtreeEnd]!] ?? 0) > depth) subtreeEnd += 1
    rows.push({ id, node, depth, parentId, hasChildren, hidden, subtreeEnd })
    if (hasChildren && state.collapsedIds.includes(id)) collapsedDepths.push(depth)
  })
  return rows
}

export function visibleHierarchyRows(nodes: readonly CanvasNode[], state: PresentationHierarchyState) {
  return hierarchyRows(nodes, state).filter((row) => !row.hidden)
}

export function toggleHierarchyCollapsed(state: PresentationHierarchyState, id: string): PresentationHierarchyState {
  return {
    ...state,
    collapsedIds: state.collapsedIds.includes(id) ? state.collapsedIds.filter((item) => item !== id) : [...state.collapsedIds, id],
    version: state.version + 1,
  }
}

export function adjustHierarchyDepth(state: PresentationHierarchyState, id: string, delta: number): PresentationHierarchyState {
  const index = state.orderIds.indexOf(id)
  if (index < 0 || !delta) return state
  const rootDepth = clampDepth(state.depthById[id] ?? 0)
  let end = index + 1
  while (end < state.orderIds.length && clampDepth(state.depthById[state.orderIds[end]!] ?? 0) > rootDepth) end += 1
  const previousId = index > 0 ? state.orderIds[index - 1] : null
  const maxRootDepth = previousId ? clampDepth(state.depthById[previousId] ?? 0) + 1 : 0
  const targetRootDepth = Math.max(0, Math.min(maxRootDepth, rootDepth + delta))
  const appliedDelta = targetRootDepth - rootDepth
  if (!appliedDelta) return state
  const depthById = { ...state.depthById }
  for (let cursor = index; cursor < end; cursor += 1) {
    const itemId = state.orderIds[cursor]!
    depthById[itemId] = clampDepth((depthById[itemId] ?? 0) + appliedDelta)
  }
  return { ...state, depthById, version: state.version + 1 }
}

function hierarchyParentAt(state: PresentationHierarchyState, targetIndex: number): string | null {
  if (targetIndex < 0 || targetIndex >= state.orderIds.length) return null
  const id = state.orderIds[targetIndex]!
  const depth = clampDepth(state.depthById[id] ?? 0)
  if (depth === 0) return null
  for (let cursor = targetIndex - 1; cursor >= 0; cursor -= 1) {
    const candidate = state.orderIds[cursor]!
    const candidateDepth = clampDepth(state.depthById[candidate] ?? 0)
    if (candidateDepth === depth - 1) return candidate
    if (candidateDepth < depth - 1) return null
  }
  return null
}

/** Move a whole hierarchy subtree before another row, preserving its internal depth shape. */
export function moveHierarchySubtreeBefore(state: PresentationHierarchyState, fromId: string, toId: string): PresentationHierarchyState {
  if (fromId === toId) return state
  const fromIndex = state.orderIds.indexOf(fromId)
  const toIndex = state.orderIds.indexOf(toId)
  if (fromIndex < 0 || toIndex < 0) return state
  const fromDepth = clampDepth(state.depthById[fromId] ?? 0)
  const toDepth = clampDepth(state.depthById[toId] ?? 0)
  if (fromDepth !== toDepth || hierarchyParentAt(state, fromIndex) !== hierarchyParentAt(state, toIndex)) return state
  let fromEnd = fromIndex + 1
  while (fromEnd < state.orderIds.length && clampDepth(state.depthById[state.orderIds[fromEnd]!] ?? 0) > fromDepth) fromEnd += 1
  if (toIndex > fromIndex && toIndex < fromEnd) return state
  const block = state.orderIds.slice(fromIndex, fromEnd)
  const remaining = state.orderIds.filter((id) => !block.includes(id))
  const target = Math.max(0, remaining.indexOf(toId))
  remaining.splice(target, 0, ...block)
  return { ...state, orderIds: remaining, version: state.version + 1 }
}

/** Move a subtree among siblings without silently reparenting it. */
export function moveHierarchySubtreeBy(state: PresentationHierarchyState, id: string, direction: -1 | 1): PresentationHierarchyState {
  const index = state.orderIds.indexOf(id)
  if (index < 0) return state
  const depth = clampDepth(state.depthById[id] ?? 0)
  const parentId = hierarchyParentAt(state, index)
  const siblings = state.orderIds.filter((candidate, candidateIndex) => clampDepth(state.depthById[candidate] ?? 0) === depth && hierarchyParentAt(state, candidateIndex) === parentId)
  const siblingIndex = siblings.indexOf(id)
  const targetId = siblings[siblingIndex + direction]
  if (!targetId) return state

  let end = index + 1
  while (end < state.orderIds.length && clampDepth(state.depthById[state.orderIds[end]!] ?? 0) > depth) end += 1
  const block = state.orderIds.slice(index, end)
  const remaining = state.orderIds.filter((item) => !block.includes(item))
  const targetStart = remaining.indexOf(targetId)
  if (targetStart < 0) return state
  if (direction < 0) {
    remaining.splice(targetStart, 0, ...block)
  } else {
    const targetDepth = clampDepth(state.depthById[targetId] ?? 0)
    let targetEnd = targetStart + 1
    while (targetEnd < remaining.length && clampDepth(state.depthById[remaining[targetEnd]!] ?? 0) > targetDepth) targetEnd += 1
    remaining.splice(targetEnd, 0, ...block)
  }
  return { ...state, orderIds: remaining, version: state.version + 1 }
}

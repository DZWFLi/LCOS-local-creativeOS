import type { CanvasEdge, CanvasNode } from '../model'
import { getSelectionBounds } from '../features/canvas/canvasGeometry'

export type CanvasClipboardPayload =
  | {
      kind: 'nodes'
      sourceProjectId: string
      copiedAt: string
      nodes: CanvasNode[]
      edges: CanvasEdge[]
    }
  | {
      kind: 'relation'
      copiedAt: string
      relationKind: CanvasEdge['kind']
    }

export interface PasteResult {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  createdIds: string[]
  createdEdgeIds: string[]
}

interface Point { x: number; y: number }

function overlaps(a: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, b: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, gap = 18): boolean {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y
}

function isArtifact(node: CanvasNode): boolean {
  return node.kind === 'source' || node.kind === 'working' || node.kind === 'generated'
}

export function copyCanvasSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  selectedIds: string[],
  selectedEdgeId: string | null,
  sourceProjectId: string,
): CanvasClipboardPayload | null {
  if (selectedIds.length) {
    const selectedSet = new Set(selectedIds)
    const selectedNodes = nodes.filter((node) => selectedSet.has(node.id))
    if (!selectedNodes.length) return null
    return {
      kind: 'nodes',
      sourceProjectId,
      copiedAt: new Date().toISOString(),
      nodes: selectedNodes.map((node) => ({ ...node })),
      edges: edges.filter((edge) => selectedSet.has(edge.from) && selectedSet.has(edge.to)).map((edge) => ({ ...edge })),
    }
  }

  if (selectedEdgeId) {
    const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
    if (!selectedEdge) return null
    return { kind: 'relation', copiedAt: new Date().toISOString(), relationKind: selectedEdge.kind }
  }

  return null
}

export function pasteCanvasNodes(
  payload: Extract<CanvasClipboardPayload, { kind: 'nodes' }>,
  existingNodes: CanvasNode[],
  target: Point,
  createId: (prefix: string) => string,
): PasteResult {
  const bounds = getSelectionBounds(payload.nodes, payload.nodes.map((node) => node.id))
  if (!bounds) return { nodes: [], edges: [], createdIds: [], createdEdgeIds: [] }

  const idMap = new Map<string, string>()
  payload.nodes.forEach((node) => idMap.set(node.id, createId(node.kind)))

  const baseDelta = {
    x: target.x - bounds.x - bounds.width / 2,
    y: target.y - bounds.y - bounds.height / 2,
  }

  let chosenDelta = baseDelta
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const step = attempt * 34
    const candidateDelta = { x: baseDelta.x + step, y: baseDelta.y + step }
    const candidates = payload.nodes.map((node) => ({ ...node, x: node.x + candidateDelta.x, y: node.y + candidateDelta.y }))
    if (!candidates.some((candidate) => existingNodes.some((existing) => overlaps(candidate, existing)))) {
      chosenDelta = candidateDelta
      break
    }
  }

  const pastedNodes = payload.nodes.map((node) => {
    const id = idMap.get(node.id)!
    return {
      ...node,
      id,
      x: node.x + chosenDelta.x,
      y: node.y + chosenDelta.y,
      artifactId: isArtifact(node) ? (node.artifactId ?? node.viewOf ?? node.id) : node.artifactId,
      viewOf: node.viewOf ?? node.id,
      parentRunId: node.parentRunId,
      revisionOf: node.revisionOf ? (idMap.get(node.revisionOf) ?? node.revisionOf) : undefined,
      previewUrl: node.previewUrl,
    }
  })

  const pastedEdges = payload.edges.map((edge) => ({
    ...edge,
    id: createId('edge'),
    from: idMap.get(edge.from)!,
    to: idMap.get(edge.to)!,
    active: false,
  }))

  return {
    nodes: pastedNodes,
    edges: pastedEdges,
    createdIds: pastedNodes.map((node) => node.id),
    createdEdgeIds: pastedEdges.map((edge) => edge.id),
  }
}

export function pasteRelationTemplate(
  payload: Extract<CanvasClipboardPayload, { kind: 'relation' }>,
  selectedIds: string[],
  edges: CanvasEdge[],
  createId: (prefix: string) => string,
): CanvasEdge | null {
  if (selectedIds.length !== 2) return null
  const [from, to] = selectedIds
  if (from === to || edges.some((edge) => edge.from === from && edge.to === to && edge.kind === payload.relationKind)) return null
  return { id: createId('edge'), from, to, kind: payload.relationKind }
}

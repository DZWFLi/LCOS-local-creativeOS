import type { Camera, CanvasNode } from '../../model'

/** Camera-driven Conversation presentation only. Never persist this value to Core. */
export type GlythSemanticLod = 'normal' | 'mid' | 'far' | 'extreme-far'

/** Reuse the canvas' established zoom bands so Glyth anatomy changes with the same spatial rhythm. */
export function glythSemanticLodForZoom(zoom: number): GlythSemanticLod {
  if (zoom >= .9) return 'normal'
  if (zoom >= .6) return 'mid'
  if (zoom >= .35) return 'far'
  return 'extreme-far'
}

export function isConversationNode(node: CanvasNode): boolean {
  return node.entityKind === 'conversation' && Boolean(node.conversation)
}

export function isCriticalGlyth(node: CanvasNode, input: {
  readonly selectedIds: ReadonlySet<string>
  readonly activeConversationId?: string | null
  readonly focusIds?: ReadonlySet<string>
}): boolean {
  if (!isConversationNode(node)) return false
  if (input.selectedIds.has(node.id)) return true
  if (input.focusIds?.has(node.id)) return true
  return Boolean(input.activeConversationId && node.conversation?.id === input.activeConversationId)
}

export interface GlythSemanticCluster {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly count: number
  readonly memberIds: readonly string[]
}

/**
 * Extreme-far semantic grouping. Buckets are screen-sized, but output anchors are world-space.
 * It is an ephemeral projection: no Marker/Relation/Core mutation is produced here.
 */
export function clusterExtremeFarGlyths(
  nodes: readonly CanvasNode[],
  camera: Camera,
  criticalIds: ReadonlySet<string>,
  cellPx = 96,
): GlythSemanticCluster[] {
  if (camera.zoom <= 0 || !Number.isFinite(camera.zoom)) return []
  const buckets = new Map<string, CanvasNode[]>()
  for (const node of nodes) {
    if (!isConversationNode(node) || criticalIds.has(node.id)) continue
    const centerX = node.x + node.width / 2
    const centerY = node.y + node.height / 2
    const screenX = camera.x + centerX * camera.zoom
    const screenY = camera.y + centerY * camera.zoom
    const key = `${Math.floor(screenX / cellPx)}:${Math.floor(screenY / cellPx)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(node)
    else buckets.set(key, [node])
  }

  const clusters: GlythSemanticCluster[] = []
  for (const [key, members] of buckets) {
    if (members.length < 2) continue
    const x = members.reduce((sum, node) => sum + node.x + node.width / 2, 0) / members.length
    const y = members.reduce((sum, node) => sum + node.y + node.height / 2, 0) / members.length
    clusters.push({
      id: `glyth-cluster:${key}`,
      x,
      y,
      count: members.length,
      memberIds: members.map((node) => node.id),
    })
  }
  return clusters
}

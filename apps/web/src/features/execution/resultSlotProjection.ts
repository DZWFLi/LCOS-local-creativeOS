import type { ResultSlotV0 } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'

const DEFAULT_SLOT_WIDTH = 220
const DEFAULT_SLOT_HEIGHT = 128

function slotSubtitle(status: ResultSlotV0['status']): string {
  if (status === 'running') return 'Agent 正在生成到这里'
  if (status === 'review') return '结果待确认'
  if (status === 'materialized') return '结果已物化'
  return '等待一次生成结果'
}

export function projectResultSlot(slot: ResultSlotV0): CanvasNode {
  return {
    id: slot.id,
    kind: 'generated',
    title: '空白结果',
    subtitle: slotSubtitle(slot.status),
    x: slot.position.x,
    y: slot.position.y,
    width: slot.size?.width ?? DEFAULT_SLOT_WIDTH,
    height: slot.size?.height ?? DEFAULT_SLOT_HEIGHT,
    displayMode: 'standard',
    managed: true,
    createdAt: slot.createdAt,
    resultSlotId: slot.id,
    resultSlotStatus: slot.status,
    scopeId: slot.scopeId,
    workspaceIds: slot.workspaceId ? [slot.workspaceId] : [],
  }
}

function sameSlotProjection(node: CanvasNode, slot: ResultSlotV0): boolean {
  return node.resultSlotId === slot.id
    && node.resultSlotStatus === slot.status
    && node.x === slot.position.x
    && node.y === slot.position.y
    && node.width === (slot.size?.width ?? node.width)
    && node.height === (slot.size?.height ?? node.height)
}

/**
 * ResultSlot is Core truth. This function only projects that truth into the
 * current spatial node set. A materialized slot reuses the canonical Artifact
 * view and moves that projection to the authoritative slot position; it never
 * creates a second output node.
 */
export function reconcileResultSlotProjections(nodes: readonly CanvasNode[], slots: readonly ResultSlotV0[]): CanvasNode[] {
  const bySlotId = new Map(slots.map((slot) => [slot.id, slot]))
  const materializedByViewId = new Map(slots.filter((slot) => slot.status === 'materialized' && slot.artifactViewId).map((slot) => [slot.artifactViewId!, slot]))
  const materializedByArtifactId = new Map(slots.filter((slot) => slot.status === 'materialized' && slot.artifactId).map((slot) => [slot.artifactId!, slot]))
  const materializedCanonicalAvailable = new Set(nodes.flatMap((node) => {
    const slot = materializedByViewId.get(node.id) ?? (node.artifactId ? materializedByArtifactId.get(node.artifactId) : undefined)
    return slot && node.id !== slot.id ? [slot.id] : []
  }))
  let changed = false

  const next: CanvasNode[] = []
  const resolvedMaterializedSlots = new Set<string>()

  for (const node of nodes) {
    if (node.resultSlotId && !bySlotId.has(node.resultSlotId)) {
      changed = true
      continue
    }

    const materialized = materializedByViewId.get(node.id)
      ?? (node.artifactId ? materializedByArtifactId.get(node.artifactId) : undefined)
    if (materialized) {
      resolvedMaterializedSlots.add(materialized.id)
      const width = materialized.size?.width ?? node.width
      const height = materialized.size?.height ?? node.height
      if (node.resultSlotId === materialized.id
        && node.resultSlotStatus === 'materialized'
        && node.x === materialized.position.x
        && node.y === materialized.position.y
        && node.width === width
        && node.height === height) {
        next.push(node)
      } else {
        changed = true
        next.push({
          ...node,
          x: materialized.position.x,
          y: materialized.position.y,
          width,
          height,
          resultSlotId: materialized.id,
          resultSlotStatus: 'materialized',
        })
      }
      continue
    }

    if (node.resultSlotId) {
      const slot = bySlotId.get(node.resultSlotId)
      if (slot && slot.status !== 'materialized') {
        const projected = projectResultSlot(slot)
        if (sameSlotProjection(node, slot) && node.title === projected.title && node.subtitle === projected.subtitle) next.push(node)
        else { changed = true; next.push(projected) }
        continue
      }
      if (slot?.status === 'materialized') {
        if (materializedCanonicalAvailable.has(slot.id)) { changed = true; continue }
        const projected = projectResultSlot(slot)
        resolvedMaterializedSlots.add(slot.id)
        if (sameSlotProjection(node, slot) && node.title === projected.title && node.subtitle === projected.subtitle) next.push(node)
        else { changed = true; next.push(projected) }
        continue
      }
    }

    next.push(node)
  }

  const existingSlotIds = new Set(next.map((node) => node.resultSlotId).filter((value): value is string => Boolean(value)))
  for (const slot of slots) {
    if (slot.status === 'materialized') {
      if (!resolvedMaterializedSlots.has(slot.id)) {
        // Core says the result is materialized but the canonical Project view
        // has not hydrated yet. Keep one truthful transitional projection; the
        // next project/result-slot refresh will replace it with the Artifact.
        next.push(projectResultSlot(slot))
        changed = true
      }
      continue
    }
    if (!existingSlotIds.has(slot.id)) {
      next.push(projectResultSlot(slot))
      changed = true
    }
  }

  return changed ? next : nodes as CanvasNode[]
}

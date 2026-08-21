import type { Checkpoint, ContextSnapshotRefsV1, HandoffRecord } from '@local-creative-os/contracts'

import type { ContextHistoryEntry, SessionHandoffProjection } from './surfaceContracts'

/**
 * B5/B6 历史投影适配器：把 Local Core 的 ContextSnapshot（Checkpoint）
 * 与 HandoffRecord 投影成 Context surface 消费的视图模型。
 * 纯函数，无 React / 无 client 依赖，便于单测。
 */

function parseSnapshotRefs(value: unknown): ContextSnapshotRefsV1 | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<ContextSnapshotRefsV1>
  if (!Array.isArray(candidate.focusedViewIds)) return null
  if (!Array.isArray(candidate.artifactIds)) return null
  if (!Array.isArray(candidate.relationIds)) return null
  if (!Array.isArray(candidate.noteIds)) return null
  if (!Array.isArray(candidate.runIds)) return null
  return {
    schemaVersion: 1,
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : '',
    workspaceId: typeof candidate.workspaceId === 'string' ? candidate.workspaceId : null,
    scopeId: typeof candidate.scopeId === 'string' ? candidate.scopeId : null,
    focusedViewIds: candidate.focusedViewIds.filter((id): id is string => typeof id === 'string'),
    artifactIds: candidate.artifactIds.filter((id): id is string => typeof id === 'string'),
    relationIds: candidate.relationIds.filter((id): id is string => typeof id === 'string'),
    noteIds: candidate.noteIds.filter((id): id is string => typeof id === 'string'),
    runIds: candidate.runIds.filter((id): id is string => typeof id === 'string'),
  }
}

export function adaptContextSnapshotEntries(snapshots: readonly Checkpoint[]): ContextHistoryEntry[] {
  return snapshots.map((snapshot, index) => {
    const refs = parseSnapshotRefs(snapshot.snapshotJson)
    const objectIds = refs !== null && refs.focusedViewIds.length > 0
      ? Array.from(refs.focusedViewIds)
      : Array.from(refs?.artifactIds ?? [])
    const parts: string[] = []
    if (refs !== null) {
      parts.push(`${refs.artifactIds.length} 个对象`)
      if (refs.relationIds.length > 0) parts.push(`${refs.relationIds.length} 个关系`)
      if (refs.noteIds.length > 0) parts.push(`${refs.noteIds.length} 条备注`)
      if (refs.runIds.length > 0) parts.push(`${refs.runIds.length} 个 Run`)
    } else {
      parts.push('快照内容不可解析')
    }
    return {
      id: String(snapshot.id),
      label: snapshot.label,
      title: snapshot.label,
      summary: parts.join(' · '),
      current: index === snapshots.length - 1,
      objectIds,
      createdAt: snapshot.createdAt,
    }
  })
}

export function adaptHandoffProjections(records: readonly HandoffRecord[]): SessionHandoffProjection[] {
  return records.map((record) => ({
    id: record.id,
    from: record.fromProvider ?? 'Agent',
    to: record.toProvider ?? 'Next',
    label: record.title,
  }))
}

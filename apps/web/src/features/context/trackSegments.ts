import type { ContextTrackSegmentV0 } from '@local-creative-os/contracts'

/**
 * Phase 3 §6.3-6.5：Signal Track 段（Presentation-only）。
 * 轴表达理解/顺序，不是时间；数组顺序即视觉顺序，order 字段与索引同步。
 */

export function createSegmentsFromStrands(
  strands: readonly { readonly id: string; readonly objectIds: readonly string[] }[],
): ContextTrackSegmentV0[] {
  return strands.map((strand, index) => ({
    id: strand.id,
    memberViewIds: [...strand.objectIds],
    order: index,
    collapsed: false,
    label: `第 ${index + 1} 段`,
  }))
}

export function normalizeTrackSegments(
  segments: readonly ContextTrackSegmentV0[],
  availableMemberIds: readonly string[],
): ContextTrackSegmentV0[] {
  const available = new Set(availableMemberIds)
  const seen = new Set<string>()
  return segments
    .map((segment, index) => ({
      ...segment,
      memberViewIds: segment.memberViewIds.filter((id) => available.has(id) && !seen.has(id) && seen.add(id)),
      order: index,
    }))
    .filter((segment) => segment.memberViewIds.length > 0)
    .map((segment, index) => ({ ...segment, order: index }))
}


export function ensureTrackSegmentsCoverMembers(
  segments: readonly ContextTrackSegmentV0[],
  availableMemberIds: readonly string[],
): ContextTrackSegmentV0[] {
  const normalized = normalizeTrackSegments(segments, availableMemberIds)
  const assigned = new Set(normalized.flatMap((segment) => segment.memberViewIds))
  const missing = availableMemberIds.filter((id) => !assigned.has(id))
  if (missing.length === 0) return normalized
  if (normalized.length === 0) {
    return [{ id: 'segment:auto', memberViewIds: [...missing], order: 0, collapsed: false, label: '当前内容' }]
  }
  return [...normalized, {
    id: 'segment:unassigned',
    memberViewIds: [...missing],
    order: normalized.length,
    collapsed: false,
    label: '未编排',
  }]
}

export function reorderTrackSegment(
  segments: readonly ContextTrackSegmentV0[],
  segmentId: string,
  direction: -1 | 1,
): ContextTrackSegmentV0[] {
  const index = segments.findIndex((segment) => segment.id === segmentId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= segments.length) return [...segments]
  const next = [...segments]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next.map((segment, order) => ({ ...segment, order }))
}

export function toggleTrackSegmentCollapsed(
  segments: readonly ContextTrackSegmentV0[],
  segmentId: string,
): ContextTrackSegmentV0[] {
  return segments.map((segment) => segment.id === segmentId ? { ...segment, collapsed: !segment.collapsed } : segment)
}

export function splitTrackSegment(
  segments: readonly ContextTrackSegmentV0[],
  segmentId: string,
  memberIds: readonly string[],
  nextSegmentId: string,
): ContextTrackSegmentV0[] | null {
  const index = segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return null
  const source = segments[index]!
  const splitSet = new Set(memberIds)
  const keep = source.memberViewIds.filter((id) => !splitSet.has(id))
  const moved = source.memberViewIds.filter((id) => splitSet.has(id))
  if (moved.length === 0 || keep.length === 0) return null
  const next = [...segments]
  next[index] = { ...source, memberViewIds: keep }
  next.splice(index + 1, 0, {
    id: nextSegmentId,
    memberViewIds: moved,
    order: index + 1,
    collapsed: false,
    label: source.label ? `${source.label} · 拆分` : `第 ${index + 2} 段`,
  })
  return next.map((segment, order) => ({ ...segment, order }))
}

export function mergeTrackSegments(
  segments: readonly ContextTrackSegmentV0[],
  sourceId: string,
  targetId: string,
): ContextTrackSegmentV0[] | null {
  if (sourceId === targetId) return null
  const source = segments.find((segment) => segment.id === sourceId)
  const target = segments.find((segment) => segment.id === targetId)
  if (source === undefined || target === undefined) return null
  const targetIds = new Set(target.memberViewIds)
  const merged = [...target.memberViewIds, ...source.memberViewIds.filter((id) => !targetIds.has(id))]
  const next = segments
    .filter((segment) => segment.id !== sourceId)
    .map((segment) => segment.id === targetId ? { ...segment, memberViewIds: merged } : segment)
  return next.map((segment, order) => ({ ...segment, order }))
}

export function removeTrackSegmentMember(
  segments: readonly ContextTrackSegmentV0[],
  segmentId: string,
  memberId: string,
): ContextTrackSegmentV0[] {
  return segments
    .map((segment) => segment.id === segmentId
      ? { ...segment, memberViewIds: segment.memberViewIds.filter((id) => id !== memberId) }
      : segment)
    .filter((segment) => segment.memberViewIds.length > 0)
    .map((segment, order) => ({ ...segment, order }))
}

export function addTrackSegmentMembers(
  segments: readonly ContextTrackSegmentV0[],
  segmentId: string,
  memberIds: readonly string[],
): ContextTrackSegmentV0[] {
  const existing = new Set(segments.flatMap((segment) => segment.memberViewIds))
  const additions = memberIds.filter((id) => !existing.has(id))
  if (additions.length === 0) return [...segments]
  return segments.map((segment) => segment.id === segmentId
    ? { ...segment, memberViewIds: [...segment.memberViewIds, ...additions] }
    : segment)
}


export function insertTrackSegment(
  segments: readonly ContextTrackSegmentV0[],
  atIndex: number,
  memberIds: readonly string[],
  nextSegmentId: string,
  label?: string,
): ContextTrackSegmentV0[] {
  const existing = new Set(segments.flatMap((segment) => segment.memberViewIds))
  const additions = memberIds.filter((id) => !existing.has(id))
  if (additions.length === 0) return [...segments]
  const next = [...segments]
  const index = Math.max(0, Math.min(next.length, atIndex))
  next.splice(index, 0, {
    id: nextSegmentId,
    memberViewIds: additions,
    order: index,
    collapsed: false,
    ...(label ? { label } : { label: `第 ${index + 1} 段` }),
  })
  return next.map((segment, order) => ({ ...segment, order }))
}

/** §6.5：机械密度（成员数，clamp 1-12），不含 AI 语义重要度。 */
export function trackSegmentDensity(segment: Pick<ContextTrackSegmentV0, 'memberViewIds'>): number {
  return Math.max(1, Math.min(12, segment.memberViewIds.length))
}

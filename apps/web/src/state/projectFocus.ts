import type { PresentationEntityRefV0 } from '@local-creative-os/contracts'

export type ProjectFocusLocationKind = 'canvas' | 'collection' | 'context-graph' | 'context' | 'workflow-graph' | 'workflow' | 'workspace'

export interface ProjectFocusLocationCandidate {
  readonly key: string
  readonly kind: ProjectFocusLocationKind
  readonly ownerId?: string
  readonly label: string
  readonly memberViewIds: readonly string[]
  readonly memberEntityRefs?: readonly PresentationEntityRefV0[]
  readonly active?: boolean
}


export interface ProjectFocusSearchEntry {
  readonly key: string
  readonly title: string
  readonly kind: string
  readonly sourceIds: readonly string[]
  readonly keywords?: readonly string[]
}

export function searchProjectFocusEntries(entries: readonly ProjectFocusSearchEntry[], query: string): ProjectFocusSearchEntry[] {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  if (!normalized) return []
  return entries.flatMap((entry) => {
    const title = entry.title.toLocaleLowerCase('zh-CN')
    const kind = entry.kind.toLocaleLowerCase('zh-CN')
    const keywords = (entry.keywords ?? []).join(' ').toLocaleLowerCase('zh-CN')
    const exactTitle = title === normalized
    const titleStarts = title.startsWith(normalized)
    const titleHas = title.includes(normalized)
    const metaHas = kind.includes(normalized) || keywords.includes(normalized)
    if (!titleHas && !metaHas) return []
    return [{ entry, score: exactTitle ? 0 : titleStarts ? 1 : titleHas ? 2 : 3 }]
  }).sort((left, right) => left.score - right.score || left.entry.title.localeCompare(right.entry.title, 'zh-CN'))
    .map(({ entry }) => entry)
}

export interface ProjectFocusLocation extends ProjectFocusLocationCandidate {
  readonly matchedViewIds: readonly string[]
  readonly matchedEntityRefs: readonly PresentationEntityRefV0[]
  readonly matchedCount: number
  readonly totalCount: number
  readonly exact: boolean
}

function refKey(ref: PresentationEntityRefV0): string {
  return `${ref.type}:${ref.id}`
}

const KIND_ORDER: Record<ProjectFocusLocationKind, number> = {
  canvas: 0,
  workspace: 1,
  collection: 2,
  'context-graph': 3,
  context: 4,
  'workflow-graph': 5,
  workflow: 6,
}

/**
 * Focus is read-only navigation over Presentation membership. It never mutates
 * Project Truth and it never infers a Semantic Edge from spatial locality.
 */
export function resolveProjectFocusLocations(input: {
  readonly focusViewIds: readonly string[]
  readonly focusEntityRefs?: readonly PresentationEntityRefV0[]
  readonly candidates: readonly ProjectFocusLocationCandidate[]
}): ProjectFocusLocation[] {
  const focusViews = [...new Set(input.focusViewIds)]
  const focusRefs = [...new Map((input.focusEntityRefs ?? []).map((ref) => [refKey(ref), ref])).values()]
  const totalCount = focusViews.length + focusRefs.length
  if (!totalCount) return []
  const focusViewSet = new Set(focusViews)
  const focusRefSet = new Set(focusRefs.map(refKey))

  return input.candidates.flatMap((candidate) => {
    const matchedViewIds = [...new Set(candidate.memberViewIds)].filter((id) => focusViewSet.has(id))
    const matchedEntityRefs = [...new Map((candidate.memberEntityRefs ?? []).map((ref) => [refKey(ref), ref])).values()]
      .filter((ref) => focusRefSet.has(refKey(ref)))
    const matchedCount = matchedViewIds.length + matchedEntityRefs.length
    if (!matchedCount) return []
    return [{
      ...candidate,
      matchedViewIds,
      matchedEntityRefs,
      matchedCount,
      totalCount,
      exact: matchedCount === totalCount,
    }]
  }).sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1
    if (left.exact !== right.exact) return left.exact ? -1 : 1
    if (left.matchedCount !== right.matchedCount) return right.matchedCount - left.matchedCount
    const kind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    return kind || left.label.localeCompare(right.label, 'zh-CN')
  })
}

import type { SearchHitVNext } from '@local-creative-os/contracts'
import type { CenteredSpatialIndexItem } from '../spatial/centeredSpatialIndex'

export interface ProjectSearchIndexResult {
  readonly key: string
  readonly title: string
  readonly kind: string
  readonly sourceIds?: readonly string[]
  readonly artifactId?: string
  readonly snippet?: string
  readonly chunkAnchor?: string
  readonly source?: string
  readonly score?: number
  readonly conversationId?: string
  readonly matchReason?: SearchHitVNext['matchReason']
  readonly matchModality?: SearchHitVNext['matchModality']
  readonly locationCount?: number
}

export function projectSearchAnchorLabel(anchor: string): string {
  if (anchor.startsWith('section:')) {
    const section = anchor.slice('section:'.length)
    return section ? `§ ${section}` : anchor
  }
  const pdf = /^pdf:p(\d+)(?:-p(\d+))?$/.exec(anchor)
  if (pdf) return pdf[2] === undefined ? `第 ${pdf[1]} 页` : `第 ${pdf[1]}-${pdf[2]} 页`
  const chunk = /^chunk:(\d+)(?:-(\d+))?$/.exec(anchor)
  if (chunk) return chunk[2] === undefined ? `第 ${chunk[1]} 段` : `第 ${chunk[1]}-${chunk[2]} 段`
  return anchor
}

export function projectSearchHumanKind(kind: string): string {
  if (/conversation/i.test(kind)) return '对话'
  if (/context/i.test(kind)) return '上下文'
  if (/workflow/i.test(kind)) return '工作流'
  if (/resource|link|web/i.test(kind)) return '来源'
  if (/note|markdown|text/i.test(kind)) return '文本'
  if (/file/i.test(kind)) return '文件'
  return '项目对象'
}

export function projectSearchResultFromRemote(hit: SearchHitVNext): ProjectSearchIndexResult {
  return {
    key: `${hit.entityType}:${hit.entityId}`,
    title: hit.title,
    kind: hit.entityType,
    ...(hit.entityRef?.viewId || hit.viewId ? { sourceIds: [hit.entityRef?.viewId ?? hit.viewId!] } : {}),
    ...(hit.entityType === 'artifact' ? { artifactId: hit.entityId } : {}),
    ...(hit.entityType === 'conversation' ? { conversationId: hit.entityId } : {}),
    snippet: hit.snippet,
    chunkAnchor: hit.chunkAnchor,
    source: hit.source,
    score: hit.score,
    matchReason: hit.matchReason,
    matchModality: hit.matchModality,
    locationCount: hit.locationCount,
  }
}

export function projectSearchMatchReasonLabel(item: ProjectSearchIndexResult): string | undefined {
  switch (item.matchReason) {
    case 'title': return '名字最接近'
    case 'body': return item.chunkAnchor ? `命中 ${projectSearchAnchorLabel(item.chunkAnchor)}` : '正文命中'
    case 'ocr': return '图中文字'
    case 'semantic': return '语义接近'
    case 'visual': return '画面接近'
    case 'source': return '来源匹配'
    case 'relation': return '关系邻近'
    case 'metadata': return '描述接近'
    default: return undefined
  }
}

function searchResultTone(kind: string): string {
  if (/conversation/i.test(kind)) return '#7b6bd6'
  if (/context/i.test(kind)) return '#6f78c8'
  if (/workflow/i.test(kind)) return '#4f8f86'
  if (/resource|link|web/i.test(kind)) return '#5d84a8'
  if (/file/i.test(kind)) return '#7a8293'
  if (/note|markdown|text/i.test(kind)) return '#8d775d'
  return '#7565a8'
}

export function projectSearchResultIndexItems(
  results: readonly ProjectSearchIndexResult[],
): readonly CenteredSpatialIndexItem[] {
  return results.map((item) => {
    const kind = projectSearchHumanKind(item.kind)
    const reason = projectSearchMatchReasonLabel(item)
    const locations = item.locationCount !== undefined && item.locationCount > 0 ? ` · ${item.locationCount} 处` : ''
    return {
      id: item.key,
      label: `${item.title} · ${kind}${locations}${reason ? ` · ${reason}` : ''}`,
      shortLabel: item.title,
      hint: kind,
      presentation: 'result',
      tone: searchResultTone(item.kind),
      ...(item.locationCount !== undefined && item.locationCount > 1 ? { count: item.locationCount } : {}),
    }
  })
}

export function projectSearchResultForIndexId(
  results: readonly ProjectSearchIndexResult[],
  id: string,
): ProjectSearchIndexResult | null {
  return results.find((item) => item.key === id) ?? null
}

export function mergeProjectSearchResults(
  local: readonly ProjectSearchIndexResult[],
  remote: readonly ProjectSearchIndexResult[],
  limit = 24,
): readonly ProjectSearchIndexResult[] {
  const seen = new Set<string>()
  const merged: ProjectSearchIndexResult[] = []
  for (const item of [...local, ...remote]) {
    const identity = item.sourceIds?.[0]
      ? `view:${item.sourceIds[0]}`
      : item.artifactId
        ? `artifact:${item.artifactId}`
        : item.key
    if (seen.has(identity)) continue
    seen.add(identity)
    merged.push(item)
    if (merged.length >= limit) break
  }
  return merged
}

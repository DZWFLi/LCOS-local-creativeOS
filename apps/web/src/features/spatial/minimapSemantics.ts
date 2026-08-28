import type { CanvasNode } from '../../model'

export type MiniMapVisualKind =
  | 'conversation'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'slide'
  | 'link'
  | 'archive'
  | 'context'
  | 'workflow'
  | 'collection'
  | 'workspace'
  | 'action'
  | 'generic'

function fileIdentity(node: Pick<CanvasNode, 'title' | 'fileType' | 'previewMimeType' | 'sourceKind' | 'previewText' | 'observedPath' | 'subtitle'>): MiniMapVisualKind {
  const name = node.title.toLowerCase()
  const fileType = node.fileType?.toLowerCase() ?? ''
  const mime = node.previewMimeType?.toLowerCase() ?? ''
  if (/\.(mp4|mov|webm|m4v|avi)$/i.test(name) || mime.startsWith('video/')) return 'video'
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name) || mime.startsWith('audio/')) return 'audio'
  if (/\.(ppt|pptx|key)$/i.test(name) || fileType.includes('presentation')) return 'slide'
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(name) || fileType === 'image' || mime.startsWith('image/')) return 'image'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name) || fileType.includes('archive') || mime.includes('zip')) return 'archive'
  const linkLike = [node.previewText, node.observedPath, node.subtitle, node.title].some((value) => value ? /https?:\/\//i.test(value) : false)
  if (linkLike || node.sourceKind === 'url' || ['url', 'link', 'web'].includes(fileType) || mime === 'text/uri-list') return 'link'
  if (/\.pdf$/i.test(name) || fileType.includes('pdf') || /\.(doc|docx|md|markdown|txt|json)$/i.test(name) || mime.startsWith('text/')) return 'document'
  return 'generic'
}

/**
 * MiniMap is a low-fidelity world map, not a second renderer. This classifier
 * preserves only silhouette-level semantic identity; it never reads runtime
 * lifecycle or invents a new entity taxonomy.
 */
export function miniMapVisualKindForNode(node: CanvasNode): MiniMapVisualKind {
  if (node.entityKind === 'conversation') return 'conversation'
  if (node.entityKind === 'context') return 'context'
  if (node.entityKind === 'workflow') return 'workflow'
  if (node.entityKind === 'collection') return 'collection'
  if (node.entityKind === 'workspace') return 'workspace'
  if (node.kind === 'context') return 'collection'
  if (node.kind === 'process') return 'action'
  return fileIdentity(node)
}

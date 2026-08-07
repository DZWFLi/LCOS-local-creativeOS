import { PptxViewer } from '@pagus-kit/react'
import { ExternalLink, FileText, Link2, LoaderCircle, Music, Video } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { CanvasNode } from '../../model'
import { LOCAL_CORE_API_PREFIX } from '../../runtime/localCoreClient'

/**
 * Artifact Viewer Registry (UI-03): one read-only entry for every supported
 * artifact format. Unsupported formats resolve to the honest fallback viewer —
 * never a fake renderer.
 */

export type ArtifactViewerKind =
  | 'image'
  | 'text'
  | 'pdf'
  | 'presentation'
  | 'audio'
  | 'video'
  | 'link'
  | 'fallback'

export interface ArtifactViewerDescriptor {
  readonly kind: ArtifactViewerKind
  readonly label: string
  readonly readOnly: true
}

export const artifactViewerRegistry: Readonly<Record<ArtifactViewerKind, ArtifactViewerDescriptor>> = {
  image: { kind: 'image', label: '图片预览', readOnly: true },
  text: { kind: 'text', label: '文本预览', readOnly: true },
  pdf: { kind: 'pdf', label: 'PDF 只读预览', readOnly: true },
  presentation: { kind: 'presentation', label: 'PPTX 只读预览', readOnly: true },
  audio: { kind: 'audio', label: '音频只读播放', readOnly: true },
  video: { kind: 'video', label: '视频只读播放', readOnly: true },
  link: { kind: 'link', label: '链接卡片', readOnly: true },
  fallback: { kind: 'fallback', label: '文件元数据（只读预览未接入）', readOnly: true },
}

export function resolveArtifactViewerKind(node: CanvasNode): ArtifactViewerKind {
  const fileType = (node.fileType ?? '').toLocaleLowerCase('en-US')
  const title = node.title.toLocaleLowerCase('en-US')
  if (title.endsWith('.link.md') || title.startsWith('link:') || node.previewText?.startsWith('url:')) return 'link'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'image'].includes(fileType)
    || /\.(png|jpe?g|webp|gif|svg)$/.test(title)) return 'image'
  if (fileType === 'pdf' || title.endsWith('.pdf')) return 'pdf'
  if (['ppt', 'pptx', 'presentation'].includes(fileType) || /\.pptx?$/.test(title)) return 'presentation'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(fileType) || /\.(mp3|wav|ogg|m4a|flac)$/.test(title)) return 'audio'
  if (['mp4', 'webm', 'mov', 'mkv'].includes(fileType) || /\.(mp4|webm|mov|mkv)$/.test(title)) return 'video'
  if (['md', 'txt', 'text', 'json', 'yaml', 'yml', 'markdown'].includes(fileType)
    || /\.(md|txt|json|ya?ml)$/.test(title)) return 'text'
  return 'fallback'
}

/** True when a real read-only renderer (not the fallback) is registered for this node. */
export function canPreviewArtifact(node: CanvasNode): boolean {
  return resolveArtifactViewerKind(node) !== 'fallback'
}

export function ArtifactViewerHost({ node, projectId }: { node: CanvasNode; projectId: string }) {
  const kind = resolveArtifactViewerKind(node)
  switch (kind) {
    case 'image': return <ImageViewer node={node} />
    case 'text': return <TextViewer node={node} />
    case 'pdf':
    case 'presentation': return <DocumentViewer node={node} projectId={projectId} />
    case 'audio': return <MediaViewer node={node} projectId={projectId} media="audio" />
    case 'video': return <MediaViewer node={node} projectId={projectId} media="video" />
    case 'link': return <LinkViewer node={node} />
    default: return <FallbackViewer node={node} />
  }
}

function ImageViewer({ node }: { node: CanvasNode }) {
  if (node.previewDataUrl === undefined) {
    return <FallbackViewer node={node} note="缩略图尚未生成；请使用「资源理解」或等待 Preview Worker。" />
  }
  return <div className="viewer-body image-viewer"><img src={node.previewDataUrl} alt={node.title} draggable={false} onDragStart={(event) => event.preventDefault()} /></div>
}

function TextViewer({ node }: { node: CanvasNode }) {
  if (node.previewText === undefined || node.previewText.trim().length === 0) {
    return <FallbackViewer node={node} note="文本内容尚未载入；预览缓存未生成。" />
  }
  return <div className="viewer-body text-viewer"><pre>{node.previewText}</pre></div>
}

function DocumentViewer({ node, projectId }: { node: CanvasNode; projectId: string }) {
  const isPdf = resolveArtifactViewerKind(node) === 'pdf'
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    const load = async () => {
      try {
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(node.fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(detail?.error?.message ?? `Preview request failed (${response.status}).`)
        }
        const bytes = await response.arrayBuffer()
        if (isPdf) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
          setPdfUrl(objectUrl)
        } else setBuffer(bytes)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Preview failed.')
      }
    }
    void load()
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [isPdf, node.fileRecordId, projectId])

  if (error) return <div className="viewer-body viewer-error"><strong>无法预览</strong><span>{error}</span></div>
  if (isPdf) {
    return <div className="viewer-body pdf-viewer">{pdfUrl ? <iframe title={`${node.title} PDF 预览`} src={pdfUrl} /> : <div className="viewer-loading"><LoaderCircle size={20} />正在载入 PDF…</div>}</div>
  }
  return <div className="viewer-body pptx-viewer">{buffer ? <PptxViewer file={buffer} useGoogleFonts={false} useEmbeddedFonts onError={(reason) => setError(reason.message)} /> : <div className="viewer-loading"><LoaderCircle size={20} />正在解析 PPTX…</div>}</div>
}

function MediaViewer({ node, projectId, media }: { node: CanvasNode; projectId: string; media: 'audio' | 'video' }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    const load = async () => {
      try {
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(node.fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Preview request failed (${response.status}).`)
        objectUrl = URL.createObjectURL(await response.blob())
        setUrl(objectUrl)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Preview failed.')
      }
    }
    void load()
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [node.fileRecordId, projectId])

  if (error) return <div className="viewer-body viewer-error"><strong>无法预览</strong><span>{error}</span></div>
  if (!url) return <div className="viewer-body viewer-loading"><LoaderCircle size={20} />正在载入{media === 'audio' ? '音频' : '视频'}…</div>
  const Icon = media === 'audio' ? Music : Video
  return <div className="viewer-body media-viewer"><Icon size={18} />{media === 'audio' ? <audio controls src={url} /> : <video controls src={url} />}</div>
}

function LinkViewer({ node }: { node: CanvasNode }) {
  const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
  return <div className="viewer-body link-viewer">
    <Link2 size={20} />
    <strong>{node.title}</strong>
    {node.subtitle ? <p>{node.subtitle}</p> : null}
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">{url} <ExternalLink size={12} /></a> : <small>未提取到外部 URL</small>}
  </div>
}

function FallbackViewer({ node, note }: { node: CanvasNode; note?: string }) {
  return <div className="viewer-body fallback-viewer">
    <FileText size={20} />
    <strong>{node.title}</strong>
    <dl>
      <dt>类型</dt><dd>{node.fileType ?? node.kind}</dd>
      <dt>Revision</dt><dd>{node.revisionId ?? '—'}</dd>
      <dt>预览状态</dt><dd>{node.previewStatus ?? 'not-generated'}</dd>
      <dt>文件可用性</dt><dd>{node.fileAvailability ?? '—'}</dd>
    </dl>
    <small>{note ?? '该格式只读预览未接入；文件仍可导入、分析与参与 Run。'}</small>
  </div>
}

/**
 * Editor Host contract (UI-04): Alpha 不实现编辑器。未来的 Script/Storyboard
 * Editor 必须通过 Local Core 产生 Working/Draft Revision，绝不直接写源文件。
 */
export interface ArtifactEditorHost {
  readonly supportedViewerKinds: readonly ArtifactViewerKind[]
  readonly readOnly: false
}

export const artifactEditorHost: ArtifactEditorHost | null = null

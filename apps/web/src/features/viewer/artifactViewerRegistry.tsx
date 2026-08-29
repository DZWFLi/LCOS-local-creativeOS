import { parse as parsePptx } from '@pagus-kit/core'
import { renderSlide } from '@pagus-kit/renderer'
import { ExternalLink, FileText, Link2, LoaderCircle, Music, Video } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { DragEvent as ReactDragEvent, ReactNode } from 'react'

import type { CanvasNode } from '../../model'
import { LOCAL_CORE_API_PREFIX } from '../../runtime/localCoreClient'
import { decodeTextBuffer } from '../shell/appShell'
import { OcrImage } from '../ocr/OcrImage'
import { LCOS_FRAGMENT_CLIPBOARD_MIME, serializeFragmentClipboard, type LcosFragmentClipboardV0 } from '../../state/fragmentClipboard'
import { LCOS_MATERIAL_TRANSFER_MIME, serializeMaterialTransfer, writeMaterialTransfer, type MaterialSourceV1, type MaterialTransferPayloadV1 } from '../../state/materialTransfer'
import { PdfViewer, SelectionDropHandle } from './PdfViewer'

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
  // Conversation is a first-class project subcanvas. The generic artifact Reader
  // must never become its primary body, even when a markdown transcript stub exists.
  if (node.entityKind === 'conversation') return 'fallback'
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
    case 'image': return <ImageViewer node={node} projectId={projectId} />
    case 'text': return <TextViewer node={node} projectId={projectId} />
    case 'pdf':
    case 'presentation': return <DocumentViewer node={node} projectId={projectId} />
    case 'audio': return <MediaViewer node={node} projectId={projectId} media="audio" />
    case 'video': return <MediaViewer node={node} projectId={projectId} media="video" />
    case 'link': return <LinkViewer node={node} />
    default: return <FallbackViewer node={node} />
  }
}

function ImageViewer({ node, projectId }: { node: CanvasNode; projectId: string }) {
  const [url, setUrl] = useState<string | null>(node.previewDataUrl ?? null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (node.fileRecordId === undefined) {
      if (node.previewDataUrl !== undefined) {
        setUrl(node.previewDataUrl)
        return
      }
      setError('该节点没有可读取的文件记录。')
      return
    }
    const controller = new AbortController()
    let objectUrl: string | undefined
    const load = async () => {
      try {
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(node.fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(detail?.error?.message ?? `预览请求失败 (${response.status})`)
        }
        objectUrl = URL.createObjectURL(await response.blob())
        setUrl(objectUrl)
      } catch (reason) {
        if (!controller.signal.aborted) {
          // 原图不可用时退回预览缩略图。
          if (node.previewDataUrl !== undefined) setUrl(node.previewDataUrl)
          else setError(reason instanceof Error ? reason.message : '预览失败')
        }
      }
    }
    void load()
    return () => { controller.abort(); if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl) }
  }, [node.fileRecordId, node.previewDataUrl, projectId])

  if (error) return <div className="viewer-body viewer-error"><strong>无法预览</strong><span>{error}</span></div>
  if (url === null) return <div className="viewer-body viewer-loading"><LoaderCircle size={20} />正在载入图片…</div>
  return <div className="viewer-body image-viewer"><ImageZoomStage artifactId={node.artifactId} src={url} alt={node.title} /></div>
}

const ZOOM_MIN = 0.2
const ZOOM_MAX = 8

/** 图片预览自由缩放：滚轮以鼠标位置为锚点缩放，拖拽平移，双击/按钮复位。 */
function ImageZoomStage({ artifactId, src, alt }: { artifactId?: string | null; src: string; alt: string }) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const interactedRef = useRef(false)
  const fitAttemptRef = useRef(0)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const commit = useCallback((nextScale: number, nextPan: { x: number; y: number }) => {
    scaleRef.current = nextScale
    panRef.current = nextPan
    setScale(nextScale)
    setPan(nextPan)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      interactedRef.current = true
      const rect = stage.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15
      const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scaleRef.current * factor))
      const worldX = (px - panRef.current.x) / scaleRef.current
      const worldY = (py - panRef.current.y) / scaleRef.current
      commit(nextScale, { x: px - worldX * nextScale, y: py - worldY * nextScale })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [commit])

  const scheduleFit = useCallback(() => {
    const stage = stageRef.current
    const img = imgRef.current
    if (!stage || !img || interactedRef.current) return
    // 布局未就绪（clientWidth=0）时若直接 fit 会算出 scale(0)，图片不可见；
    // 延迟到尺寸可用再适配，最多重试 5 次。
    if (stage.clientWidth <= 0 || img.naturalWidth <= 0) {
      if (fitAttemptRef.current >= 5) return
      fitAttemptRef.current += 1
      window.setTimeout(scheduleFit, 80)
      return
    }
    fitAttemptRef.current = 0
    const cw = stage.clientWidth
    const ch = stage.clientHeight
    const nw = img.naturalWidth || 1
    const nh = img.naturalHeight || 1
    const fit = Math.max(ZOOM_MIN, Math.min(cw / nw, ch / nh, 1))
    // 默认居中：contain 完整显示或 100% 居中裁切都居中摆放。
    commit(fit, { x: (cw - nw * fit) / 2, y: (ch - nh * fit) / 2 })
  }, [commit])

  const handleImgLoad = useCallback(() => scheduleFit(), [scheduleFit])

  const zoomBy = useCallback((factor: number) => {
    interactedRef.current = true
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const px = rect.width / 2
    const py = rect.height / 2
    const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scaleRef.current * factor))
    const worldX = (px - panRef.current.x) / scaleRef.current
    const worldY = (py - panRef.current.y) / scaleRef.current
    commit(nextScale, { x: px - worldX * nextScale, y: py - worldY * nextScale })
  }, [commit])

  const reset = useCallback(() => {
    const stage = stageRef.current
    const img = imgRef.current
    if (!stage || !img) { commit(1, { x: 0, y: 0 }); return }
    const nw = img.naturalWidth || 1
    const nh = img.naturalHeight || 1
    commit(1, { x: (stage.clientWidth - nw) / 2, y: (stage.clientHeight - nh) / 2 })
  }, [commit])

  return (
    <div
      ref={stageRef}
      className={`lcos-image-zoom-stage ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        interactedRef.current = true
        dragRef.current = { startX: event.clientX, startY: event.clientY, baseX: panRef.current.x, baseY: panRef.current.y }
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        commit(scaleRef.current, { x: drag.baseX + event.clientX - drag.startX, y: drag.baseY + event.clientY - drag.startY })
      }}
      onPointerUp={(event) => {
        dragRef.current = null
        setDragging(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onDoubleClick={reset}
      title="滚轮缩放 · 拖拽平移 · 双击复位"
    >
      <div className="lcos-image-zoom-pan" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
        <OcrImage imgRef={imgRef} artifactId={artifactId} src={src} alt={alt} draggable={false} onLoad={handleImgLoad} onDragStart={(event) => event.preventDefault()} />
      </div>
      <div className="lcos-image-zoom-toolbar" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="缩小" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="放大" onClick={() => zoomBy(1.25)}>＋</button>
        <button type="button" className="reset" onClick={reset}>复位</button>
      </div>
    </div>
  )
}

function materialSourceForNode(node: CanvasNode, projectId: string, locator?: MaterialSourceV1['locator']): MaterialSourceV1 {
  return {
    projectId,
    viewId: node.id,
    title: node.title,
    ...(node.artifactId ? { artifactId: node.artifactId } : {}),
    ...(node.revisionId ? { revisionId: node.revisionId } : {}),
    ...(node.fileRecordId ? { fileRecordId: node.fileRecordId } : {}),
    ...(node.sourceKind ? { sourceKind: node.sourceKind } : {}),
    ...(locator ? { locator } : {}),
  }
}

function TextViewer({ node, projectId }: { node: CanvasNode; projectId: string }) {
  const [text, setText] = useState<string | null>(node.previewText && node.previewText.trim().length > 0 ? node.previewText : null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const documentRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (node.previewText && node.previewText.trim().length > 0) {
      setText(node.previewText)
      return
    }
    const controller = new AbortController()
    const load = async () => {
      try {
        // managed artifact（如对话转写 markdown）：投影节点只带 artifactId 时，
        // 经 artifact revision 表解析 fileRecordId 再读正文（批十四「查看对话」阅读链）。
        let fileRecordId = node.fileRecordId
        if (fileRecordId === undefined && node.artifactId !== undefined) {
          const revResponse = await fetch(`${LOCAL_CORE_API_PREFIX}/artifacts/${encodeURIComponent(String(node.artifactId))}/revisions`, { signal: controller.signal })
          if (!revResponse.ok) throw new Error(`版本列表请求失败 (${revResponse.status})`)
          const payload = await revResponse.json() as { ok?: boolean; value?: readonly { fileRecordId?: string; status?: string }[] }
          const current = payload.value?.find((entry) => entry.status === 'current') ?? payload.value?.[0]
          fileRecordId = current?.fileRecordId
        }
        if (fileRecordId === undefined) {
          setError('该节点没有可读取的文件记录。')
          return
        }
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(detail?.error?.message ?? `预览请求失败 (${response.status})`)
        }
        // 智能解码：UTF-8 严格探测 → GBK 回退（Windows 记事本 ANSI）→ latin1，避免中文 txt 乱码。
        setText(decodeTextBuffer(await response.arrayBuffer()))
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '预览失败')
      }
    }
    void load()
    return () => controller.abort()
  }, [node.artifactId, node.fileRecordId, node.previewText, projectId])

  const lines = useMemo(() => text?.replace(/\r/g, '').split('\n') ?? [], [text])
  const headings = useMemo(() => lines.flatMap((line, index) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    return match ? [{ index, depth: match[1].length, label: match[2].trim() }] : []
  }), [lines])
  const matchCount = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return 0
    return lines.reduce((total, line) => total + (line.toLocaleLowerCase().includes(needle) ? 1 : 0), 0)
  }, [lines, query])

  if (error) return <div className="viewer-body viewer-error"><strong>无法预览</strong><span>{error}</span></div>
  if (text === null) return <div className="viewer-body viewer-loading"><LoaderCircle size={20} />正在载入文本…</div>
  return <div className="viewer-body text-viewer lcos-text-reader">
    <aside className="lcos-text-reader-nav">
      <label><span>搜索</span><input value={query} placeholder="在文档中查找" onChange={(event) => setQuery(event.target.value)}/>{query.trim() && <small>{matchCount} 处</small>}</label>
      {headings.length > 0 && <nav aria-label="文档目录"><strong>目录</strong>{headings.slice(0, 48).map((heading) => <button key={`${heading.index}:${heading.label}`} type="button" style={{ paddingLeft: `${8 + (heading.depth - 1) * 10}px` }} onClick={() => document.getElementById(`text-line-${heading.index}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{heading.label}</button>)}</nav>}
    </aside>
    <article
      ref={documentRef}
      className="lcos-text-reader-document"
      tabIndex={0}
      onCopy={(event) => {
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() ?? ''
        if (!selectedText || !event.clipboardData) return
        const lineForNode = (value: Node | null): number | null => {
          if (!value) return null
          const element = value.nodeType === Node.ELEMENT_NODE ? value as Element : value.parentElement
          const row = element?.closest<HTMLElement>('[data-line]')
          const parsed = row?.dataset.line === undefined ? Number.NaN : Number(row.dataset.line)
          return Number.isFinite(parsed) ? parsed : null
        }
        const start = lineForNode(selection?.anchorNode ?? null)
        const end = lineForNode(selection?.focusNode ?? null)
        const lineStart = start === null || end === null ? null : Math.min(start, end)
        const lineEnd = start === null || end === null ? null : Math.max(start, end)
        const nearestHeading = lineStart === null
          ? undefined
          : [...headings].reverse().find((heading) => heading.index <= lineStart)?.label
        const payload: LcosFragmentClipboardV0 = {
          schemaVersion: 0,
          kind: 'fragment',
          contentType: 'text',
          text: selectedText,
          copiedAt: new Date().toISOString(),
          source: {
            projectId,
            viewId: node.id,
            title: node.title,
            ...(node.artifactId ? { artifactId: node.artifactId } : {}),
            ...(node.revisionId ? { revisionId: node.revisionId } : {}),
            ...(node.fileRecordId ? { fileRecordId: node.fileRecordId } : {}),
            ...(node.sourceKind ? { sourceKind: node.sourceKind } : {}),
            ...(lineStart === null || lineEnd === null ? {} : { locator: { kind: 'lines' as const, start: lineStart, end: lineEnd, ...(nearestHeading ? { label: nearestHeading } : {}) } }),
          },
        }
        const materialPayload: MaterialTransferPayloadV1 = {
          schemaVersion: 1,
          kind: 'material-transfer',
          capturedAt: payload.copiedAt,
          source: materialSourceForNode(node, projectId, lineStart === null || lineEnd === null ? { kind: 'selection' } : { kind: 'lines', start: lineStart, end: lineEnd, ...(nearestHeading ? { label: nearestHeading } : {}) }),
          content: { kind: 'text', text: selectedText },
        }
        event.preventDefault()
        event.clipboardData.setData('text/plain', selectedText)
        event.clipboardData.setData(LCOS_MATERIAL_TRANSFER_MIME, serializeMaterialTransfer(materialPayload))
        // V0 compatibility: older LCOS tabs can still understand the fragment MIME.
        event.clipboardData.setData(LCOS_FRAGMENT_CLIPBOARD_MIME, serializeFragmentClipboard(payload))
      }}
    >
      {lines.map((line, index) => <TextReaderLine key={index} line={line} index={index} query={query}/>) }
    </article>
    <SelectionDropHandle containerRef={documentRef} source={() => materialSourceForNode(node, projectId, { kind: 'selection' })}/>
  </div>
}

function TextReaderLine({ line, index, query }: { line: string; index: number; query: string }) {
  const heading = line.match(/^(#{1,3})\s+(.+)$/)
  const list = line.match(/^\s*[-*]\s+(.+)$/)
  const quote = line.match(/^\s*>\s?(.*)$/)
  const code = /^\s{4}/.test(line) || /^```/.test(line)
  const content = heading?.[2] ?? list?.[1] ?? quote?.[1] ?? line
  const rendered = highlightReaderMatch(content || ' ', query)
  if (heading) {
    const Tag = (`h${Math.min(3, heading[1].length + 1)}`) as 'h2' | 'h3' | 'h4'
    return <Tag id={`text-line-${index}`} data-line={index}>{rendered}</Tag>
  }
  if (list) return <div id={`text-line-${index}`} className="reader-list" data-line={index}><i/> <span>{rendered}</span></div>
  if (quote) return <blockquote id={`text-line-${index}`} data-line={index}>{rendered}</blockquote>
  if (code) return <code id={`text-line-${index}`} className="reader-code" data-line={index}>{rendered}</code>
  if (!line.trim()) return <span id={`text-line-${index}`} className="reader-space" data-line={index} aria-hidden="true" />
  return <p id={`text-line-${index}`} data-line={index}>{rendered}</p>
}

function highlightReaderMatch(text: string, query: string) {
  const needle = query.trim()
  if (!needle) return text
  const lower = text.toLocaleLowerCase()
  const target = needle.toLocaleLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let matchIndex = lower.indexOf(target, cursor)
  let key = 0
  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex))
    parts.push(<mark key={key++}>{text.slice(matchIndex, matchIndex + needle.length)}</mark>)
    cursor = matchIndex + needle.length
    matchIndex = lower.indexOf(target, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function DocumentViewer({ node, projectId }: { node: CanvasNode; projectId: string }) {
  const isPdf = resolveArtifactViewerKind(node) === 'pdf'
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [error, setError] = useState('')
  // 字节视图保持引用稳定，避免 <Document> 因 file prop 变化无谓重载。
  const pdfData = useMemo(() => (buffer === null ? null : new Uint8Array(buffer)), [buffer])
  // PDF 材料溯源工厂：页拖拽 / 选区提取时随 PdfViewer 一起带上节点出处。
  const pdfMaterialSource = useCallback((locator?: MaterialSourceV1['locator']) => materialSourceForNode(node, projectId, locator), [node, projectId])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        // managed artifact（如对话转写 markdown）：投影节点只带 artifactId 时，
        // 经 artifact revision 表解析 fileRecordId 再读正文（批十四「查看对话」阅读链）。
        let fileRecordId = node.fileRecordId
        if (fileRecordId === undefined && node.artifactId !== undefined) {
          const revResponse = await fetch(`${LOCAL_CORE_API_PREFIX}/artifacts/${encodeURIComponent(String(node.artifactId))}/revisions`, { signal: controller.signal })
          if (!revResponse.ok) throw new Error(`版本列表请求失败 (${revResponse.status})`)
          const payload = await revResponse.json() as { ok?: boolean; value?: readonly { fileRecordId?: string; status?: string }[] }
          const current = payload.value?.find((entry) => entry.status === 'current') ?? payload.value?.[0]
          fileRecordId = current?.fileRecordId
        }
        if (fileRecordId === undefined) {
          setError('该节点没有可读取的文件记录。')
          return
        }
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(detail?.error?.message ?? `Preview request failed (${response.status}).`)
        }
        setBuffer(await response.arrayBuffer())
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Preview failed.')
      }
    }
    void load()
    return () => controller.abort()
  }, [node.fileRecordId, projectId])

  if (error) return <div className="viewer-body viewer-error"><strong>无法预览</strong><span>{error}</span></div>
  if (!buffer || pdfData === null) return <div className="viewer-body viewer-loading"><LoaderCircle size={20} />正在载入{isPdf ? ' PDF' : ' PPTX'}…</div>
  return isPdf
    ? <PdfViewer url={pdfData} fileName={node.title} materialSource={pdfMaterialSource} />
    : <PptMaterialViewer node={node} projectId={projectId} buffer={buffer} />
}

function PptMaterialViewer({ node, projectId, buffer }: { node: CanvasNode; projectId: string; buffer: ArrayBuffer }) {
  const [slides, setSlides] = useState<string[]>([])
  const [slideNumber, setSlideNumber] = useState(1)
  const [error, setError] = useState('')
  const stageRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const presentation = await parsePptx(buffer)
        if (cancelled) return
        const rendered = presentation.slides.map((slide) => renderSlide(slide, presentation.slideSize).svg)
        setSlides(rendered)
        setSlideNumber((current) => Math.min(Math.max(1, current), Math.max(1, rendered.length)))
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'PPTX 解析失败')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [buffer])

  const startSlideDrag = useCallback((event: ReactDragEvent<HTMLElement>, page: number, svg: string) => {
    const payload: MaterialTransferPayloadV1 = {
      schemaVersion: 1,
      kind: 'material-transfer',
      capturedAt: new Date().toISOString(),
      source: materialSourceForNode(node, projectId, { kind: 'slide', slideNumber: page, label: `第 ${page} 页` }),
      content: { kind: 'presentation-slide', slideNumber: page, svg },
    }
    writeMaterialTransfer(event.dataTransfer, payload)
  }, [node, projectId])

  if (error) return <div className="viewer-body viewer-error"><strong>PPTX 解析失败</strong><span>{error}</span></div>
  if (!slides.length) return <div className="viewer-body viewer-loading"><LoaderCircle size={20}/>正在解析 PPTX…</div>
  const currentSvg = slides[slideNumber - 1] ?? slides[0]

  return <div className="viewer-body lcos-page-viewer lcos-ppt-material-viewer">
    <aside className="lcos-page-rail" aria-label="PPT 页面">
      <div className="lcos-page-rail-heading"><strong>{slides.length} 页</strong><small>拖一页到画布</small></div>
      {slides.map((svg, index) => {
        const page = index + 1
        return <button
          key={page}
          type="button"
          className={`lcos-page-thumb lcos-slide-thumb ${page === slideNumber ? 'is-current' : ''}`}
          onClick={() => setSlideNumber(page)}
          draggable
          onDragStart={(event) => startSlideDrag(event, page, svg)}
          aria-label={`第 ${page} 页，拖到画布可提取`}
        >
          <span className="lcos-slide-svg" dangerouslySetInnerHTML={{ __html: svg }}/>
          <span>{page}</span>
        </button>
      })}
    </aside>
    <main ref={stageRef} className="lcos-page-stage">
      <div className="lcos-page-stage-toolbar"><span>第 {slideNumber} / {slides.length} 页</span><small>页面文字可直接选择；缩略页可拖出</small></div>
      <motion.div key={slideNumber} className="lcos-page-sheet lcos-slide-sheet" initial={{ opacity: .65, y: 4 }} animate={{ opacity: 1, y: 0 }} dangerouslySetInnerHTML={{ __html: currentSvg }}/>
      <SelectionDropHandle containerRef={stageRef} source={() => materialSourceForNode(node, projectId, { kind: 'slide', slideNumber, label: `第 ${slideNumber} 页选区` })}/>
    </main>
  </div>
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
  // docx 预览缺口裁定（0.1 收口）：Word/Excel 只读预览不进 0.1（mammoth 未安装，收尾不新增依赖），
  // fallback 保持诚实告知——对 Office 文档点名说明「预览未接入但文件完整可用」，其余未知格式沿用通用文案。
  const isOfficeDoc = /\.(docx?|xlsx?)$/i.test(node.title) || /(wordprocessingml|spreadsheetml)/i.test(node.fileType ?? '')
  return <div className="viewer-body fallback-viewer">
    <FileText size={20} />
    <strong>{node.title}</strong>
    <dl>
      <dt>类型</dt><dd>{node.fileType ?? node.kind}</dd>
      <dt>版本</dt><dd>{node.revisionLabel ?? (node.revisionId ? '已有保存版本' : '—')}</dd>
      <dt>预览状态</dt><dd>{node.previewStatus === 'ready' ? '可预览' : node.previewStatus === 'failed' ? '预览失败' : '等待预览'}</dd>
      <dt>文件状态</dt><dd>{node.fileAvailability === 'stale' ? '外部文件有变化' : node.fileAvailability === 'missing' ? '原文件暂时找不到' : node.fileAvailability ? '可用' : '—'}</dd>
    </dl>
    <small>{note ?? (isOfficeDoc
      ? 'Word/Excel 文档预览暂未接入（列入后续版本）；文件已完整导入，仍可参与分析和执行。'
      : '该格式只读预览未接入；文件仍可导入、分析并参与执行。')}</small>
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

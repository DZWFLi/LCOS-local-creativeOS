import {
  History,
  ImageOff,
  Info,
  LayoutGrid,
  LocateFixed,
  Network,
} from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { CanvasNode, NodeDisplayMode, RunStatus } from '../../model'
import { runStatusLabel } from '../../model'
import { MindMapNoteVisual } from './MindMapNoteVisual'
import { CrepeHost } from './markdownPreview'
import { registerNodeCard, resolveNodeCard } from './nodeCardRegistry'
import { visualFamilyFor } from '../presentation/visualFamily'
import { ConversationGlyth, ConversationGlythIdentityPin, conversationActivityScore } from '../conversations/ConversationGlyth'
import { glythSemanticLodForZoom, type GlythSemanticLod } from '../spatial/glythSemanticLod'
import { glythStateFromSessionPhase } from '../conversations/conversationLifecycle'
import { additiveSelectionModifier } from '../spatial/pointerInteractionLanguage'
import { OcrImage } from '../ocr/OcrImage'
import { documentOutlinePreview, documentSemanticLevel, type DocumentSemanticLevel } from '../spatial/documentSemanticZoom'
import {
  ArchiveGlyph,
  AudioGlyph,
  CollectionGlyph,
  DecisionGlyph,
  DocumentGlyph,
  ImageGlyph,
  LinkGlyph,
  NoteGlyph,
  RunGlyph,
  SessionGlyph,
  VideoGlyph,
} from '../design/LcosGlyphs'

export interface Props {
  node: CanvasNode
  density: NodeDisplayMode
  runId: string
  runStatus: RunStatus | null
  pending: boolean
  onDetails: () => void
  showDetails: boolean
  /** Surface projections reuse the same material face but suppress nested controls. */
  showControls?: boolean
  /** GUI-6：锚定备注的「定位」动作（由宿主把相机移到锚点目标）。 */
  onLocate?: (node: CanvasNode) => void
  collectionExpanded?: boolean
  collectionMembers?: readonly CanvasNode[]
  onCollectionMemberSelect?: (id: string, additive?: boolean) => void
  selected?: boolean
  /** World camera zoom for document Semantic Zoom. Surface renderers may omit it. */
  zoom?: number
  onOpenContextLens?: (node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => void
  /** R2-B: camera-driven Conversation presentation only; never Core truth. */
  glythLod?: GlythSemanticLod
  /** selected / active / Focus/Search target stays independent at extreme-far. */
  glythCritical?: boolean
}

export type NodeVisualFamily = 'reference' | 'document' | 'note' | 'context' | 'process' | 'decision' | 'result-slot'
export type FileIdentity = 'image' | 'video' | 'audio' | 'pdf' | 'ppt' | 'markdown' | 'link' | 'archive' | 'file'

export function nodeVisualFamily(node: CanvasNode): NodeVisualFamily {
  if (node.resultSlotId && (node.resultSlotStatus !== 'materialized' || !node.artifactId)) return 'result-slot'
  const visual = visualFamilyFor({
    artifactKind: node.fileType,
    mimeType: node.previewMimeType,
    fileType: node.fileType,
    title: node.title,
    subtitle: node.subtitle,
    kind: node.kind,
    artifactId: node.artifactId,
    sourceRunId: node.sourceRunId,
    managed: node.managed,
    sourceKind: node.sourceKind,
    observedPath: node.observedPath,
  })
  if (visual === 'conversation' || visual === 'skill' || visual === 'output') return 'document'
  if (node.kind === 'process') return 'process'
  if (node.kind === 'context') return 'context'
  if (node.kind === 'decision') return 'decision'
  // Managed Text/Markdown is a Project Material, not a separate icon-only Note species.
  // Anchored/Core notes keep the note anatomy because their semantics are annotations.
  if (node.kind === 'note') return node.managed && node.artifactId ? 'document' : 'note'
  return detectFileIdentity(node) === 'image' ? 'reference' : 'document'
}

export const CanvasNodeVisual = memo(function CanvasNodeVisual(props: Props) {
  if (props.node.entityKind === 'conversation') {
    const ConversationCard = resolveNodeCard(props.node)
    if (ConversationCard) return <ConversationCard {...props} />
  }
  const family = nodeVisualFamily(props.node)
  if (family === 'result-slot') return <ResultSlotObject {...props} />
  if (family === 'process') return <RunObject {...props} />
  if (family === 'context') {
    // §4.7 卡片 Registry（context 族已全量入表，20260826 做实）：查表即分发；
    // 未注册的 entityKind 回落 CollectionObject——行为兜底，非错误路径。
    const RegistryCard = resolveNodeCard(props.node)
    if (RegistryCard) return <RegistryCard {...props} />
    return <CollectionObject {...props} />
  }
  if (family === 'decision') return <DecisionObject {...props} />
  if (family === 'note') return <NoteObject {...props} />
  return <ContentObject {...props} />
}, (previous, next) => (
  previous.node === next.node
  && previous.density === next.density
  && previous.runId === next.runId
  && previous.runStatus === next.runStatus
  && previous.pending === next.pending
  && previous.showDetails === next.showDetails
  && previous.showControls === next.showControls
  && previous.collectionExpanded === next.collectionExpanded
  && previous.collectionMembers === next.collectionMembers
  && previous.selected === next.selected
  && previous.zoom === next.zoom
  && previous.onOpenContextLens === next.onOpenContextLens
  && previous.glythLod === next.glythLod
  && previous.glythCritical === next.glythCritical
))


function ResultSlotObject({ node }: Props) {
  const status = node.resultSlotStatus ?? 'empty'
  const label = status === 'running' ? '生成中' : status === 'review' ? '等待确认' : status === 'materialized' ? '已物化' : '空白结果'
  return <div className={`lcos-result-slot-body is-${status}`} data-result-slot-id={node.resultSlotId} data-result-slot-status={status}>
    <span className="lcos-result-slot-corner is-tl" aria-hidden="true"/>
    <span className="lcos-result-slot-corner is-tr" aria-hidden="true"/>
    <span className="lcos-result-slot-corner is-bl" aria-hidden="true"/>
    <span className="lcos-result-slot-corner is-br" aria-hidden="true"/>
    <div className="lcos-result-slot-center">
      <i aria-hidden="true"/>
      <strong>{label}</strong>
      <small>{status === 'empty' ? '结果类型由接受的 Return 决定' : node.title}</small>
    </div>
  </div>
}

function ContentObject({ node, density, pending, onDetails, showDetails, showControls = true, selected, zoom }: Props) {
  const kind = detectFileIdentity(node)
  if (kind === 'image') return <ImageObject node={node} pending={pending} onDetails={onDetails} showDetails={showDetails} showControls={showControls} />
  if (kind === 'link') return <LinkObject node={node} pending={pending} onDetails={onDetails} showDetails={showDetails} showControls={showControls} />
  if (kind === 'video') return <MediaObject node={node} kind="video" onDetails={onDetails} showDetails={showDetails} showControls={showControls} />
  if (kind === 'audio') return <MediaObject node={node} kind="audio" onDetails={onDetails} showDetails={showDetails} showControls={showControls} />
  return <DocumentObject node={node} kind={kind} density={density} pending={pending} onDetails={onDetails} showDetails={showDetails} showControls={showControls} selected={selected} zoom={zoom} />
}

/** 图片加载三态（纯状态机）：loading → ready/error；retry/reset 通过 key 重置重新加载。 */
export type ImageLoadPhase = 'loading' | 'ready' | 'error'
export type ImageLoadEvent = 'load' | 'error' | 'retry' | 'reset'

export function nextImageLoadPhase(_phase: ImageLoadPhase, event: ImageLoadEvent): ImageLoadPhase {
  if (event === 'load') return 'ready'
  if (event === 'error') return 'error'
  return 'loading'
}

function ImageObject({ node, pending, onDetails, showDetails, showControls = true }: Pick<Props, 'node' | 'pending' | 'onDetails' | 'showDetails' | 'showControls'>) {
  const src = node.previewDataUrl ?? node.previewUrl
  const title = displayNodeTitle(node)
  const secondary = nodeSecondaryLine(node)
  // 债2：图片三态——loading 骨架 / ready 正常 / error 兜底（可重试，key 重置重载）。
  const [phase, setPhase] = useState<ImageLoadPhase>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setPhase('loading') }, [src])
  return <div className={`lcos-object lcos-image-object lcos-material-face lcos-node-dot-identity is-${phase}`} data-image-phase={phase} title={node.title}>
    {!src ? <div className="lcos-image-fallback"><ImageOff size={24}/></div>
      : phase === 'error'
        ? <div className="lcos-image-fallback lcos-image-error" role="alert">
          <ImageOff size={22}/>
          <small>图片加载失败</small>
          <button type="button" className="lcos-image-retry" aria-label={`重试加载 ${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setPhase((current) => nextImageLoadPhase(current, 'retry')); setAttempt((current) => current + 1) }}>重试</button>
        </div>
        : <>
          <OcrImage key={`${src}#${attempt}`} artifactId={node.artifactId} ocrEnabled={false} src={src} alt={title} draggable={false}
            onLoad={() => setPhase((current) => nextImageLoadPhase(current, 'load'))}
            onError={() => setPhase((current) => nextImageLoadPhase(current, 'error'))}
            onDragStart={(event) => event.preventDefault()}/>
          {phase === 'loading' && <span className="lcos-image-skeleton" aria-hidden="true"><i/><i/><i/></span>}
        </>}
    <div className="lcos-image-caption lcos-material-caption lcos-material-body"><strong>{title}</strong>{secondary && <small>{secondary}</small>}</div>
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function DocumentObject({ node, kind, density, pending, onDetails, showDetails, showControls = true, selected, zoom }: Pick<Props, 'node' | 'density' | 'pending' | 'onDetails' | 'showDetails' | 'showControls' | 'selected' | 'zoom'> & { kind: FileIdentity }) {
  const tag = kind === 'markdown' ? 'TEXT' : kind === 'ppt' ? 'PPT' : kind === 'pdf' ? 'PDF' : kind === 'archive' ? 'ZIP' : fileExtension(node.title) || 'FILE'
  // 文本类（markdown）统一编辑体系统一：就地编辑保存的 noteBody 优先于服务器 previewText，
  // 富文本（**粗体**/==高光==/# 标题）即刻渲染在卡片上，而不是退回纸片。
  const preview = node.noteBody?.trim() || node.previewText?.trim()
  const thumbnailCandidate = node.previewDataUrl ?? node.previewUrl
  const thumbnail = thumbnailCandidate && (node.previewMimeType?.startsWith('image/') || thumbnailCandidate.startsWith('data:image/')) ? thumbnailCandidate : null
  const title = displayNodeTitle(node)
  const secondary = nodeSecondaryLine(node)
  const mindmap = kind === 'markdown' && node.noteLayout === 'mindmap'
  const readableText = kind === 'markdown' && Boolean(preview)
  const semanticLevel = kind === 'markdown' ? documentSemanticLevel({ density, ...(zoom === undefined ? {} : { zoom }), selected }) : null

  return <div data-document-semantic-level={semanticLevel ?? undefined} className={`lcos-object lcos-document-object lcos-material-face lcos-node-dot-identity file-${kind} ${mindmap || readableText ? 'is-direct-reading' : 'is-collapsed-material'}`} title={node.title}>
    {mindmap
      ? <MindMapNoteVisual node={node} density={density}/>
      : thumbnail && !preview
        ? <div className="lcos-document-thumbnail lcos-real-document-preview"><OcrImage artifactId={node.artifactId} ocrEnabled={false} src={thumbnail} alt={`${title} 预览`} draggable={false} onDragStart={(event) => event.preventDefault()}/><span>{tag}</span></div>
        : readableText && preview
          ? <DocumentSemanticBody level={semanticLevel ?? 'outline'} title={title} markdown={preview} expanded={density === 'expanded'} />
          : <MaterialIdentityFallback node={node} kind={kind} tag={tag}/>}
    <div className="lcos-object-caption lcos-material-caption lcos-material-body">
      <strong>{title}</strong>
      {secondary && <small>{secondary}</small>}
    </div>
    {Boolean((node.pageCount ?? 0) > 0 || (node.revisionCount ?? 0) > 1) && <div className="lcos-corner-meta">{(node.pageCount ?? 0) > 0 ? `${node.pageCount}p` : `${node.revisionCount}v`}</div>}
    {Boolean(node.revisionCount && node.revisionCount > 1) && <div className="lcos-revision-stack" aria-hidden="true"><i/><i/></div>}
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

/**
 * 债4：文档预览状态按枚举如实分档（纯函数）。PreviewAvailability 只有
 * not-generated/ready/failed/unsupported 四值，不存在“生成中”中间态——
 * 数据没有进行时就不虚构“正在生成预览…”文案（生成请求由 App 的 notice 播报）。
 */
export function documentPreviewStateCopy(node: CanvasNode): string {
  if (node.previewStatus === 'failed') return node.previewError ? `预览生成失败：${node.previewError}` : '预览生成失败'
  if (node.previewStatus === 'not-generated') return '预览未生成'
  if (node.previewStatus === 'unsupported') return '预览不支持'
  if (node.previewStatus === 'ready') return '预览已生成'
  return node.observedPath ? '本地来源' : '项目材料'
}

/** Native Visual V1: non-text artifacts own their native silhouette. */
function MaterialIdentityFallback({ node, kind, tag }: { node: CanvasNode; kind: FileIdentity; tag: string }) {
  if (kind === 'ppt') return <SlideDeckFallback node={node} />
  if (kind === 'archive') return <ArchiveBundleFallback node={node} tag={tag} />
  if (kind === 'file') return <GenericFileFallback node={node} tag={tag} />
  return <MaterialPaperFallback node={node} kind={kind} tag={tag} />
}

/** PPT owns a 16:9 slide silhouette instead of borrowing the portrait document-paper body. */
function SlideDeckFallback({ node }: { node: CanvasNode }) {
  const title = node.title.trim() || 'Presentation'
  return <div className="lcos-slide-deck-fallback" data-material-kind="ppt">
    <span className="lcos-slide-deck-back is-back-2" aria-hidden="true"/>
    <span className="lcos-slide-deck-back is-back-1" aria-hidden="true"/>
    <span className="lcos-slide-deck-face">
      <i className="lcos-slide-deck-accent" aria-hidden="true"/>
      <b title={title}>{title}</b>
      <span className="lcos-slide-deck-chart" aria-hidden="true"><i/><i/><i/><i/></span>
      <small>{node.pageCount ? `${node.pageCount} slides` : documentPreviewStateCopy(node)}</small>
    </span>
  </div>
}

/** Archive is a compact bundle/stack, never another white document card. */
function ArchiveBundleFallback({ node, tag }: { node: CanvasNode; tag: string }) {
  const name = node.title.trim() || tag
  return <div className="lcos-archive-bundle-fallback" data-material-kind="archive">
    <span className="lcos-archive-bundle-band" aria-hidden="true"/>
    <span className="lcos-archive-bundle-sheet is-back" aria-hidden="true"/>
    <span className="lcos-archive-bundle-sheet is-front"><b>{tag}</b><small title={name}>{name}</small></span>
  </div>
}

/** Generic files keep a strong file silhouette + extension; no generic SaaS card shell. */
function GenericFileFallback({ node, tag }: { node: CanvasNode; tag: string }) {
  const name = node.title.trim() || tag
  return <div className="lcos-generic-file-fallback" data-material-kind="file">
    <span className="lcos-generic-file-fold" aria-hidden="true"/>
    <b>{tag}</b>
    <small title={name}>{name}</small>
  </div>
}

/**
 * B-8 document-paper identity fallback（Grammar §10 / Apple Donor Map §9：
 * 无 preview 的文档用 document identity fallback，不造大卡）。
 * 纸面即身份：白系底 + 1px sep-hairline 边 + 极浅折角（矩形系唯一形状 = 纸）；
 * 类型字标并入身份态做纸内 letterhead（旧 kind chip 不再单独成徽章）；
 * 纸面写真值——TextPreview 首行（noteBody/previewText）已有则复用，否则写真实文件名，不放装饰假线。
 */
function MaterialPaperFallback({ node, kind, tag }: { node: CanvasNode; kind: FileIdentity; tag: string }) {
  const firstLine = (node.noteBody?.trim() || node.previewText?.trim())
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 52)
  const name = node.title.trim() || tag
  return <div className={`lcos-material-paper-fallback lcos-file-identity paper-${kind}`} data-material-kind={kind}>
    <span className="lcos-file-identity-fold" aria-hidden="true"/>
    <span className="lcos-file-identity-type">{tag}</span>
    <b className="lcos-file-identity-name" title={name}>{firstLine ?? name}</b>
    <small>{documentPreviewStateCopy(node)}</small>
  </div>
}

function DocumentSemanticBody({ level, title, markdown, expanded, curtain = false }: { level: DocumentSemanticLevel; title: string; markdown: string; expanded: boolean; curtain?: boolean }) {
  if (level === 'title') return <div className="lcos-document-title-identity"><strong>{title}</strong></div>
  if (level === 'outline') {
    const headings = documentOutlinePreview(markdown)
    return <div className={`lcos-document-outline-preview ${curtain ? 'lcos-text-curtain-sheet' : ''}`}>
      <strong className="lcos-document-outline-title">{title}</strong>
      {headings.length > 0
        ? <ol>{headings.map((heading) => <li key={`${heading.line}:${heading.label}`} data-heading-depth={heading.depth}><span>{heading.label}</span></li>)}</ol>
        : <TextPreview text={markdown} expanded={false}/>}
    </div>
  }
  return <div className={`lcos-readable-document ${curtain ? 'lcos-text-curtain-sheet' : ''}`}>{expanded
    ? <CrepeHost className="lcos-md-preview" markdown={markdown}/>
    : <TextPreview text={markdown} expanded={false}/>}</div>
}

function CollapsedNotePaper({ node }: { node: CanvasNode }) {
  const body = node.noteBody?.trim() || node.previewText?.trim() || ''
  const hint = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 52) || '文字记录'
  return <div className="lcos-collapsed-note-paper" aria-hidden="true">
    <span className="lcos-collapsed-note-fold"/>
    <NoteGlyph/>
    <span><i/><i/><i/></span>
    <small>{hint}</small>
  </div>
}

/** 行内富文本：**加粗**、==高光==（与编辑器工具栏语法一致，预览即所得）。 */
function richInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('==') && part.endsWith('==')) return <mark key={i} className="md-highlight">{part.slice(2, -2)}</mark>
    return <span key={i}>{part}</span>
  })
}

function TextPreview({ text, expanded }: { text: string; expanded: boolean }) {
  const limit = expanded ? 22 : 11
  const lines = text.replace(/\r/g, '').split('\n').filter((line, index, source) => line.trim() || (index > 0 && source[index - 1]?.trim())).slice(0, limit)
  return <div className="lcos-readable-copy">
    {lines.map((raw, index) => {
      const line = raw.trimEnd()
      // 大纲层级（两空格一级）→ 幕布式挂线圆点 + 引导线缩进（与编辑器/导图同一份层级数据）。
      const depth = Math.min(5, Math.floor((raw.length - raw.trimStart().length) / 2))
      const depthClass = depth ? ` md-depth-${depth}` : ''
      const heading = line.match(/^(#{1,3})\s+/)
      if (heading) return <strong key={index} className={`md-heading md-h${heading[1].length}${depthClass}`}>{richInline(line.replace(/^#{1,3}\s+/, ''))}</strong>
      if (/^[-*]\s+/.test(line)) return <span key={index} className={`md-list${depthClass}`}>{richInline(line.replace(/^[-*]\s+/, ''))}</span>
      if (/^>\s?/.test(line)) return <em key={index} className={`md-quote${depthClass}`}>{richInline(line.replace(/^>\s?/, ''))}</em>
      // 代码块只认 ``` 围栏 —— 缩进留给大纲层级（4 空格 = 两级深度，不再当代码）。
      if (/^```/.test(line)) return <code key={index}>{line.replace(/^```\w*/, '')}</code>
      return <span key={index} className={depthClass || undefined}>{richInline(line || ' ')}</span>
    })}
    {text.split('\n').length > limit && <i className="lcos-readable-fade">继续阅读</i>}
  </div>
}

function LinkObject({ node, pending, onDetails, showDetails, showControls = true }: Pick<Props, 'node' | 'pending' | 'onDetails' | 'showDetails' | 'showControls'>) {
  const domain = sourceDomain(node) ?? 'LINK'
  const initial = domain.replace(/^www\./, '').charAt(0).toUpperCase() || '↗'
  const thumbnail = node.previewDataUrl ?? node.previewUrl
  const showThumbnail = Boolean(thumbnail && (node.previewMimeType?.startsWith('image/') || thumbnail.startsWith('data:image/')))
  const title = displayNodeTitle(node)
  return <div className="lcos-object lcos-link-object lcos-material-face lcos-node-dot-identity" title={node.title}>
    {showThumbnail
      ? <OcrImage artifactId={node.artifactId} ocrEnabled={false} className="lcos-link-thumbnail" src={thumbnail} alt="" draggable={false} onDragStart={(event) => event.preventDefault()} />
      : <span className="lcos-favicon">{initial}</span>}
    <div className="lcos-material-body"><small>{domain}</small><strong>{title}</strong>{node.subtitle && <span>{node.subtitle}</span>}</div>
    <LinkGlyph className="lcos-link-glyph lcos-material-accent"/>
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function MediaObject({ node, kind, onDetails, showDetails, showControls = true }: Pick<Props, 'node' | 'onDetails' | 'showDetails' | 'showControls'> & { kind: 'video' | 'audio' }) {
  const Icon = kind === 'video' ? VideoGlyph : AudioGlyph
  const src = node.previewDataUrl ?? node.previewUrl
  const title = displayNodeTitle(node)
  return <div className={`lcos-object lcos-media-object lcos-material-face lcos-node-dot-identity media-${kind}`} title={node.title}>
    <div className="lcos-media-stage">{kind === 'video' && src ? <OcrImage artifactId={node.artifactId} ocrEnabled={false} src={src} alt="" draggable={false}/> : <Icon className="lcos-media-glyph"/>}</div>
    <div className="lcos-object-caption lcos-material-caption lcos-material-body"><strong>{title}</strong>{nodeSecondaryLine(node) && <small>{nodeSecondaryLine(node)}</small>}</div>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}


/**
 * Spatial-style project projection objects.
 *
 * These are not themed generic cards. Each Project Entity owns a different
 * physical anatomy on Main while keeping the same LCOS shell/material tokens:
 * Context = researched dossier, Workflow = action folio, Workspace = board snapshot.
 * They are projections only; Project Truth and exact membership remain elsewhere.
 */
function ContextProjectionObject({ node, collectionMembers = [], selected = false, onOpenContextLens, onDetails, showDetails, showControls = true }: Props) {
  const title = displayNodeTitle(node)
  const previewMembers = collectionMembers.filter((member) => !member.id.startsWith('scope:') && !member.id.startsWith('workspace:')).slice(0, 2)
  const count = collectionMembers.length || node.contextCount || 0
  const openLens = (lens: 'space' | 'structure' | 'evolution') => (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onOpenContextLens?.(node, lens)
  }
  return <div className="lcos-object lcos-project-entity-object lcos-node-dot-identity lcos-context-projection" title={node.title}>
    <div className="lcos-context-dossier-back" aria-hidden="true"><i/><i/></div>
    <div className="lcos-context-dossier-face">
      <span className="lcos-project-entity-tab">Context</span>
      <div className="lcos-project-entity-heading"><strong>{title}</strong><small>{count ? `${count} 项共同理解` : '理解现场'}</small></div>
      <div className="lcos-context-dossier-preview" aria-hidden="true">
        {previewMembers.length ? previewMembers.map((member) => <ProjectionPreviewTile key={member.id} member={member}/>) : <><span className="lcos-projection-fallback-copy"><i/><i/><i/></span><span className="lcos-projection-fallback-image"/></>}
        <span className="lcos-context-preview-relation"><i/><b/></span>
      </div>
      <div className="lcos-context-dossier-meta"><span>{count || '—'} refs</span><i/> <span>共同理解</span></div>
    </div>
    {selected && showControls && onOpenContextLens && <div className="lcos-context-lens-launcher" data-testid={`context-lens-launcher-${node.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label="进入理解现场" title="现场" onPointerDown={(event) => event.stopPropagation()} onClick={openLens('space')}><LayoutGrid size={13}/><span>现场</span></button>
      <button type="button" aria-label="进入结构视图" title="结构" onPointerDown={(event) => event.stopPropagation()} onClick={openLens('structure')}><Network size={13}/><span>结构</span></button>
      <button type="button" aria-label="进入演进视图" title="演进" onPointerDown={(event) => event.stopPropagation()} onClick={openLens('evolution')}><History size={13}/><span>演进</span></button>
    </div>}
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function WorkflowProjectionObject({ node, collectionMembers = [], onDetails, showDetails, showControls = true }: Props) {
  const title = displayNodeTitle(node)
  const count = collectionMembers.length || node.contextCount || 0
  const attachments = collectionMembers.filter((member) => !member.id.startsWith('scope:') && !member.id.startsWith('workspace:')).slice(0, 3)
  return <div className="lcos-object lcos-project-entity-object lcos-node-dot-identity lcos-workflow-projection" title={node.title}>
    <div className="lcos-workflow-folio-sheet back" aria-hidden="true"/>
    <div className="lcos-workflow-folio-sheet middle" aria-hidden="true"/>
    <div className="lcos-workflow-folio-face">
      <div className="lcos-project-entity-heading"><span className="lcos-workflow-kicker">Workflow</span><strong>{title}</strong><small>{count ? `${count} 项材料` : '行动骨架'}</small></div>
      <div className="lcos-workflow-route-mark" aria-label="工作流方向预览"><i/><b/><i/><b/><i/></div>
      <div className="lcos-workflow-attachment-strip" aria-hidden="true">
        {attachments.length ? attachments.map((member) => <ProjectionAttachment key={member.id} member={member}/>) : <><span/><span/><span/></>}
      </div>
    </div>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function WorkspaceProjectionObject({ node, collectionMembers = [], onDetails, showDetails, showControls = true }: Props) {
  const title = displayNodeTitle(node)
  const members = collectionMembers.filter((member) => !member.id.startsWith('scope:') && !member.id.startsWith('workspace:')).slice(0, 8)
  const count = collectionMembers.length || node.contextCount || 0
  const layout = workspaceMiniLayout(members)
  return <div className="lcos-object lcos-project-entity-object lcos-workspace-projection" title={node.title}>
    <div className="lcos-workspace-board-rim">
      <div className="lcos-workspace-board-scene" aria-hidden="true">
        {layout.length ? layout.map(({ member, left, top, width, height }) => <span key={member.id} className={`lcos-workspace-mini-object kind-${detectFileIdentity(member)}`} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>{projectionThumbnail(member)}</span>) : <><span className="lcos-workspace-mini-object seed-a"/><span className="lcos-workspace-mini-object seed-b"/><span className="lcos-workspace-mini-object seed-c"/></>}
      </div>
    </div>
    <div className="lcos-workspace-projection-caption"><strong>{title}</strong><small>{count ? `${count} 项 · 工作现场` : node.subtitle || '工作现场'}</small></div>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function ProjectionPreviewTile({ member }: { member: CanvasNode }) {
  const thumbnail = projectionThumbnail(member)
  const kind = detectFileIdentity(member)
  return <span className={`lcos-projection-preview-tile kind-${kind}`}>{thumbnail ?? <><i/><b>{displayNodeTitle(member).slice(0, 12)}</b></>}</span>
}

function ProjectionAttachment({ member }: { member: CanvasNode }) {
  const thumbnail = projectionThumbnail(member)
  return <span className={`lcos-workflow-attachment kind-${detectFileIdentity(member)}`}>{thumbnail ?? <i/>}</span>
}

function projectionThumbnail(member: CanvasNode) {
  const thumbnail = member.previewDataUrl ?? member.previewUrl
  const hasImage = Boolean(thumbnail && (member.previewMimeType?.startsWith('image/') || thumbnail.startsWith('data:image/')))
  return hasImage && thumbnail ? <OcrImage artifactId={member.artifactId} ocrEnabled={false} src={thumbnail} alt="" draggable={false} onDragStart={(event) => event.preventDefault()}/> : null
}

function workspaceMiniLayout(members: readonly CanvasNode[]) {
  if (!members.length) return []
  const left = Math.min(...members.map((member) => member.x))
  const top = Math.min(...members.map((member) => member.y))
  const right = Math.max(...members.map((member) => member.x + Math.max(1, member.width)))
  const bottom = Math.max(...members.map((member) => member.y + Math.max(1, member.height)))
  const spanX = Math.max(1, right - left)
  const spanY = Math.max(1, bottom - top)
  return members.map((member) => ({
    member,
    left: 6 + ((member.x - left) / spanX) * 72,
    top: 7 + ((member.y - top) / spanY) * 64,
    width: Math.max(8, Math.min(24, (member.width / spanX) * 72)),
    height: Math.max(10, Math.min(28, (member.height / spanY) * 64)),
  }))
}

function CollectionObject({ node, density, onDetails, showDetails, showControls = true, collectionExpanded = false, collectionMembers = [], onCollectionMemberSelect }: Props) {
  const versions = Math.max(1, node.revisionCount ?? 0)
  const isCollection = node.entityKind === 'collection'
  const title = displayNodeTitle(node)
  const inlineEntityMembers = collectionMembers.filter((member) => member.id.startsWith('scope:') || member.id.startsWith('workspace:'))
  if (isCollection) {
    const stackMembers = collectionMembers.filter((member) => !member.id.startsWith('scope:') && !member.id.startsWith('workspace:')).slice(0, 3)
    return <div className={`lcos-object lcos-collection-object lcos-material-face is-collection ${collectionExpanded ? 'is-expanded' : 'is-collapsed'}`} title={node.title}>
      <div className="lcos-collection-stack" aria-hidden="true">
        {stackMembers.map((member, index) => <CollectionStackSheet key={member.id} member={member} index={index}/>) }
        {!stackMembers.length && <><i className="lcos-collection-stack-sheet stack-sheet-0"/><i className="lcos-collection-stack-sheet stack-sheet-1"/></>}
      </div>
      <div className="lcos-collection-folder-face">
        <span className="lcos-collection-folder-tab">Collection</span>
        <div className="lcos-collection-folder-copy">
          <small>{collectionMembers.length} items</small>
          <strong>{title}</strong>
        </div>
        <span className="lcos-collection-folder-mark" aria-hidden="true"><CollectionGlyph/></span>
        <span className="lcos-collection-folder-state" aria-hidden="true">{collectionExpanded ? '−' : '+'}</span>
      </div>
      {collectionExpanded && inlineEntityMembers.length > 0 && showControls && <div className="lcos-collection-inline" data-testid={`collection-inline-${node.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        {inlineEntityMembers.map((member) => {
          const MemberIcon = nodeTypeIcon(member)
          return <button key={member.id} type="button" className="lcos-collection-member" data-member-id={member.id} title={member.title} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onCollectionMemberSelect?.(member.id, additiveSelectionModifier(event)) }}><MemberIcon/><span>{displayNodeTitle(member)}</span></button>
        })}
      </div>}
      {showControls && versions > 1 && <button className="lcos-version-beads lcos-collection-version-beads" type="button" aria-label={`查看 ${title} 的 ${versions} 个上下文版本`} title="查看集合版本" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}>{Array.from({ length: Math.min(3, versions) }, (_, i) => <i key={i}/>)}</button>}
      <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
    </div>
  }
  return <div className={`lcos-object lcos-collection-object lcos-material-face ${isCollection ? 'is-collection' : 'is-context'} ${collectionExpanded ? 'is-expanded' : ''}`} title={node.title}>
    <header><span className="lcos-system-object-mark" aria-hidden="true">{isCollection ? <CollectionGlyph/> : <Network size={15}/>}</span><strong>{title}</strong></header>
    {density !== 'compact' && !collectionExpanded && <div className="lcos-context-spine" aria-hidden="true"><i/><i/><i/><i/></div>}
    {isCollection && collectionExpanded && inlineEntityMembers.length > 0 && showControls && <div className="lcos-collection-inline" data-testid={`collection-inline-${node.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      {inlineEntityMembers.map((member) => {
        const MemberIcon = nodeTypeIcon(member)
        return <button key={member.id} type="button" className="lcos-collection-member" data-member-id={member.id} title={member.title} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onCollectionMemberSelect?.(member.id, additiveSelectionModifier(event)) }}><MemberIcon/><span>{displayNodeTitle(member)}</span></button>
      })}
    </div>}
    <footer><span>{isCollection ? `${collectionMembers.length} refs${collectionExpanded ? ' · 已展开' : ''}` : nodeSecondaryLine(node) || `${node.contextCount ?? node.workspaceIds?.length ?? 0} refs`}</span>{showControls && versions > 1 && <button className="lcos-version-beads" type="button" aria-label={`查看 ${title} 的 ${versions} 个上下文版本`} title="查看上下文版本" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}>{Array.from({ length: Math.min(3, versions) }, (_, i) => <i key={i}/>)}</button>}</footer>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function CollectionStackSheet({ member, index }: { member: CanvasNode; index: number }) {
  const thumbnail = member.previewDataUrl ?? member.previewUrl
  const hasImage = Boolean(thumbnail && (member.previewMimeType?.startsWith('image/') || thumbnail.startsWith('data:image/')))
  return <span className={`lcos-collection-stack-sheet stack-sheet-${index}`} data-stack-kind={detectFileIdentity(member)}>
    {hasImage && thumbnail
      ? <OcrImage artifactId={member.artifactId} ocrEnabled={false} src={thumbnail} alt="" draggable={false} onDragStart={(event) => event.preventDefault()}/>
      : <><i/><b>{displayNodeTitle(member).slice(0, 18)}</b></>}
  </span>
}

function RunObject({ node, runId, runStatus, onDetails, showDetails, showControls = true }: Props) {
  const status = node.runStatus ?? runStatus
  const label = status ? runStatusLabel[status] : '执行记录'
  const title = displayNodeTitle(node)
  return <div className={`lcos-object lcos-run-object lcos-material-face status-${status ?? 'idle'}`} title={node.title}>
    <span className="lcos-run-machine lcos-material-accent"><RunGlyph/></span>
    <div className="lcos-material-body"><strong>{title}</strong><small>{node.commandText || node.subtitle || label}</small></div>
    <div className="lcos-run-state"><i/>{label}</div>
    {status === 'running' && <span className="lcos-run-pulse" aria-hidden="true"/>}
    {runId && <span className="lcos-sr-only">{runId}</span>}
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function DecisionObject({ node, onDetails, showDetails, showControls = true }: Props) {
  const title = displayNodeTitle(node)
  return <div className="lcos-object lcos-decision-object lcos-material-face" title={node.title}><DecisionGlyph className="lcos-node-dot-identity lcos-material-accent"/><div className="lcos-material-body"><strong>{title}</strong><small>{node.subtitle}</small></div><InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/></div>
}

function NoteObject({ node, density, onDetails, showDetails, showControls = true, onLocate, selected, zoom }: Props) {
  const body = node.noteBody?.trim()
  const title = displayNodeTitle(node)
  const directRead = Boolean(body)
  const semanticLevel = documentSemanticLevel({ density, ...(zoom === undefined ? {} : { zoom }), selected })
  const mindmap = node.noteLayout === 'mindmap'
  return <div data-document-semantic-level={mindmap ? undefined : semanticLevel} className={`lcos-object lcos-note-object lcos-material-face ${mindmap ? 'is-mindmap' : directRead ? 'is-direct-reading' : 'is-collapsed-material'}`} title={node.title}>
    {mindmap ? <MindMapNoteVisual node={node} density={density}/> : directRead && body ? <>
      {semanticLevel !== 'title' && <span className="lcos-text-curtain-rail" aria-hidden="true"><i/><b/><i/></span>}
      <DocumentSemanticBody level={semanticLevel} title={title} markdown={body} expanded={density === 'expanded'} curtain />
    </> : <CollapsedNotePaper node={node}/>}
    <div className={`lcos-material-caption lcos-material-body ${directRead ? 'lcos-text-curtain-caption' : ''}`}><strong>{title}</strong>{nodeSecondaryLine(node) && <small>{nodeSecondaryLine(node)}</small>}</div>
    {showControls && Boolean(node.anchors?.length) && <button className="lcos-note-locate" type="button" aria-label="定位到锚定对象" title="定位到锚定对象" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onLocate?.(node) }}><LocateFixed size={12}/><b>定位</b></button>}
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

function ObjectState({ node, pending }: { node: CanvasNode; pending: boolean }) {
  const state = node.runtimeState === 'failed' ? 'failed' : node.fileAvailability === 'stale' ? 'stale' : pending || node.draft ? 'draft' : node.current ? 'current' : null
  if (!state) return null
  const label = state === 'failed' ? '导入失败' : state === 'stale' ? '源文件已变化' : state === 'draft' ? '待确认' : '当前'
  return <span className={`lcos-object-state state-${state}`} title={label} aria-label={label}><i aria-hidden="true"/><b>{label}</b></span>
}

function InfoButton({ show, label, onDetails }: { show: boolean; label: string; onDetails: () => void }) {
  if (!show) return null
  return <button className="node-details lcos-object-info" aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><Info size={12}/></button>
}

export function displayNodeTitle(node: CanvasNode): string {
  const raw = node.title.trim()
  const withoutExtension = raw.replace(/\.(md|markdown|txt|json|pdf|pptx?|key|docx?|xlsx?|csv|png|jpe?g|webp|gif|svg|mp4|mov|webm)$/i, '')
  const cleaned = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\b20\d{6,8}\b/g, '')
    .replace(/\bv\d+(?:\.\d+)*\b/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!cleaned) return withoutExtension || raw
  if (cleaned.length <= 44) return cleaned
  const words = cleaned.split(/\s+/)
  return words.slice(0, Math.min(6, words.length)).join(' ') + (words.length > 6 ? '…' : '')
}

export function nodeSecondaryLine(node: CanvasNode): string {
  const status = node.fileAvailability === 'stale'
    ? '源文件已变化'
    : node.draft
      ? '草稿'
      : node.historical
        ? '旧版'
        : node.current
          ? '当前版本'
          : ''
  const page = node.pageCount && node.pageCount > 0 ? `${node.pageCount}页` : ''
  const revision = !status && node.revisionLabel ? node.revisionLabel : ''
  const semantic = (node.subtitle || '').trim().replace(/\s+/g, ' ')
  return [status || revision, page || (semantic && semantic !== node.title ? semantic.slice(0, 46) : '')].filter(Boolean).join(' · ')
}

export function detectFileIdentity(node: CanvasNode): FileIdentity {
  const name = node.title.toLowerCase()
  const artifactType = node.fileType?.toLowerCase() ?? ''
  const previewType = node.previewMimeType?.toLowerCase() ?? ''
  const types = [artifactType, previewType]
  const hasType = (predicate: (value: string) => boolean) => types.some((value) => predicate(value))
  const linkLike = [node.previewText, node.observedPath, node.subtitle, node.title].some((value) => value ? /https?:\/\//i.test(value) : false)
  if (/\.(mp4|mov|webm|m4v|avi)$/i.test(name) || hasType((value) => value.startsWith('video/'))) return 'video'
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name) || hasType((value) => value.startsWith('audio/'))) return 'audio'
  if (/\.pdf$/i.test(name) || artifactType.includes('pdf')) return 'pdf'
  if (/\.(ppt|pptx|key)$/i.test(name) || artifactType.includes('presentation')) return 'ppt'
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(name) || artifactType === 'image' || previewType.startsWith('image/')) return 'image'
  if (/\.(md|markdown|txt|json)$/i.test(name) || hasType((value) => value.includes('markdown') || value === 'text' || value.startsWith('text/'))) return 'markdown'
  if (linkLike || ['url', 'link', 'web'].includes(artifactType) || previewType === 'text/uri-list') return 'link'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name) || hasType((value) => value.includes('zip') || value.includes('archive'))) return 'archive'
  return 'file'
}

function fileExtension(name: string) {
  const match = name.match(/\.([a-z0-9]{1,6})$/i)
  return match?.[1]?.toUpperCase() ?? ''
}

function sourceDomain(node: CanvasNode): string | null {
  const values = [node.previewText, node.observedPath, node.subtitle, node.title]
  for (const value of values) {
    if (!value) continue
    const match = value.match(/https?:\/\/([^\s/]+)/i)
    if (match?.[1]) return match[1].replace(/^www\./i, '')
  }
  return null
}

function formatNodeTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export const nodeTimestamp = formatNodeTime
export const nodeTypeIcon = (node: CanvasNode) => {
  const file = detectFileIdentity(node)
  if (node.kind === 'process') return RunGlyph
  if (node.kind === 'context') return CollectionGlyph
  if (node.kind === 'decision') return DecisionGlyph
  if (node.kind === 'note') return NoteGlyph
  if (file === 'image') return ImageGlyph
  if (file === 'link') return LinkGlyph
  if (file === 'video') return VideoGlyph
  if (file === 'audio') return AudioGlyph
  if (file === 'archive') return ArchiveGlyph
  if (`${node.title} ${node.subtitle}`.toLowerCase().includes('session')) return SessionGlyph
  return DocumentGlyph
}

/**
 * Wave C-2（批八）：Conversation Glyth 身体卡——对话实体的画布投影身体（Grammar §8）。
 * Glyth 不是 avatar/icon/badge，而是可被选中、观察状态的角色身体：state 只来自 SessionLifecycle，
 * activityScore 由 conversationActivityScore
 * 计算（§8.3 Activity Decay：dormant → 低饱和安静）。选中/拖拽/详情复用 registry 卡
 * 既有外壳（宿主 CanvasCard + .lcos-object 壳），不造第二套交互链路；conversation
 * 元数据缺失时回落 CollectionObject（与查表未命中同兜底语义，非错误路径）。
 */
function ConversationGlythObject(props: Props) {
  const { node, onDetails, showDetails, showControls = true, glythCritical = false } = props
  const glythLod = props.glythLod ?? glythSemanticLodForZoom(props.zoom ?? 1)
  const conversation = node.conversation
  const title = displayNodeTitle(node)
  if (!conversation) return <CollectionObject {...props} />
  const state = glythStateFromSessionPhase(conversation.lifecyclePhase)
  const activityScore = conversationActivityScore(conversation)
  if (glythLod === 'far' || glythLod === 'extreme-far') {
    return <div className={`lcos-conversation-glyth-body is-${glythLod}${glythCritical ? ' is-critical' : ''}`} data-glyth-lod={glythLod} data-glyth-critical={glythCritical || undefined} style={{ '--glyth-ui-scale': String(1 / Math.max(.02, props.zoom ?? 1)) } as CSSProperties} title={node.title}>
      <ConversationGlythIdentityPin conversation={conversation} state={state} activityScore={activityScore} label={title} />
      <span className="lcos-conversation-glyth-caption">{title}</span>
      <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
    </div>
  }
  // 去卡片化（Grammar S1/S2.1）：对话实体是 Object——Glyth 身体本身就是画布对象。
  return <div className={`lcos-conversation-glyth-body is-${glythLod}`} data-glyth-lod={glythLod} title={node.title}>
    <ConversationGlyth conversation={conversation} state={state} activityScore={activityScore} size={glythLod === 'mid' ? 60 : 72} label={title} className={glythLod === 'mid' ? 'is-semantic-mid' : ''} />
    <span className="lcos-conversation-glyth-caption">{title}</span>
    <InfoButton show={showControls && showDetails} label={`查看 ${title} 信息`} onDetails={onDetails}/>
  </div>
}

// —— §4.7 卡片 Registry：context 族全量入表（20260826 做实，取代第一步示范卡）——
// 四类 entityKind（组合键由 nodeCardKey 派生）全部走表渲染；新增卡片类型只需在此注册。
// file 族（ContentObject 内的 image/link/video/audio/document）留待后续按 file:<type> 迁移。
registerNodeCard('entity:workflow', WorkflowProjectionObject)
registerNodeCard('entity:workspace', WorkspaceProjectionObject)
registerNodeCard('entity:context', ContextProjectionObject)
registerNodeCard('entity:collection', CollectionObject)
// —— Wave C-2（批八）：对话实体卡——entity:conversation 渲染 ConversationGlyth 身体。 ——
registerNodeCard('entity:conversation', ConversationGlythObject)

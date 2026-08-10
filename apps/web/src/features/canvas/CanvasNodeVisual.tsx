import {
  CircleHelp,
  ImageOff,
} from 'lucide-react'
import { memo } from 'react'
import type { CanvasNode, NodeDisplayMode, RunStatus } from '../../model'
import { runStatusLabel } from '../../model'
import { visualFamilyFor } from '../presentation/visualFamily'
import {
  ArchiveGlyph,
  AudioGlyph,
  CollectionGlyph,
  DecisionGlyph,
  DocumentGlyph,
  FeedbackGlyph,
  ImageGlyph,
  LinkGlyph,
  NoteGlyph,
  RunGlyph,
  SessionGlyph,
  VideoGlyph,
} from '../design/LcosGlyphs'

interface Props {
  node: CanvasNode
  density: NodeDisplayMode
  runId: string
  runStatus: RunStatus | null
  pending: boolean
  onDetails: () => void
  showDetails: boolean
}

export type NodeVisualFamily = 'reference' | 'document' | 'feedback' | 'note' | 'context' | 'process' | 'decision'
export type FileIdentity = 'image' | 'video' | 'audio' | 'pdf' | 'ppt' | 'markdown' | 'link' | 'archive' | 'file'

export function nodeVisualFamily(node: CanvasNode): NodeVisualFamily {
  // Phase C: mechanical visual family takes priority when it recognizes the node.
  const visual = visualFamilyFor({
    artifactKind: node.fileType,
    title: node.title,
    subtitle: node.subtitle,
    kind: node.kind,
    artifactId: node.artifactId,
    sourceRunId: node.sourceRunId,
    managed: node.managed,
  })
  if (visual === 'conversation' || visual === 'skill' || visual === 'output') return 'document'
  if (node.kind === 'process') return 'process'
  if (node.kind === 'context') return 'context'
  if (node.kind === 'decision') return 'decision'
  // DEPRECATED_BEHAVIORAL_HINT (Phase A): title regex heuristics
  // (feedback/反馈/change：/keep：) infer semantics from display text.
  // New Presentation/Curation code must not reuse this as business truth.
  // TODO(Phase C C8): feedback title-regex is NOT yet replaced by visualFamily;
  // keep until a mechanical source exists, then remove this branch.
  const text = `${node.title} ${node.subtitle}`.toLowerCase()
  if (text.includes('feedback') || text.includes('反馈') || text.includes('change：') || text.includes('keep：')) return 'feedback'
  if (node.kind === 'note') return 'note'
  return detectFileIdentity(node) === 'image' ? 'reference' : 'document'
}

export const CanvasNodeVisual = memo(function CanvasNodeVisual(props: Props) {
  const family = nodeVisualFamily(props.node)
  if (family === 'process') return <RunObject {...props} />
  if (family === 'context') return <CollectionObject {...props} />
  if (family === 'decision') return <DecisionObject {...props} />
  if (family === 'feedback') return <FeedbackObject {...props} />
  if (family === 'note') return <NoteObject {...props} />
  return <ContentObject {...props} />
}, (previous, next) => (
  previous.node === next.node
  && previous.density === next.density
  && previous.runId === next.runId
  && previous.runStatus === next.runStatus
  && previous.pending === next.pending
  && previous.showDetails === next.showDetails
))

function ContentObject({ node, density, pending, onDetails, showDetails }: Props) {
  const kind = detectFileIdentity(node)
  if (kind === 'image') return <ImageObject node={node} density={density} pending={pending} onDetails={onDetails} showDetails={showDetails} />
  if (kind === 'link') return <LinkObject node={node} pending={pending} onDetails={onDetails} showDetails={showDetails} />
  if (kind === 'video') return <MediaObject node={node} kind="video" onDetails={onDetails} showDetails={showDetails} />
  if (kind === 'audio') return <MediaObject node={node} kind="audio" onDetails={onDetails} showDetails={showDetails} />
  return <DocumentObject node={node} kind={kind} density={density} pending={pending} onDetails={onDetails} showDetails={showDetails} />
}

function ImageObject({ node, pending, onDetails, showDetails }: Pick<Props, 'node' | 'density' | 'pending' | 'onDetails' | 'showDetails'>) {
  const src = node.previewDataUrl ?? node.previewUrl
  return <div className="lcos-object lcos-image-object">
    {src ? <img src={src} alt={node.title} draggable={false} onDragStart={(event) => event.preventDefault()} /> : <div className="lcos-image-fallback"><ImageOff size={24}/></div>}
    <div className="lcos-image-caption"><span className="lcos-type-tag">IMG</span><strong>{node.title}</strong></div>
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function DocumentObject({ node, kind, density, pending, onDetails, showDetails }: Pick<Props, 'node' | 'density' | 'pending' | 'onDetails' | 'showDetails'> & { kind: FileIdentity }) {
  const Icon = kind === 'archive' ? ArchiveGlyph : DocumentGlyph
  const tag = kind === 'markdown' ? 'MD' : kind === 'ppt' ? 'PPT' : kind === 'pdf' ? 'PDF' : kind === 'archive' ? 'ZIP' : fileExtension(node.title) || 'FILE'
  const preview = node.previewText?.trim()
  const thumbnailCandidate = node.previewDataUrl ?? node.previewUrl
  const thumbnail = thumbnailCandidate && (node.previewMimeType?.startsWith('image/') || thumbnailCandidate.startsWith('data:image/')) ? thumbnailCandidate : null
  return <div className={`lcos-object lcos-document-object file-${kind}`}>
    {thumbnail
      ? <div className="lcos-document-thumbnail"><img src={thumbnail} alt={`${node.title} 预览`} draggable={false} onDragStart={(event) => event.preventDefault()}/><span>{tag}</span></div>
      : preview && density !== 'compact'
        ? <div className="lcos-text-thumbnail"><pre>{preview.slice(0, 420)}</pre><span>{tag}</span></div>
      : <div className={`lcos-file-fallback file-${kind}`}>
          <span className="lcos-file-icon"><Icon/></span>
          <strong>{tag}</strong>
          {density !== 'compact' && (node.previewStatus === 'failed' ? <small>预览暂不可用</small> : node.previewStatus === 'ready' ? <small>本地文件</small> : null)}
        </div>}
    <div className="lcos-object-caption">
      <span className="lcos-type-tag">{tag}</span>
      <strong>{node.title}</strong>
      {density === 'expanded' && preview && <small>{preview}</small>}
    </div>
    {Boolean((node.pageCount ?? 0) > 0 || (node.revisionCount ?? 0) > 0) && <div className="lcos-corner-meta">{(node.pageCount ?? 0) > 0 ? `${node.pageCount}p` : `${node.revisionCount}v`}</div>}
    {Boolean(node.revisionCount && node.revisionCount > 1) && <div className="lcos-revision-stack" aria-hidden="true"><i/><i/></div>}
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function LinkObject({ node, pending, onDetails, showDetails }: Pick<Props, 'node' | 'pending' | 'onDetails' | 'showDetails'>) {
  const domain = sourceDomain(node) ?? 'LINK'
  const initial = domain.replace(/^www\./, '').charAt(0).toUpperCase() || '↗'
  return <div className="lcos-object lcos-link-object">
    <span className="lcos-favicon">{initial}</span>
    <div><small>{domain}</small><strong>{node.title}</strong><span>{node.subtitle}</span></div>
    <LinkGlyph className="lcos-link-glyph"/>
    <ObjectState node={node} pending={pending}/>
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function MediaObject({ node, kind, onDetails, showDetails }: Pick<Props, 'node' | 'onDetails' | 'showDetails'> & { kind: 'video' | 'audio' }) {
  const Icon = kind === 'video' ? VideoGlyph : AudioGlyph
  const src = node.previewDataUrl ?? node.previewUrl
  return <div className={`lcos-object lcos-media-object media-${kind}`}>
    <div className="lcos-media-stage">{kind === 'video' && src ? <img src={src} alt="" draggable={false}/> : <Icon className="lcos-media-glyph"/>}</div>
    <div className="lcos-object-caption"><span className="lcos-type-tag">{kind === 'video' ? 'VID' : 'AUD'}</span><strong>{node.title}</strong></div>
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function FeedbackObject({ node, density, onDetails, showDetails }: Props) {
  const { change, keep } = feedbackSummary(node.subtitle)
  return <div className="lcos-object lcos-feedback-object">
    <div className="lcos-feedback-rail"/>
    <header><FeedbackGlyph/><span className="lcos-type-tag">FBK</span></header>
    <strong>{node.title}</strong>
    <p><b>Change</b>{change}</p>
    {density !== 'compact' && <p><b>Keep</b>{keep}</p>}
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function CollectionObject({ node, density, onDetails, showDetails }: Props) {
  const versions = Math.max(1, node.revisionCount ?? 0)
  return <div className="lcos-object lcos-collection-object">
    <header><CollectionGlyph/><span className="lcos-type-tag">CTX</span><strong>{node.title}</strong></header>
    {density !== 'compact' && <div className="lcos-context-spine" aria-hidden="true"><i/><i/><i/><i/></div>}
    <footer><span>{node.contextCount ?? node.workspaceIds?.length ?? 0} refs</span>{versions > 1 && <button className="lcos-version-beads" type="button" aria-label={`查看 ${node.title} 的 ${versions} 个上下文版本`} title="查看上下文版本" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}>{Array.from({ length: Math.min(3, versions) }, (_, i) => <i key={i}/>)}</button>}</footer>
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function RunObject({ node, runId, runStatus, onDetails, showDetails }: Props) {
  const status = node.runStatus ?? runStatus
  const label = status ? runStatusLabel[status] : '执行记录'
  return <div className={`lcos-object lcos-run-object status-${status ?? 'idle'}`}>
    <span className="lcos-run-machine"><RunGlyph/></span>
    <div><span className="lcos-type-tag">RUN</span><strong>{node.title}</strong><small>{node.commandText || node.subtitle || label}</small></div>
    <div className="lcos-run-state"><i/>{label}</div>
    {status === 'running' && <span className="lcos-run-pulse" aria-hidden="true"/>}
    {runId && <span className="lcos-sr-only">{runId}</span>}
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/>
  </div>
}

function DecisionObject({ node, onDetails, showDetails }: Props) {
  return <div className="lcos-object lcos-decision-object"><DecisionGlyph/><div><span className="lcos-type-tag">DEC</span><strong>{node.title}</strong><small>{node.subtitle}</small></div><InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/></div>
}

function NoteObject({ node, density, onDetails, showDetails }: Props) {
  return <div className="lcos-object lcos-note-object"><NoteGlyph/><div><span className="lcos-type-tag">NOTE</span><strong>{node.title}</strong>{density !== 'compact' && <small>{node.subtitle}</small>}</div><InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails}/></div>
}

function ObjectState({ node, pending }: { node: CanvasNode; pending: boolean }) {
  const state = node.runtimeState === 'failed' ? 'failed' : node.fileAvailability === 'stale' ? 'stale' : pending || node.draft ? 'draft' : node.current ? 'current' : null
  if (!state) return null
  const label = state === 'failed' ? '导入失败' : state === 'stale' ? '来源已变化' : state === 'draft' ? '待确认草稿' : '当前版本'
  return <span className={`lcos-object-state state-${state}`} title={label} aria-label={label}><i aria-hidden="true"/><b>{label}</b></span>
}

function InfoButton({ show, label, onDetails }: { show: boolean; label: string; onDetails: () => void }) {
  if (!show) return null
  return <button className="node-details lcos-object-info" aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><CircleHelp size={12}/></button>
}

export function detectFileIdentity(node: CanvasNode): FileIdentity {
  const name = node.title.toLowerCase()
  const type = node.fileType?.toLowerCase() ?? node.previewMimeType?.toLowerCase() ?? ''
  const linkLike = [node.previewText, node.observedPath, node.subtitle, node.title].some((value) => value ? /https?:\/\//i.test(value) : false)
  if (/\.(mp4|mov|webm|m4v|avi)$/i.test(name) || type.startsWith('video/')) return 'video'
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name) || type.startsWith('audio/')) return 'audio'
  if (/\.pdf$/i.test(name) || type.includes('pdf')) return 'pdf'
  if (/\.(ppt|pptx|key)$/i.test(name) || type.includes('presentation') || node.pageCount) return 'ppt'
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(name) || type.startsWith('image/')) return 'image'
  if (/\.(md|markdown|txt|json)$/i.test(name) || type.includes('markdown') || type === 'text' || type.startsWith('text/')) return 'markdown'
  if (linkLike || type === 'url' || type === 'link' || type === 'web') return 'link'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name) || type.includes('zip') || type.includes('archive')) return 'archive'
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

function feedbackSummary(subtitle: string): { change: string; keep: string } {
  const changeMatch = subtitle.match(/Change[：:]\s*([^·]+)/i)
  const keepMatch = subtitle.match(/Keep[：:]\s*(.+)$/i)
  return {
    change: changeMatch?.[1]?.trim() || subtitle.split('·')[0]?.trim() || '需要进一步明确修改范围',
    keep: keepMatch?.[1]?.trim() || subtitle.split('·')[1]?.trim() || '保留已确认内容',
  }
}

function formatNodeTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

// Kept for compatibility with older imports that expect these utilities to exist in this module.
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

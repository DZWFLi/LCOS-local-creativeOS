import {
  Clock3,
  FileImage,
  FileStack,
  FileText,
  Image as ImageIcon,
  Layers3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  CircleHelp,
  Play,
  Presentation,
  Sparkles,
} from 'lucide-react'
import type { CanvasNode, NodeDisplayMode, RunStatus } from '../../model'
import { nodeMeta, runStatusLabel } from '../../model'

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

export function nodeVisualFamily(node: CanvasNode): NodeVisualFamily {
  if (node.kind === 'process') return 'process'
  if (node.kind === 'context') return 'context'
  if (node.kind === 'decision') return 'decision'
  const text = `${node.title} ${node.subtitle}`.toLowerCase()
  if (text.includes('feedback') || text.includes('反馈') || text.includes('change：') || text.includes('keep：')) return 'feedback'
  if (node.kind === 'note') return 'note'
  if (getFileKind(node) === 'image') return 'reference'
  return 'document'
}

export function CanvasNodeVisual({ node, density, runId, runStatus, pending, onDetails, showDetails }: Props) {
  const family = nodeVisualFamily(node)
  if (family === 'process') return <ProcessVisual node={node} density={density} runId={runId} runStatus={runStatus} onDetails={onDetails} showDetails={showDetails} />
  if (family === 'context') return <ContextVisual node={node} density={density} onDetails={onDetails} showDetails={showDetails} />
  if (family === 'decision') return <DecisionVisual node={node} density={density} onDetails={onDetails} showDetails={showDetails} />
  if (family === 'feedback') return <FeedbackVisual node={node} density={density} onDetails={onDetails} showDetails={showDetails} />
  if (family === 'note') return <NoteVisual node={node} density={density} onDetails={onDetails} showDetails={showDetails} />
  return <ArtifactVisual node={node} density={density} pending={pending} family={family} onDetails={onDetails} showDetails={showDetails} />
}

function ArtifactVisual({ node, density, pending, family, onDetails, showDetails }: Pick<Props, 'node' | 'density' | 'pending' | 'onDetails' | 'showDetails'> & { family: 'reference' | 'document' }) {
  const meta = nodeMeta[node.kind]
  const fileKind = getFileKind(node)
  const Icon = fileKind === 'ppt' ? Presentation : fileKind === 'image' ? ImageIcon : fileKind === 'link' ? Link2 : FileText
  const stateLabel = node.historical ? '历史版本' : node.current ? '当前版本' : node.draft ? 'AI 生成草稿' : '原始来源'
  const revisionCount = Math.max(1, node.revisionCount ?? (node.revisionId ? 1 : 0))
  const hasRevisionStack = revisionCount > 1

  return <div className={`artifact-stack-shell family-${family} ${hasRevisionStack ? 'has-revisions' : ''}`} data-revision-count={hasRevisionStack ? revisionCount : undefined}>
    {hasRevisionStack && <div className="revision-backplates" aria-hidden="true">{Array.from({ length: Math.min(3, revisionCount - 1) }, (_, index) => <i key={index} />)}</div>}
    <div className={`artifact-visual artifact-family-${family} ${node.kind === 'generated' ? 'artifact-generated-material' : ''}`}>
      <header className="artifact-topline">
        <span className="artifact-kind"><i style={{ background: meta.accent }} />{family === 'reference' ? '视觉参考' : meta.label}</span>
        <span className="artifact-format"><Icon size={12} />{fileKind.toUpperCase()}</span>
      </header>
      <PreviewArtwork node={node} density={density} family={family} />
      <footer className="artifact-copy">
        <strong>{node.title}</strong>
        <span>{pending ? '结果待回收 · 等待确认' : node.subtitle}</span>
        <small className="artifact-source-line"><Clock3 size={10} />{formatNodeTime(node.createdAt)}{node.sourceRunId ? ` · ${node.sourceRunId}` : ''}</small>
        {density === 'expanded' && <div className="artifact-expanded-meta">
          <span><Presentation size={11} />{node.pageCount ? `${node.pageCount} 页` : fileKind.toUpperCase()}</span>
          <span><FileStack size={11} />{node.revisionLabel ?? (node.revisionId ? 'Revision' : 'External')}</span>
          {node.sourceRunId && <span><Link2 size={11} />{node.sourceRunId}</span>}
          <span><Clock3 size={11} />{formatNodeTime(node.createdAt)}</span>
        </div>}
        {density === 'expanded' && <small className="artifact-provenance">{stateLabel}{node.sourceProvider ? ` · ${node.sourceProvider}` : ''}{node.parentRunId ? ` · ${node.parentRunId}` : ''}</small>}
      </footer>
      <div className="artifact-statuses">
        {node.runtimeState === 'importing' && <span className="status-chip draft">Importing</span>}
        {node.runtimeState === 'failed' && <span className="status-chip danger">Import failed</span>}
        {node.historical && <span className="status-chip historical">历史</span>}
        {node.current && <span className="status-chip current">当前</span>}
        {node.draft && <span className="status-chip draft">待确认</span>}
        {node.kind === 'generated' && <span className="iridescent-token" aria-label="AI 生成结果"><Sparkles size={12} /></span>}
      </div>
      {node.resultGroupId && <span className="return-origin"><FileStack size={11} />{node.resultGroupId}</span>}
      {node.kind === 'generated' && <span className="generated-material-glint" aria-hidden="true" />}
      {!hasRevisionStack && <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails} />}
    </div>
    {hasRevisionStack && <button className="revision-stack-trigger pressable" aria-label={`查看 ${node.title} 的 ${revisionCount} 个版本`} title={`${revisionCount} 个版本`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><span>{node.revisionLabel ?? `V${revisionCount}`}</span><b>{revisionCount}</b></button>}
  </div>
}

function PreviewArtwork({ node, density }: { node: CanvasNode; density: NodeDisplayMode; family: 'reference' | 'document' }) {
  const fileKind = getFileKind(node)
  const previewSource = node.previewDataUrl ?? node.previewUrl
  const Icon = fileKind === 'ppt' ? Presentation : fileKind === 'image' ? ImageIcon : fileKind === 'link' ? Link2 : FileText
  if (density === 'compact') return <div className={`preview-art compact source-identity kind-${fileKind}`}><Icon size={20} /><span>{fileKind.toUpperCase()}</span></div>
  if (previewSource) return <div className="preview-art image"><img src={previewSource} alt={node.title} draggable={false} onDragStart={(event) => event.preventDefault()} /></div>
  const domain = sourceDomain(node)
  return <div className={`preview-art source-identity kind-${fileKind}`}>
    <span className="source-file-icon"><Icon size={fileKind === 'image' ? 34 : 38} strokeWidth={1.45} /></span>
    <div className="source-file-copy">
      <small>{fileKind === 'ppt' ? 'POWERPOINT' : fileKind === 'pdf' ? 'PDF DOCUMENT' : fileKind === 'md' ? 'MARKDOWN' : fileKind === 'link' ? domain ?? 'WEB LINK' : fileKind === 'image' ? 'IMAGE SOURCE' : 'LOCAL FILE'}</small>
      <b>{node.title}</b>
      <p>{node.previewText?.trim() || (fileKind === 'link' ? node.subtitle || domain || '外部链接引用' : node.subtitle || previewStatusCopy(node))}</p>
    </div>
  </div>
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

function previewStatusCopy(node: CanvasNode): string {
  if (node.previewStatus === 'ready') return 'Preview ready'
  if (node.previewStatus === 'failed') return 'Preview failed'
  if (node.previewStatus === 'unsupported') return 'Preview unsupported'
  return 'Preview not generated'
}

function FeedbackVisual({ node, density, onDetails, showDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void; showDetails: boolean }) {
  const { change, keep } = feedbackSummary(node.subtitle)
  return <div className="feedback-visual">
    <header><span><MessageSquareText size={13} />反馈批注</span><small>{node.current ? 'CURRENT' : 'UNRESOLVED'}</small></header>
    <strong>{node.title}</strong>
    <div className="feedback-points">
      <p><b>Change</b><span>{change}</span></p>
      <p><b>Keep</b><span>{keep}</span></p>
    </div>
    {density === 'expanded' && <footer><span>锚定当前提案</span><span>07/17 · 客户</span></footer>}
    <InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails} />
  </div>
}

function feedbackSummary(subtitle: string): { change: string; keep: string } {
  const changeMatch = subtitle.match(/Change[：:]\s*([^·]+)/i)
  const keepMatch = subtitle.match(/Keep[：:]\s*(.+)$/i)
  return {
    change: changeMatch?.[1]?.trim() || subtitle.split('·')[0]?.trim() || '需要进一步明确修改范围',
    keep: keepMatch?.[1]?.trim() || subtitle.split('·')[1]?.trim() || '保留已确认内容',
  }
}

function ContextVisual({ node, density, onDetails, showDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void; showDetails: boolean }) {
  return <div className="context-visual">
    <header><span><Layers3 size={13} />内容集合</span><InfoButton show={showDetails} label="查看上下文信息" onDetails={onDetails} /></header>
    <strong>{node.title}</strong>
    {density !== 'compact' && <div className="context-stack"><i /><i /><i /></div>}
    <footer><span>{node.workspaceIds?.length ?? 0} 个工作空间</span><span>{formatNodeTime(node.createdAt)}</span></footer>
    {density === 'expanded' && <p className="context-summary">{node.subtitle || '集合只负责组织内容；实际语义与下一步由本地 Agent 判断。'}</p>}
  </div>
}

function ProcessVisual({ node, density, runId, runStatus, onDetails, showDetails }: { node: CanvasNode; density: NodeDisplayMode; runId: string; runStatus: RunStatus | null; onDetails: () => void; showDetails: boolean }) {
  const liveStatus = node.runStatus ?? (node.parentRunId === runId ? runStatus : null)
  const status = liveStatus ?? (node.subtitle.toLowerCase().includes('completed') || node.subtitle.includes('已完成') ? 'completed' : 'archived')
  const statusCopy = liveStatus ? runStatusLabel[liveStatus] : node.subtitle
  return <div className={`process-visual status-${status}`}>
    <span className="process-icon"><Play size={14} fill="currentColor" /></span>
    <div><small>{node.sourceProvider ? `执行路径 · ${node.sourceProvider}` : '执行路径'}</small><strong>{node.title}</strong><span>{statusCopy}</span><em>{node.commandText ?? node.sourcePrompt ?? '执行上下文与目标由来源 Run 冻结'} · {formatNodeTime(node.createdAt)}</em><footer className="process-counts"><span>Context {node.contextCount ?? 0}</span><span>Target {node.targetCount ?? 0}</span><span>Output {node.outputCount ?? 0}</span></footer></div>
    <InfoButton show={showDetails} label="查看执行信息" onDetails={onDetails} />
  </div>
}

function DecisionVisual({ node, density, onDetails, showDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void; showDetails: boolean }) {
  return <div className="decision-visual decision-material">
    <span className="decision-icon"><span className="decision-icon-chrome" aria-hidden="true" /><LockKeyhole size={17} /></span>
    <div><small>已确认决策</small><strong>{node.title}</strong><span>{node.subtitle}</span>{density === 'expanded' && <em>锁定于 {formatNodeTime(node.createdAt)}{node.sourceRunId ? ` · ${node.sourceRunId}` : ''}</em>}</div>
    <span className="status-chip locked">LOCKED</span>
    <span className="decision-material-glint" aria-hidden="true" />
    <InfoButton show={showDetails} label="查看决策信息" onDetails={onDetails} />
  </div>
}


function NoteVisual({ node, density, onDetails, showDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void; showDetails: boolean }) {
  return <div className="note-visual"><MessageSquareText size={16} /><div><small>文本</small><strong>{node.title}</strong><span>{node.subtitle}</span>{density === 'expanded' && <em>{formatNodeTime(node.createdAt)}{node.sourceRunId ? ` · ${node.sourceRunId}` : ''}</em>}</div><InfoButton show={showDetails} label={`查看 ${node.title} 信息`} onDetails={onDetails} /></div>
}

function InfoButton({ show, label, onDetails }: { show: boolean; label: string; onDetails: () => void }) {
  if (!show) return null
  return <button className="node-details pressable" aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><CircleHelp size={12} /></button>
}

function formatNodeTime(value?: string): string {
  if (!value) return '时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function getFileKind(node: CanvasNode): 'ppt' | 'pdf' | 'image' | 'md' | 'link' | 'file' {
  const name = node.title.toLowerCase()
  const type = node.fileType?.toLowerCase() ?? ''
  const linkLike = [node.previewText, node.observedPath, node.subtitle, node.title].some((value) => value ? /https?:\/\//i.test(value) : false)
  if (name.endsWith('.ppt') || name.endsWith('.pptx') || type.includes('presentation') || node.pageCount) return 'ppt'
  if (name.endsWith('.pdf') || type === 'pdf' || type === 'application/pdf') return 'pdf'
  if (name.match(/\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/) || type.startsWith('image/') || node.previewDataUrl || node.previewUrl) return 'image'
  if (linkLike || type === 'url' || type === 'link' || type === 'web') return 'link'
  if (name.endsWith('.md') || name.endsWith('.markdown') || type.includes('markdown') || type === 'text') return 'md'
  return 'file'
}

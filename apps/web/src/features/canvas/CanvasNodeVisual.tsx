import {
  Clock3,
  FileImage,
  FileText,
  Image as ImageIcon,
  Layers3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  MoreHorizontal,
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
}

export function CanvasNodeVisual({ node, density, runId, runStatus, pending, onDetails }: Props) {
  if (node.kind === 'process') return <ProcessVisual node={node} density={density} runId={runId} runStatus={runStatus} onDetails={onDetails} />
  if (node.kind === 'context') return <ContextVisual node={node} density={density} onDetails={onDetails} />
  if (node.kind === 'decision') return <DecisionVisual node={node} density={density} onDetails={onDetails} />
  if (node.kind === 'note') return <NoteVisual node={node} density={density} onDetails={onDetails} />
  return <ArtifactVisual node={node} density={density} pending={pending} onDetails={onDetails} />
}

function ArtifactVisual({ node, density, pending, onDetails }: Pick<Props, 'node' | 'density' | 'pending' | 'onDetails'>) {
  const meta = nodeMeta[node.kind]
  const fileKind = getFileKind(node)
  const Icon = fileKind === 'ppt' ? Presentation : fileKind === 'image' ? ImageIcon : FileText
  const stateLabel = node.current ? '当前版本' : node.draft ? 'AI 生成草稿' : '原始来源'

  return <div className={`artifact-visual ${node.kind === 'generated' ? 'artifact-generated-material' : ''}`}>
    <header className="artifact-topline">
      <span className="artifact-kind"><i style={{ background: meta.accent }} />{meta.label}</span>
      <span className="artifact-format"><Icon size={12} />{fileKind.toUpperCase()}</span>
    </header>
    <PreviewArtwork node={node} density={density} />
    <footer className="artifact-copy">
      <strong>{node.title}</strong>
      <span>{pending ? '结果待回收 · 等待确认' : node.subtitle}</span>
      {density === 'expanded' && <div className="artifact-expanded-meta">
        <span><Presentation size={11} />{node.pageCount ? `${node.pageCount} 页` : '1 个对象'}</span>
        <span><MessageSquareText size={11} />2 条备注</span>
        <span><Link2 size={11} />5 个关联</span>
        <span><Clock3 size={11} />今天 10:24</span>
      </div>}
      {density === 'expanded' && <small className="artifact-provenance">{stateLabel}{node.parentRunId ? ` · ${node.parentRunId}` : ''}</small>}
    </footer>
    <div className="artifact-statuses">
      {node.current && <span className="status-chip current">当前</span>}
      {node.draft && <span className="status-chip draft">待确认</span>}
      {node.kind === 'generated' && <span className="iridescent-token" aria-label="AI 生成结果"><Sparkles size={12} /></span>}
    </div>
    {node.kind === 'generated' && <span className="generated-material-glint" aria-hidden="true" />}
    <button className="node-details" aria-label={`打开 ${node.title} 状态`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><MoreHorizontal size={14} /></button>
  </div>
}

function PreviewArtwork({ node, density }: { node: CanvasNode; density: NodeDisplayMode }) {
  if (density === 'compact') return <div className="preview-art compact"><FileImage size={20} /><span>{getFileKind(node).toUpperCase()}</span></div>
  if (node.previewUrl) return <div className="preview-art image"><img src={node.previewUrl} alt="" /></div>
  const fileKind = getFileKind(node)
  if (fileKind === 'ppt') return <div className={`preview-art ppt ${node.kind}`}>
    <div className="slide-copy">
      <div className="ppt-kicker">{node.fileType ?? 'RUNTIME SOURCE'}</div>
      <div className="ppt-title">{node.title}</div>
      <div className="ppt-subtitle">{node.subtitle || previewStatusCopy(node)}</div>
    </div>
    <div className="slide-scene" aria-hidden="true"><i className="scene-window" /><i className="scene-statue" /><i className="scene-product" /></div>
    <div className="ppt-strip"><i /><i /><i /></div>
  </div>
  if (fileKind === 'image') return <div className="preview-art reference-image"><div className="reference-sun" /><div className="reference-horizon" /><div className="reference-object" /></div>
  return <div className="preview-art document"><span>{node.fileType ?? 'Document'}</span><b>{node.title}</b><i /><i /></div>
}

function previewStatusCopy(node: CanvasNode): string {
  if (node.previewStatus === 'ready') return 'Preview ready'
  if (node.previewStatus === 'failed') return 'Preview failed'
  if (node.previewStatus === 'unsupported') return 'Preview unsupported'
  return 'Preview not generated'
}

function ContextVisual({ node, density, onDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void }) {
  return <div className="context-visual">
    <header><span><Layers3 size={13} />内容集合</span><button className="node-details" aria-label="打开上下文状态" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><MoreHorizontal size={14} /></button></header>
    <strong>{node.title}</strong>
    {density !== 'compact' && <div className="context-stack"><i /><i /><i /></div>}
    <footer><span>3 个参考</span><span>1 个关联</span></footer>
    {density === 'expanded' && <p className="context-summary">构图参考、客户限制与视觉基调已整理，可直接用于下一次执行。</p>}
  </div>
}

function ProcessVisual({ node, density, runId, runStatus, onDetails }: { node: CanvasNode; density: NodeDisplayMode; runId: string; runStatus: RunStatus | null; onDetails: () => void }) {
  const liveStatus = node.runStatus ?? (node.parentRunId === runId ? runStatus : null)
  const status = liveStatus ?? (node.subtitle.toLowerCase().includes('completed') || node.subtitle.includes('已完成') ? 'completed' : 'archived')
  const statusCopy = liveStatus ? runStatusLabel[liveStatus] : node.subtitle
  return <div className={`process-visual status-${status}`}>
    <span className="process-icon"><Play size={14} fill="currentColor" /></span>
    <div><small>执行</small><strong>{node.title}</strong><span>{statusCopy}</span>{density === 'expanded' && <em>目标：当前提案.pptx · 上下文 3 个对象</em>}</div>
    <button className="node-details" aria-label="打开执行状态" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><MoreHorizontal size={14} /></button>
  </div>
}

function DecisionVisual({ node, density, onDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void }) {
  return <div className="decision-visual decision-material">
    <span className="decision-icon"><span className="decision-icon-chrome" aria-hidden="true" /><LockKeyhole size={17} /></span>
    <div><small>人工决策</small><strong>{node.title}</strong><span>{node.subtitle}</span>{density === 'expanded' && <em>锁定于今天 10:18 · 影响 2 个工作视角</em>}</div>
    <span className="status-chip locked">已锁定</span>
    <span className="decision-material-glint" aria-hidden="true" />
    <button className="node-details" aria-label="打开决策状态" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><MoreHorizontal size={14} /></button>
  </div>
}

function NoteVisual({ node, density, onDetails }: { node: CanvasNode; density: NodeDisplayMode; onDetails: () => void }) {
  return <div className="note-visual"><MessageSquareText size={16} /><div><small>备注</small><strong>{node.title}</strong><span>{node.subtitle}</span>{density === 'expanded' && <em>文件级备注 · 今天 10:12</em>}</div><button className="node-details" aria-label="打开备注状态" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDetails() }}><MoreHorizontal size={14} /></button></div>
}

function getFileKind(node: CanvasNode): 'ppt' | 'image' | 'md' {
  const name = node.title.toLowerCase()
  if (name.endsWith('.ppt') || name.endsWith('.pptx') || node.pageCount) return 'ppt'
  if (name.match(/\.(jpg|jpeg|png|webp|gif)$/) || node.previewUrl) return 'image'
  return 'md'
}

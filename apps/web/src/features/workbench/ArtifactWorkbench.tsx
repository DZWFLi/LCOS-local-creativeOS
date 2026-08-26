import { Crosshair, FileText, GitBranch, History, RefreshCw, ScanSearch, X } from 'lucide-react'

import type { CanvasNode } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import { ArtifactRevisionCompare } from './ArtifactRevisionCompare'
import { ArtifactViewerHost, artifactViewerRegistry, resolveArtifactViewerKind } from '../viewer/artifactViewerRegistry'

export type WorkbenchFocus = 'preview' | 'overview' | 'revisions'

interface Props {
  node: CanvasNode
  projectId: string
  client: LocalCoreClient
  relationCount: number
  focus: WorkbenchFocus
  onFocusChange: (focus: WorkbenchFocus) => void
  onClose: () => void
  onLocate: () => void
  onUseRevision: (revision: ArtifactRevisionProvenance) => void
  onShowResource?: () => void
  onRefreshFile?: () => void
  onAdoptExternalChange?: () => void
}

function formatTime(value?: string): string {
  if (!value) return '时间未记录'
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? value : time.toLocaleString()
}

/**
 * Single-instance Artifact Workbench. Preview stays read-only; revision actions
 * only select a historical base for a new Draft Run and never overwrite it.
 */
export function ArtifactWorkbench(props: Props) {
  const { node, focus } = props
  const descriptor = artifactViewerRegistry[resolveArtifactViewerKind(node)]

  return (
    <aside className="artifact-workbench" data-testid="artifact-workbench" data-kind={node.kind} data-focus={focus} role="complementary" aria-label={`${node.title} 对象工作台`}>
      <header className="workbench-header">
        <div className="workbench-heading">
          <small>内容工作台 · {focus === 'preview' ? descriptor.label : focus === 'revisions' ? '版本与来源' : '内容概览'}</small>
          <h3>{node.title}</h3>
        </div>
        <button className="icon-button pressable" type="button" aria-label="关闭工作台" onClick={props.onClose}><X size={16} /></button>
      </header>
      <nav className="workbench-nav" aria-label="工作台视图">
        <button type="button" className={focus === 'preview' ? 'active' : ''} onClick={() => props.onFocusChange('preview')}>预览</button>
        <button type="button" className={focus === 'overview' ? 'active' : ''} onClick={() => props.onFocusChange('overview')}>概览</button>
        {node.artifactId && <button type="button" className={focus === 'revisions' ? 'active' : ''} onClick={() => props.onFocusChange('revisions')}>版本 {node.revisionCount ? `· ${node.revisionCount}` : ''}</button>}
      </nav>
      <main className="workbench-body">
        {focus === 'preview'
          ? <ArtifactViewerHost node={node} projectId={props.projectId} />
          : focus === 'revisions'
            ? <ArtifactRevisionCompare node={node} projectId={props.projectId} client={props.client} onUseRevision={props.onUseRevision} />
            : <div className="workbench-overview">
                <dl className="workbench-meta">
                  <div><dt>内容类型</dt><dd>{node.fileType ?? node.kind}</dd></div>
                  <div><dt>版本状态</dt><dd>{node.historical ? '历史版本' : node.draft ? '待确认版本' : node.current ? '当前版本' : '—'}</dd></div>
                  <div><dt>版本</dt><dd>{node.revisionLabel ?? (node.revisionId ? '已记录' : '—')}</dd></div>
                  <div><dt>创建时间</dt><dd>{formatTime(node.createdAt)}</dd></div>
                  <div><dt>来源</dt><dd>{node.sourceRunId ? 'Agent 任务' : '人工或外部文件'}</dd></div>
                  <div><dt>关联数量</dt><dd>{props.relationCount}</dd></div>
                  <div><dt>预览状态</dt><dd>{humanPreviewStatus(node.previewStatus)}</dd></div>
                  <div><dt>本地文件</dt><dd>{humanFileAvailability(node.fileAvailability)}</dd></div>
                </dl>
                <div className="workbench-actions">
                  <button type="button" className="pressable" onClick={props.onLocate}><Crosshair size={13} />在画布中定位</button>
                  {props.onShowResource !== undefined && <button type="button" className="pressable" onClick={props.onShowResource}><ScanSearch size={13} />系统理解</button>}
                  {props.onRefreshFile !== undefined && <button type="button" className="pressable" onClick={props.onRefreshFile}><RefreshCw size={13} />检查外部变化</button>}
                  {node.fileAvailability === 'stale' && props.onAdoptExternalChange !== undefined && <button type="button" className="pressable" onClick={props.onAdoptExternalChange}><History size={13} />使用外部版本</button>}
                </div>
                <p className="workbench-hint"><GitBranch size={12} />单击节点发起局部 Run；这里负责预览、版本来源与只读检查。</p>
                <p className="workbench-hint"><FileText size={12} />外部 Reference 只能作为上下文，受管内容才可产生 Draft Revision。</p>
              </div>}
      </main>
    </aside>
  )
}


function humanPreviewStatus(value?: string): string {
  if (value === 'ready') return '可查看'
  if (value === 'generating' || value === 'pending') return '正在准备'
  if (value === 'failed') return '暂时无法预览'
  return '尚未生成'
}

function humanFileAvailability(value?: string): string {
  if (value === 'current') return '与磁盘一致'
  if (value === 'stale') return '外部已发生变化'
  if (value === 'missing') return '原文件暂时找不到'
  if (value === 'unreadable') return '原文件暂时无法读取'
  return value ? '状态待确认' : '未绑定本地文件'
}

import { Crosshair, FileText, GitBranch, ScanSearch, X } from 'lucide-react'

import type { CanvasNode } from '../../model'
import { ArtifactViewerHost, artifactViewerRegistry, resolveArtifactViewerKind } from '../viewer/artifactViewerRegistry'

export type WorkbenchFocus = 'preview' | 'overview'

interface Props {
  node: CanvasNode
  projectId: string
  relationCount: number
  focus: WorkbenchFocus
  onFocusChange: (focus: WorkbenchFocus) => void
  onClose: () => void
  onLocate: () => void
  onShowResource?: () => void
}

/**
 * Right-center Artifact Workbench (UI-02): single instance, default closed,
 * local nav stack (preview ⇄ overview), Esc closes. Shares the ActiveContext
 * selection with the WorkRail and CLI/MCP via the existing selection sync.
 */
export function ArtifactWorkbench(props: Props) {
  const { node, focus } = props
  const descriptor = artifactViewerRegistry[resolveArtifactViewerKind(node)]
  return (
    <aside className="artifact-workbench" data-testid="artifact-workbench" data-kind={node.kind} data-focus={focus} role="complementary" aria-label={`${node.title} 对象工作台`}>
      <header className="workbench-header">
        <div className="workbench-heading">
          <small>ARTIFACT WORKBENCH · {focus === 'preview' ? descriptor.label : '对象概览'}</small>
          <h3>{node.title}</h3>
        </div>
        <button className="icon-button pressable" type="button" aria-label="关闭工作台" onClick={props.onClose}><X size={16} /></button>
      </header>
      <nav className="workbench-nav" aria-label="工作台视图">
        <button type="button" className={focus === 'preview' ? 'active' : ''} onClick={() => props.onFocusChange('preview')}>预览</button>
        <button type="button" className={focus === 'overview' ? 'active' : ''} onClick={() => props.onFocusChange('overview')}>概览</button>
      </nav>
      <main className="workbench-body">
        {focus === 'preview'
          ? <ArtifactViewerHost node={node} projectId={props.projectId} />
          : <div className="workbench-overview">
              <dl className="workbench-meta">
                <div><dt>节点类型</dt><dd>{node.kind}</dd></div>
                <div><dt>文件类型</dt><dd>{node.fileType ?? '—'}</dd></div>
                <div><dt>Revision</dt><dd>{node.revisionId ?? '—'}</dd></div>
                <div><dt>关联数量</dt><dd>{props.relationCount}</dd></div>
                <div><dt>预览状态</dt><dd>{node.previewStatus ?? 'not-generated'}</dd></div>
                <div><dt>文件可用性</dt><dd>{node.fileAvailability ?? '—'}</dd></div>
              </dl>
              <div className="workbench-actions">
                <button type="button" className="pressable" onClick={props.onLocate}><Crosshair size={13} />在画布中定位</button>
                {props.onShowResource !== undefined && <button type="button" className="pressable" onClick={props.onShowResource}><ScanSearch size={13} />资源理解</button>}
              </div>
              <p className="workbench-hint"><GitBranch size={12} />双击文件在右侧打开只读预览；所有 Viewer 由统一 Registry 提供。</p>
              <p className="workbench-hint"><FileText size={12} />编辑能力未开放：未来 Editor 只产生 Working/Draft Revision。</p>
            </div>}
      </main>
    </aside>
  )
}

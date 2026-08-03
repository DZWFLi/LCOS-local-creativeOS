import { useEffect, useMemo, useState } from 'react'
import { Clock3, Crosshair, FileText, GitBranch, History, RotateCcw, ScanSearch, Sparkles, X } from 'lucide-react'

import type { CanvasNode } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { parseArtifactRevisions, summarizeRevisionCompare, type ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
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
  const [revisions, setRevisions] = useState<ArtifactRevisionProvenance[]>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [compareSummary, setCompareSummary] = useState<string | null>(null)
  const [comparingId, setComparingId] = useState<string | null>(null)

  useEffect(() => {
    if (!node.artifactId || focus !== 'revisions') return
    const controller = new AbortController()
    setLoadingRevisions(true)
    setRevisionError(null)
    void Promise.all([
      props.client.artifactDetail(node.artifactId, controller.signal),
      props.client.revisionList(node.artifactId, controller.signal),
    ]).then(([detailCall, listCall]) => {
      if (!detailCall.result.ok && !listCall.result.ok) {
        setRevisionError(detailCall.result.error.message || listCall.result.error.message)
        return
      }
      const next = parseArtifactRevisions(
        detailCall.result.ok ? detailCall.result.value : undefined,
        listCall.result.ok ? listCall.result.value : undefined,
        node.revisionId,
      )
      setRevisions(next)
    }).finally(() => setLoadingRevisions(false))
    return () => controller.abort()
  }, [focus, node.artifactId, node.revisionId, props.client])

  const currentRevision = useMemo(() => revisions.find((revision) => revision.current)
    ?? revisions.find((revision) => revision.id === node.revisionId)
    ?? revisions[0], [node.revisionId, revisions])

  const compareWithCurrent = (revision: ArtifactRevisionProvenance) => {
    if (!currentRevision || revision.id === currentRevision.id) return
    setComparingId(revision.id)
    setCompareSummary(null)
    void props.client.revisionCompare(props.projectId, revision.id, currentRevision.id).then((call) => {
      if (!call.result.ok) {
        setCompareSummary(`对比失败：${call.result.error.message}`)
        return
      }
      setCompareSummary(`${revision.label} → ${currentRevision.label}：${summarizeRevisionCompare(call.result.value)}`)
    }).finally(() => setComparingId(null))
  }

  return (
    <aside className="artifact-workbench" data-testid="artifact-workbench" data-kind={node.kind} data-focus={focus} role="complementary" aria-label={`${node.title} 对象工作台`}>
      <header className="workbench-header">
        <div className="workbench-heading">
          <small>ARTIFACT WORKBENCH · {focus === 'preview' ? descriptor.label : focus === 'revisions' ? '版本与来源' : '对象概览'}</small>
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
            ? <section className="workbench-revisions" aria-label="版本与来源">
                <header>
                  <div><History size={14} /><span>同一内容的不可变版本</span></div>
                  <small>继续修改只会创建新 Draft</small>
                </header>
                {loadingRevisions && <div className="workbench-loading"><Sparkles size={14} />正在读取版本来源…</div>}
                {revisionError && <div className="workbench-error">版本读取失败：{revisionError}</div>}
                {!loadingRevisions && !revisionError && <ol>
                  {revisions.map((revision) => <li key={revision.id} className={revision.current ? 'current' : revision.id === node.revisionId ? 'viewing' : ''}>
                    <div className="revision-rail-dot" />
                    <article>
                      <header><strong>{revision.label}</strong><span>{revision.current ? 'Current' : revision.draft ? 'Draft' : 'Historical'}</span></header>
                      <p>{revision.prompt ?? '该版本没有可显示的原始提示词。'}</p>
                      <dl>
                        <div><dt>Agent</dt><dd>{revision.provider ?? '未记录'}</dd></div>
                        <div><dt>Run</dt><dd>{revision.runId ?? '未关联'}</dd></div>
                        <div><dt><Clock3 size={11} />创建</dt><dd>{formatTime(revision.createdAt)}</dd></div>
                      </dl>
                      <footer>
                        {!revision.current && <button type="button" className="pressable" onClick={() => props.onUseRevision(revision)}><RotateCcw size={12} />基于此版本继续</button>}
                        {!revision.current && currentRevision && <button type="button" className="pressable" disabled={comparingId === revision.id} onClick={() => compareWithCurrent(revision)}><GitBranch size={12} />与 Current 对比</button>}
                      </footer>
                    </article>
                  </li>)}
                </ol>}
                {compareSummary && <div className="revision-compare-summary">{compareSummary}</div>}
              </section>
            : <div className="workbench-overview">
                <dl className="workbench-meta">
                  <div><dt>内容类型</dt><dd>{node.fileType ?? node.kind}</dd></div>
                  <div><dt>版本状态</dt><dd>{node.historical ? 'Historical' : node.draft ? 'Draft' : node.current ? 'Current' : '—'}</dd></div>
                  <div><dt>Revision</dt><dd>{node.revisionLabel ?? node.revisionId ?? '—'}</dd></div>
                  <div><dt>创建时间</dt><dd>{formatTime(node.createdAt)}</dd></div>
                  <div><dt>来源 Run</dt><dd>{node.sourceRunId ?? '—'}</dd></div>
                  <div><dt>关联数量</dt><dd>{props.relationCount}</dd></div>
                  <div><dt>预览状态</dt><dd>{node.previewStatus ?? 'not-generated'}</dd></div>
                  <div><dt>文件可用性</dt><dd>{node.fileAvailability ?? '—'}</dd></div>
                </dl>
                <div className="workbench-actions">
                  <button type="button" className="pressable" onClick={props.onLocate}><Crosshair size={13} />在画布中定位</button>
                  {props.onShowResource !== undefined && <button type="button" className="pressable" onClick={props.onShowResource}><ScanSearch size={13} />资源理解</button>}
                </div>
                <p className="workbench-hint"><GitBranch size={12} />单击节点发起局部 Run；这里负责预览、版本来源与只读检查。</p>
                <p className="workbench-hint"><FileText size={12} />外部 Reference 只能作为上下文，受管内容才可产生 Draft Revision。</p>
              </div>}
      </main>
    </aside>
  )
}

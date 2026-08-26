import { useEffect, useMemo, useState } from 'react'
import { Clock3, GitBranch, History, RotateCcw, Sparkles } from 'lucide-react'

import type { CanvasNode } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { parseArtifactRevisions, summarizeRevisionCompare, type ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import { buildChangeTrace } from '../trace/changeTrace'

interface Props {
  readonly node: CanvasNode
  readonly projectId: string
  readonly client: LocalCoreClient
  readonly onUseRevision?: (revision: ArtifactRevisionProvenance) => void
}

function formatTime(value?: string): string {
  if (!value) return '时间未记录'
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? value : time.toLocaleString()
}

/**
 * 可复用的 artifact 版本对比组件：读取 revisions、展示历史、与当前版本对比、变更轨迹。
 * 原本内嵌在 ArtifactWorkbench 中，现在供 WebWorkbench / ArtifactWorkbench 共用。
 */
export function ArtifactRevisionCompare(props: Props) {
  const { node, projectId, client, onUseRevision } = props
  const [revisions, setRevisions] = useState<ArtifactRevisionProvenance[]>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [compareSummary, setCompareSummary] = useState<string | null>(null)
  const [comparingId, setComparingId] = useState<string | null>(null)

  useEffect(() => {
    if (!node.artifactId) return
    const controller = new AbortController()
    setLoadingRevisions(true)
    setRevisionError(null)
    void Promise.all([
      client.artifactDetail(node.artifactId, controller.signal),
      client.revisionList(node.artifactId, controller.signal),
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
  }, [node.artifactId, node.revisionId, client])

  const currentRevision = useMemo(() => revisions.find((revision) => revision.current)
    ?? revisions.find((revision) => revision.id === node.revisionId)
    ?? revisions[0], [node.revisionId, revisions])

  const compareWithCurrent = (revision: ArtifactRevisionProvenance) => {
    if (!currentRevision || revision.id === currentRevision.id) return
    setComparingId(revision.id)
    setCompareSummary(null)
    void client.revisionCompare(projectId, revision.id, currentRevision.id).then((call) => {
      if (!call.result.ok) {
        setCompareSummary(`对比失败：${call.result.error.message}`)
        return
      }
      setCompareSummary(`${revision.label} → ${currentRevision.label}：${summarizeRevisionCompare(call.result.value)}`)
    }).catch((error) => {
      setCompareSummary(`对比失败：${error instanceof Error ? error.message : String(error)}`)
      setComparingId(null)
    }).finally(() => setComparingId(null))
  }

  const changeTrace = useMemo(() => buildChangeTrace(revisions), [revisions])

  return (
    <section className="workbench-revisions" aria-label="版本与来源">
      <header>
        <div><History size={14} /><span>同一内容的不可变版本</span></div>
        <small>继续修改只会创建新 Draft</small>
      </header>
      {loadingRevisions && <div className="workbench-loading"><Sparkles size={14} />正在读取版本来源…</div>}
      {revisionError && <div className="workbench-error">版本读取失败：{revisionError}</div>}
      {!loadingRevisions && !revisionError && (
        <ol>
          {revisions.map((revision) => (
            <li key={revision.id} className={revision.current ? 'current' : revision.id === node.revisionId ? 'viewing' : ''}>
              <div className="revision-rail-dot" />
              <article>
                <header><strong>{revision.label}</strong><span>{revision.current ? '当前版本' : revision.draft ? '待确认版本' : '历史版本'}</span></header>
                <p>{revision.prompt ?? '该版本没有可显示的原始提示词。'}</p>
                <dl>
                  <div><dt>处理者</dt><dd>{revision.provider ?? '未记录'}</dd></div>
                  <div><dt>Agent 任务</dt><dd>{revision.runId ? '已关联，可在诊断中查看' : '未关联'}</dd></div>
                  <div><dt><Clock3 size={11} />创建</dt><dd>{formatTime(revision.createdAt)}</dd></div>
                </dl>
                <footer>
                  {!revision.current && onUseRevision && (
                    <button type="button" className="pressable" onClick={() => onUseRevision(revision)}>
                      <RotateCcw size={12} />基于此版本继续
                    </button>
                  )}
                  {!revision.current && currentRevision && (
                    <button type="button" className="pressable" disabled={comparingId === revision.id} onClick={() => compareWithCurrent(revision)}>
                      <GitBranch size={12} />与 Current 对比
                    </button>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ol>
      )}
      {changeTrace.length > 0 && (
        <section className="workbench-change-trace" aria-label="变更轨迹">
          <header><div><GitBranch size={14} /><span>变更轨迹 · 内容 / 来源 / 历史</span></div></header>
          <ol>
            {changeTrace.map((entry) => (
              <li key={entry.revisionId}>
                <strong>{entry.action}</strong>
                <span>{entry.actor === 'agent' ? 'Agent' : entry.actor === 'system' ? '系统' : '用户'}</span>
                <em>{formatTime(entry.at)}</em>
                {entry.reasonSummary && <p>{entry.reasonSummary}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {compareSummary && <div className="revision-compare-summary">{compareSummary}</div>}
    </section>
  )
}

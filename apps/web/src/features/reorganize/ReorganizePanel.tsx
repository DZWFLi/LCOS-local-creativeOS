import { Drawer } from '@base-ui/react/drawer'
import { Check, Layers3, RotateCcw, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReorganizePreviewV0, ReorganizeProposalV0 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import type { CanvasNode } from '../../model'
import type { LayoutPosition } from '../layout/layoutTypes'
import { LcosGlyph } from '../spatial/visual/LcosGlyph'

interface Props {
  readonly projectId: string
  readonly scopeId: string
  readonly nodes: readonly CanvasNode[]
  readonly selectedIds: readonly string[]
  readonly client: LocalCoreClient
  readonly onClose: () => void
  readonly onApplied: (message: string) => void
  /** Kept for compatibility with App's transient overlay contract. V2 no longer uses ghost-preview-first. */
  readonly onGhost: (positions: readonly LayoutPosition[] | null) => void
  /** Mirrors a Core-persisted position patch immediately so the user sees the real change, not a ghost. */
  readonly onLivePositions?: (positions: readonly LayoutPosition[], phase: 'apply' | 'revert') => void
  readonly onReviewSettled?: () => void
}

type ReviewStage = 'compose' | 'running' | 'review' | 'reverted'

export function buildSafeReorganizePositions(nodes: readonly CanvasNode[]): LayoutPosition[] {
  if (!nodes.length) return []
  const ordered = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const originX = Math.min(...ordered.map((node) => node.x))
  const originY = Math.min(...ordered.map((node) => node.y))
  const cellWidth = Math.max(190, ...ordered.map((node) => node.width)) + 34
  const cellHeight = Math.max(96, ...ordered.map((node) => node.height)) + 28
  const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(ordered.length))))
  return ordered.map((node, index) => ({
    id: node.id,
    x: Math.round(originX + (index % columns) * cellWidth),
    y: Math.round(originY + Math.floor(index / columns) * cellHeight),
  }))
}

/**
 * Huabu convergence V2.
 *
 * Product behavior now starts from an instruction and applies the existing safe
 * Reorganize ChangeSet directly, then leaves the whole run pending for review.
 * We intentionally do NOT fake per-change keep/revert or hold-to-see-before:
 * current LocalCoreClient only exposes proposal-level apply/rollback. The UI
 * marks that capability gap until Core exposes item-level ChangeSet operations.
 */
export function ReorganizePanel({ projectId, scopeId, nodes, selectedIds, client, onClose, onApplied, onGhost, onLivePositions, onReviewSettled }: Props) {
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState<ReorganizeProposalV0 | null>(null)
  const [preview, setPreview] = useState<ReorganizePreviewV0 | null>(null)
  const [stage, setStage] = useState<ReviewStage>('compose')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [beforePositions, setBeforePositions] = useState<readonly LayoutPosition[]>([])
  const [appliedPositions, setAppliedPositions] = useState<readonly LayoutPosition[]>([])

  const presentationId = `presentation:context:${scopeId}`
  const selection = useMemo(() => {
    const ids = new Set(selectedIds)
    return nodes.filter((node) => ids.has(node.id))
  }, [nodes, selectedIds])
  const hasSelection = selection.length > 0
  const scopeLabel = hasSelection ? `${selection.length} 个已选材料` : '当前主画布'

  const summary = useMemo(() => {
    if (!preview) return [] as Array<{ label: string; count: number; tone?: string }>
    const rows: Array<{ label: string; count: number; tone?: string }> = []
    if (preview.willMerge.length) rows.push({ label: '归组', count: preview.willMerge.length })
    if (preview.willRemovePresentationMembers.length) rows.push({ label: '移出当前画布', count: preview.willRemovePresentationMembers.length })
    if (preview.relationAdds) rows.push({ label: '新增呈现关系', count: preview.relationAdds })
    if (preview.relationRemoves) rows.push({ label: '移除呈现关系', count: preview.relationRemoves })
    if (preview.hierarchyChanges) rows.push({ label: '层级调整', count: preview.hierarchyChanges })
    if (preview.emphasisChanges) rows.push({ label: '强调调整', count: preview.emphasisChanges })
    if (preview.positionChanges) rows.push({ label: '位置调整', count: preview.positionChanges })
    if (preview.willDeleteArtifacts.length) rows.push({ label: '另行清理候选', count: preview.willDeleteArtifacts.length, tone: 'warn' })
    return rows
  }, [preview])
  const changeCount = useMemo(() => summary.reduce((total, item) => total + item.count, 0), [summary])

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    setStage('running')
    onGhost(null)
    try {
      const view = await client.presentationGet(projectId, presentationId)
      if (!view.result.ok) throw new Error(view.result.error.message)
      const presentation = view.result.value
      const baseVersion = presentation.version
      const members = new Set(presentation.state.memberViewIds)
      const pinned = new Set(presentation.state.pinnedViewIds)
      const selectedMemberIds = selection.map((node) => node.id).filter((id) => members.has(id))
      const candidateIds = selectedMemberIds.length ? selectedMemberIds : presentation.state.memberViewIds
      const candidates = candidateIds
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is CanvasNode => Boolean(node) && !pinned.has(node!.id) && !node!.positionLocked)
      const positionPlan = buildSafeReorganizePositions(candidates)
      if (!positionPlan.length) throw new Error('当前没有可安全移动的材料；固定位置会保持不动。')
      const previous = positionPlan.map((position) => {
        const node = nodes.find((item) => item.id === position.id)!
        return { id: position.id, x: node.x, y: node.y }
      })
      setBeforePositions(previous)
      setAppliedPositions(positionPlan)
      const created = await client.createReorganizeProposal(projectId, {
        presentationId,
        baseVersion,
        layoutIntent: { engine: 'elk' as const, preservePinned: true },
        positionPatch: Object.fromEntries(positionPlan.map((position) => [position.id, { x: position.x, y: position.y }])),
      })
      if (!created.result.ok) throw new Error(created.result.error.message)
      setProposal(created.result.value)

      const prepared = await client.previewReorganize(projectId, created.result.value.id)
      if (!prepared.result.ok) throw new Error(prepared.result.error.message)

      // V2: do not stop at a semi-transparent candidate layout. Apply the safe
      // presentation ChangeSet and let the user review/revert the resulting run.
      const applied = await client.applyReorganize(projectId, created.result.value.id, false)
      if (!applied.result.ok) throw new Error(applied.result.error.message)
      setPreview(applied.result.value)
      onLivePositions?.(positionPlan, 'apply')
      setStage('review')
      onApplied(`智能体整理已执行 · ${Math.max(1, prepared.result.value.willMerge.length + prepared.result.value.willRemovePresentationMembers.length)} 项变化待确认`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '整理失败')
      setStage('compose')
    } finally {
      setBusy(false)
    }
  }, [client, nodes, onApplied, onGhost, onLivePositions, presentationId, projectId, selection])

  const keepAll = useCallback(async () => {
    if (!proposal) return
    setBusy(true)
    setError(null)
    try {
      const result = await client.acceptReorganize(projectId, proposal.id)
      if (!result.result.ok) throw new Error(result.result.error.message)
      onReviewSettled?.()
      onApplied(`已保留本轮整理${changeCount ? ` · ${changeCount} 项变化` : ''}`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法确认本轮整理')
    } finally {
      setBusy(false)
    }
  }, [changeCount, client, onApplied, onClose, onReviewSettled, projectId, proposal])

  const revertAll = useCallback(async () => {
    if (!proposal) return
    setBusy(true)
    setError(null)
    try {
      const result = await client.rollbackReorganize(projectId, proposal.id)
      if (!result.result.ok) throw new Error(result.result.error.message)
      onLivePositions?.(beforePositions, 'revert')
      onReviewSettled?.()
      setStage('reverted')
      onApplied('已安全撤回本轮整理')
    } catch (err) {
      setError(err instanceof Error ? err.message : '当前变化无法安全撤回')
    } finally {
      setBusy(false)
    }
  }, [beforePositions, client, onApplied, onLivePositions, onReviewSettled, projectId, proposal])

  useEffect(() => () => onGhost(null), [onGhost])

  return <Drawer.Root open onOpenChange={(open) => { if (!open && stage !== 'review') onClose() }} modal={false} disablePointerDismissal swipeDirection="down">
    <Drawer.Portal>
      <Drawer.Viewport className="lcos-review-drawer-viewport">
        <Drawer.Popup className="lcos-review-drawer-popup">
          <Drawer.Content className="lcos-review-drawer-content">
            <div className="lcos-review-drawer-handle" aria-hidden="true"/>
            <aside className={`reorganize-panel lcos-reorganize-review stage-${stage}`} data-testid="reorganize-panel" aria-label="智能体整理">
    <header>
      <div><span className="lcos-reorganize-signal"><Layers3 size={14}/></span><span><strong>智能体整理</strong><small>{scopeLabel} · 只改当前画布呈现</small></span></div>
      <button className="icon-only pressable" aria-label={stage === 'review' ? '先确认本轮整理' : '关闭智能体整理'} disabled={stage === 'review'} onClick={onClose}><X size={14}/></button>
    </header>

    {stage === 'compose' && <div className="lcos-reorganize-compose">
      <label htmlFor="lcos-reorganize-instruction">你希望怎么整理？</label>
      <textarea
        id="lcos-reorganize-instruction"
        data-base-ui-swipe-ignore
        value={instruction}
        autoFocus
        placeholder={hasSelection ? '例如：按内容关系分组，减少交叉线；左边三张参考图不要动。' : '例如：按目前真实关系梳理，保留我已经摆好的几个主要区域。'}
        onChange={(event) => setInstruction(event.target.value)}
      />
      <div className="lcos-reorganize-scope">
        <span>{hasSelection ? 'Selection 是本轮焦点；固定位置保持不动，位置变化写入同一个可回滚 ChangeSet' : '固定位置会被保留；已有材料不会因为进入整理而持续自动重排'}</span>
      </div>
      {error && <p className="reorganize-error">{error}</p>}
      <button className="primary pressable" disabled={busy} onClick={() => void run()}><Sparkles size={14}/>开始整理</button>
    </div>}

    {stage === 'running' && <div className="lcos-reorganize-running" aria-live="polite">
      <span className="lcos-reorganize-running-signal" aria-label="智能体正在整理"><LcosGlyph state="working"/></span>
      <strong>正在整理当前画布</strong>
      <small>真实位置写入 ChangeSet · 变化会直接在画布上播放</small>
    </div>}

    {stage === 'review' && <div className="lcos-reorganize-pending" data-review-state="pending">
      <div className="lcos-reorganize-review-title"><div><strong>整理完成</strong><small>{changeCount || '本轮'} 项变化待确认</small></div><span className="lcos-review-pending-signal"><LcosGlyph state="waiting"/>待确认</span></div>
      {summary.length ? <ul className="lcos-reorganize-change-summary">{summary.map((item) => <li key={item.label} className={item.tone ?? ''}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul> : <p className="reorganize-empty">本轮主要是位置整理，没有其它结构性变化。</p>}
      <div className="lcos-reorganize-core-gap" data-core-gap="item-review">
        <strong>逐项审查等待 Core 能力</strong>
        <span>当前真实支持整轮 position / hierarchy / relation / emphasis ChangeSet 与冲突安全 rollback；没有伪造逐项 Keep/Revert。内容语义归组只在 Agent 真正提供对应 patch 时出现。</span>
      </div>
      {error && <p className="reorganize-error">{error}</p>}
      <div className="reorganize-actions">
        <button className="primary pressable" disabled={busy} onClick={keepAll}><Check size={14}/>全部保留</button>
        <button className="quiet pressable" disabled={busy} onClick={() => void revertAll()}><RotateCcw size={14}/>全部撤回</button>
      </div>
    </div>}

    {stage === 'reverted' && <div className="reorganize-applied">
      <p><RotateCcw size={14}/>本轮整理已撤回，画布回到安全状态。</p>
      <button className="quiet pressable" onClick={onClose}>完成</button>
    </div>}
            </aside>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
}

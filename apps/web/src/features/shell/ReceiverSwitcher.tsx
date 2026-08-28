import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Unplug, X } from 'lucide-react'
import type { ConnectedConversationV1 } from '@local-creative-os/contracts'
import { projectConnectedConversationStatusV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient, RuntimeCall } from '../../runtime/localCoreClient'
import type { ProjectReceiverBindingV1 } from '@local-creative-os/contracts'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { handoffSurfaceKindLabel, receiverSiteMismatch, type ReceiverHandoffContext, type ReceiverSiteMismatch } from './receiverHandoff'
import { relativeTime } from './relativeTime'

/** provider 徽标文案（与 SurfaceComposerBar 的显示惯例一致）。 */
export function receiverProviderLabel(provider: ConnectedConversationV1['provider']): string {
  return provider === 'codex' ? 'Codex' : provider === 'workbuddy' ? 'WorkBuddy' : provider
}

/** RECEIVER-3 切换时的 Handoff 快照入参（from=切换前 active receiver，可为 null=首次承接）。 */
export interface SwitchHandoffInput {
  readonly fromConversationId: string | null
  readonly surface: ReceiverHandoffContext['surface']
  readonly selectionEntityIds: readonly string[]
}

interface Props {
  readonly open: boolean
  readonly projectId: string
  readonly client: LocalCoreClient
  readonly conversations: readonly ConnectedConversationV1[]
  readonly activeReceiverId: string | null
  readonly onClose: () => void
  /** 任一承接动作（切换/新开/断开）完成后通知上层刷新 Chip 数据。 */
  readonly onChanged: () => void
  /** 打开历史对话归档（现有 ConversationContextDialog 入口，由 App.tsx 接线）。 */
  readonly onOpenArchive: () => void
  /** RECEIVER-3 切换现场快照（App.tsx 从真实状态组装：当前视图 + 当前选中 + 待确认数）；缺省时切换降级为仅改承接关系。 */
  readonly handoffContext?: ReceiverHandoffContext | null
  /** RECEIVER-1 数据获取三态（loading/error）与重试；Switcher 据此显示真实状态而非空列表假象。 */
  readonly loading?: boolean
  readonly error?: boolean
  readonly onRetry?: () => void
  /** Canonical SessionLifecycle state for the active receiver. */
  readonly activePhase?: SessionPhase
  readonly onRecover?: () => void
}

/** 43C 切换承接（RECEIVER-3 升级）：零副作用——只改 receiver binding + 准备 Handoff 快照，绝不触发任何 send/run。
 *  顺序：先 setActiveReceiver（承接关系生效），成功后 prepareHandoff（冻结切换现场）；
 *  快照失败只降级「首条消息注入」，不回滚切换（承接关系与快照是两件事）。 */
export async function switchReceiverConversation(
  client: LocalCoreClient,
  projectId: string,
  connectedConversationId: string,
  handoff?: SwitchHandoffInput,
): Promise<RuntimeCall<ProjectReceiverBindingV1>> {
  const call = await client.setActiveReceiver(projectId, connectedConversationId)
  if (!call.result.ok || handoff === undefined) return call
  const handoffCall = await client.prepareReceiverHandoff(projectId, {
    fromConversationId: handoff.fromConversationId,
    toConversationId: connectedConversationId,
    surface: handoff.surface,
    selectionEntityIds: handoff.selectionEntityIds,
  })
  // 切换已生效；快照准备失败时把失败信息带回上层提示（内容真实性：不静默吞错）。
  return handoffCall.result.ok ? call : { ...call, result: { ok: false, error: handoffCall.result.error } }
}

/** RECEIVER-3 承接确认小卡（纯展示面）：切换前可见的现场摘要——从 X 切到 Y + 当前 surface + 选中 N 项 + 未完成事项。
 *  确认后才执行 setActiveReceiver + prepareHandoff；取消则什么都不动。
 *  RECEIVER-6（43I.2）：施工现场不一致时多一行「施工现场不同」提醒（只提醒，不自动 merge/checkout）。 */
export function ReceiverHandoffConfirmCard({ fromLabel, toLabel, surfaceKind, selectionCount, pendingReviewCount, siteMismatch, busy, onConfirm, onCancel }: {
  readonly fromLabel: string | null
  readonly toLabel: string
  readonly surfaceKind: 'main' | 'context' | 'workflow' | null
  readonly selectionCount: number
  readonly pendingReviewCount: number
  readonly siteMismatch: ReceiverSiteMismatch | null
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  return <div className="confirm-backdrop" data-testid="lcos-receiver-handoff-confirm-backdrop" role="presentation">
    <section className="lcos-receiver-handoff-confirm" role="dialog" aria-modal="true" aria-label="承接切换确认" data-testid="lcos-receiver-handoff-confirm">
      <header>
        <ArrowRightLeft size={15} aria-hidden="true" />
        <div><small>Receiver Handoff</small><h3>确认切换承接</h3></div>
        <button type="button" className="lcos-receiver-close" aria-label="取消切换" title="取消" onClick={onCancel}><X size={13} /></button>
      </header>
      <div className="lcos-receiver-handoff-route" data-testid="lcos-receiver-handoff-from">
        <span>{fromLabel === null ? '（首次承接，无前手）' : fromLabel}</span>
        <i aria-hidden="true">→</i>
        <strong data-testid="lcos-receiver-handoff-to">{toLabel}</strong>
      </div>
      <ul className="lcos-receiver-handoff-facts">
        {surfaceKind === null
          ? <li>切换时现场：不可用（降级为仅切换，不准备快照）</li>
          : <li>切换时现场：{handoffSurfaceKindLabel(surfaceKind)}</li>}
        <li>选中对象：{selectionCount} 项</li>
        {pendingReviewCount > 0 && <li className="is-pending">未完成事项：{pendingReviewCount} 项待确认的返回结果</li>}
        {siteMismatch !== null && <li className="is-site-mismatch" data-testid="lcos-receiver-site-mismatch">施工现场不同：当前 {siteMismatch.current} · 目标 {siteMismatch.target}（切换不会自动 checkout，只是承接关系变化）</li>}
      </ul>
      <p className="lcos-receiver-handoff-hint">切换只改承接关系并保存现场快照，不会自动发送任何消息；新承接对话收到你的下一条消息时才注入快照。</p>
      <footer>
        <button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>取消</button>
        <button type="button" className="primary-action" onClick={onConfirm} disabled={busy} data-testid="lcos-receiver-handoff-confirm-button">{busy ? '切换中…' : '确认切换'}</button>
      </footer>
    </section>
  </div>
}

/** RECEIVER-2 会话承接 Switcher：Chip 点击展开的轻量浮层（宽约 300px，非 SaaS 抽屉）。 */
export function ReceiverSwitcher(props: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null)
  /** RECEIVER-3：点选目标会话后先出承接确认小卡，用户确认才执行切换 + Handoff 准备。 */
  const [confirmSwitchId, setConfirmSwitchId] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<{ readonly left: number; readonly right: number; readonly top: number } | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!props.open) return
    // 锚定 Chip 下缘（NodeInfoPopover 的 fixed + 手算定位模式）；SSR/静态渲染下保持 CSS 默认位。
    const chip = document.querySelector('[data-testid="lcos-receiver-chip"]')
    const rect = chip?.getBoundingClientRect()
    if (rect) setAnchor({ left: rect.left, right: rect.right, top: rect.bottom + 6 })
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('[data-testid="lcos-receiver-chip"]')) return
      if (panelRef.current?.contains(target as Node)) return
      props.onClose()
    }
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    // capture 阶段挂 window：画布/组件层的 pointerdown stopPropagation 不再截断外点关闭链。
    window.addEventListener('pointerdown', closeFromOutside, true)
    window.addEventListener('keydown', closeFromEscape, true)
    return () => {
      window.removeEventListener('pointerdown', closeFromOutside, true)
      window.removeEventListener('keydown', closeFromEscape, true)
    }
  }, [props.onClose, props.open])

  if (!props.open) return null

  const active = props.conversations.find((conversation) => conversation.id === props.activeReceiverId) ?? null
  const others = props.conversations.filter((conversation) => conversation.id !== props.activeReceiverId)
  const confirmSwitchTarget = confirmSwitchId === null ? null : props.conversations.find((conversation) => conversation.id === confirmSwitchId) ?? null
  const handoffContext = props.handoffContext ?? null
  // 切换现场快照：from=当前 active receiver（null=首次承接）；surface/selection 来自 App 的真实状态。
  const handoffSnapshot: SwitchHandoffInput | null = handoffContext === null ? null : {
    fromConversationId: props.activeReceiverId,
    surface: handoffContext.surface,
    selectionEntityIds: handoffContext.selectionEntityIds,
  }

  /** 确认切换：setActiveReceiver → prepareHandoff 两连击；除这两个 mutation 外零副作用。 */
  const handleConfirmSwitch = async (): Promise<void> => {
    const target = confirmSwitchTarget
    if (target === null) return
    setBusy(true); setError(null)
    const call = await switchReceiverConversation(props.client, props.projectId, target.id, handoffSnapshot ?? undefined)
    setBusy(false)
    if (!call.result.ok) { setError(call.result.error.message); return }
    setConfirmSwitchId(null)
    props.onChanged(); props.onClose()
  }

  const handleCreate = async (): Promise<void> => {
    setBusy(true); setError(null)
    const call = await props.client.createConnectedConversation(props.projectId, { executorId: 'codex-gui', provider: 'codex' })
    if (!call.result.ok) { setError(call.result.error.message); setBusy(false); return }
    // 单 executor 不多问：新开对话后立即设为承接（新开=首次承接，无前手快照）。
    const bindCall = await props.client.setActiveReceiver(props.projectId, call.result.value.id)
    setBusy(false)
    if (!bindCall.result.ok) { setError(bindCall.result.error.message); return }
    props.onChanged(); props.onClose()
  }

  const handleDisconnect = async (): Promise<void> => {
    const id = confirmDisconnectId
    if (id === null) return
    setBusy(true); setError(null)
    const call = await props.client.disconnectConversation(props.projectId, id)
    setBusy(false)
    setConfirmDisconnectId(null)
    if (!call.result.ok) { setError(call.result.error.message); return }
    // 断开 active 的 binding 联动清空由后端完成；刷新即可看到新状态。
    props.onChanged()
  }

  const width = 300
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
  const anchorLeft = anchor === null ? null : anchor.left + width > viewportWidth - 12 ? Math.max(12, anchor.right - width) : anchor.left
  const panelStyle = anchor === null ? undefined : { left: `${anchorLeft}px`, top: `${anchor.top}px` }

  return <>
    <aside ref={panelRef} className="lcos-receiver-switcher" style={panelStyle} data-testid="lcos-receiver-switcher" role="dialog" aria-label="会话承接">
      <header>
        <div><small>会话承接</small><h3>谁继续这个项目</h3></div>
        <button type="button" className="lcos-receiver-close" aria-label="关闭会话承接" title="关闭" onClick={props.onClose}><X size={13} /></button>
      </header>

      {error !== null && <p className="lcos-receiver-error" role="alert">{error}</p>}
      {props.error === true && <div className="lcos-receiver-error" role="alert">承接状态获取失败。
        {props.onRetry === undefined ? null : <button type="button" className="lcos-receiver-retry" onClick={props.onRetry} disabled={props.loading}>重试</button>}
      </div>}
      {props.loading === true && <p className="lcos-receiver-hint">正在加载承接状态…</p>}

      <section className="lcos-receiver-section">
        <h4>当前承接</h4>
        {active !== null
          ? <div className={`lcos-receiver-row${props.activePhase === 'stale' ? ' is-stale' : props.activePhase === 'disconnected' ? ' is-disconnected' : ' is-active'}`} aria-current="true" data-conversation-id={active.id}>
            <span className={`lcos-receiver-dot status-${props.activePhase === 'disconnected' ? 'offline' : props.activePhase === 'waiting_input' ? 'waiting' : props.activePhase === 'busy' || props.activePhase === 'connecting' ? 'working' : projectConnectedConversationStatusV1(active)}`} aria-hidden="true" />
            <span className="lcos-receiver-row-main">
              <strong>{active.label}</strong>
              {props.activePhase === 'disconnected'
                ? <small className="lcos-receiver-stale-note">已断开 · 项目现场不受影响</small>
                : props.activePhase === 'stale'
                  ? <small className="lcos-receiver-stale-note">信息可能过期 · 会话仍保持连接</small>
                  : <time dateTime={active.lastActiveAt}>{relativeTime(Date.parse(active.lastActiveAt), Date.now())}</time>}
            </span>
            <span className="lcos-receiver-provider">{receiverProviderLabel(active.provider)}</span>
            {props.activePhase === 'disconnected' && props.onRecover !== undefined
              ? <button type="button" className="lcos-receiver-reconnect" data-testid="lcos-receiver-reconnect" disabled={busy} title="通过 SessionLifecycle 恢复连接" onClick={() => props.onRecover?.()}>重新连接</button>
              : <button type="button" className="lcos-receiver-unlink" aria-label={`断开当前承接 ${active.label}`} title="断开（需确认）" disabled={busy} onClick={() => setConfirmDisconnectId(active.id)}><Unplug size={12} /></button>}
          </div>
          : <p className="lcos-receiver-hint">还没有指定承接对话；点选下面的对话，或新开一个接着做。</p>}
      </section>

      <section className="lcos-receiver-section">
        <h4>已连接对话</h4>
        {props.conversations.length === 0
          ? <div className="lcos-receiver-empty"><p>还没有可承接的对话</p><small>新开一个对话接着做，或在历史对话里找回上下文。</small></div>
          : others.length === 0
            ? <p className="lcos-receiver-hint">当前只有承接中的对话。</p>
            : <ul className="lcos-receiver-list">
              {others.map((conversation) => (
                <li key={conversation.id}>
                  <div className="lcos-receiver-row" data-conversation-id={conversation.id}>
                    <button type="button" className="lcos-receiver-select" disabled={busy} onClick={() => { setConfirmSwitchId(conversation.id) }} title={`切换由 ${conversation.label} 承接（先确认，只改承接关系并保存现场快照，不触发任何执行）`}>
                      <span className={`lcos-receiver-dot status-${projectConnectedConversationStatusV1(conversation)}`} aria-hidden="true" />
                      <span className="lcos-receiver-row-main">
                        <strong>{conversation.label}</strong>
                        <time dateTime={conversation.lastActiveAt}>{relativeTime(Date.parse(conversation.lastActiveAt), Date.now())}</time>
                      </span>
                      <span className="lcos-receiver-provider">{receiverProviderLabel(conversation.provider)}</span>
                    </button>
                    <button type="button" className="lcos-receiver-unlink" aria-label={`断开 ${conversation.label}`} title="断开（需确认）" disabled={busy} onClick={() => setConfirmDisconnectId(conversation.id)}><Unplug size={12} /></button>
                  </div>
                </li>
              ))}
            </ul>}
      </section>

      <button type="button" className="lcos-receiver-create" disabled={busy} onClick={() => { void handleCreate() }}>＋ 新开对话接着做</button>
      <div className="lcos-receiver-divider" aria-hidden="true" />
      <button type="button" className="lcos-receiver-archive" onClick={() => { props.onClose(); props.onOpenArchive() }}>查看历史对话</button>
    </aside>
    {confirmSwitchTarget !== null && <ReceiverHandoffConfirmCard
      fromLabel={active === null ? null : active.label}
      toLabel={confirmSwitchTarget.label}
      surfaceKind={handoffContext === null ? null : handoffContext.surface.kind}
      selectionCount={handoffContext === null ? 0 : handoffContext.selectionEntityIds.length}
      pendingReviewCount={handoffContext === null ? 0 : handoffContext.pendingReviewCount}
      siteMismatch={receiverSiteMismatch(active, confirmSwitchTarget)}
      busy={busy}
      onConfirm={() => { void handleConfirmSwitch() }}
      onCancel={() => { setConfirmSwitchId(null) }}
    />}
    {confirmDisconnectId !== null && (() => {
      const target = props.conversations.find((conversation) => conversation.id === confirmDisconnectId)
      return <ConfirmDialog
        title="断开这个对话的承接？"
        description={`「${target?.label ?? '该对话'}」将不再作为本项目的承接对话。对话记录本身保留在历史归档中。`}
        confirmLabel="确认断开"
        onCancel={() => setConfirmDisconnectId(null)}
        onConfirm={() => { void handleDisconnect() }}
      />
    })()}
  </>
}

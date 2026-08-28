import { useCallback, useEffect, useState } from 'react'
import type { ActiveReceiverIdentityV1, ConnectedConversationV1, SessionPhase } from '@local-creative-os/contracts'
import { projectConnectedConversationStatusV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { ReceiverSwitcher, receiverProviderLabel } from './ReceiverSwitcher'
import type { ReceiverHandoffContext } from './receiverHandoff'

interface Props {
  readonly projectId: string
  readonly client: LocalCoreClient
  /** 打开历史对话归档（现有 ConversationContextDialog 入口，由 App.tsx 接线）。 */
  readonly onOpenArchive: () => void
  /** RECEIVER-3 切换现场快照（当前视图 + 当前选中 + 待确认数），透传给 Switcher 的承接确认小卡。 */
  readonly handoffContext?: ReceiverHandoffContext | null
  /** Mirrors the refreshed canonical identity to the scene owner (App). */
  readonly onIdentityChanged?: (identity: ActiveReceiverIdentityV1 | null) => void
}

/** Chip 纯展示面（43B.1）：极简一行「● Codex · GUI 收口」——状态圆点 + provider 名 + label；
 *  只显示四态（working/waiting/ready/offline），不显示 token/queue/session UUID/port/model。
 *  0.5 波 GUI 收口：补 loading/error 两态——列表拉取失败或加载中不再静默冒充「未连接对话」。
 *  RECEIVER-5：stale（会话失效）→ 按 offline 呈现（43O「已断开」），label 追加断开说明。 */
export function ReceiverChipFace({ active, expanded, onToggle, loading = false, error = false, phase }: {
  readonly active: ConnectedConversationV1 | null
  readonly expanded: boolean
  readonly onToggle: () => void
  readonly loading?: boolean
  readonly error?: boolean
  readonly phase?: SessionPhase
}) {
  const lifecycleStatus = phase === 'disconnected' ? 'offline' : phase === 'waiting_input' ? 'waiting' : phase === 'busy' || phase === 'connecting' ? 'working' : active === null ? 'offline' : projectConnectedConversationStatusV1(active)
  const status = loading ? 'loading' : error ? 'error' : lifecycleStatus
  const phaseSuffix = phase === 'disconnected' ? ' · 已断开' : phase === 'stale' ? ' · 信息可能过期' : phase === 'waiting_input' ? ' · 等待输入' : phase === 'busy' ? ' · 工作中' : ''
  const label = loading ? '连接中…' : error ? '承接状态获取失败' : active === null ? '未连接对话' : `${receiverProviderLabel(active.provider)} · ${active.label}${phaseSuffix}`
  const title = loading ? '正在获取承接状态' : error ? '承接状态获取失败：点击打开会话承接并重试' : active === null ? '未连接对话：点击选择谁来继续这个项目' : `当前承接：${active.label}（${receiverProviderLabel(active.provider)}）${phaseSuffix}`
  return <button
    type="button"
    className={`lcos-receiver-chip${active === null ? ' is-idle' : ''}`}
    data-testid="lcos-receiver-chip"
    data-session-phase={phase}
    aria-haspopup="dialog"
    aria-expanded={expanded}
    title={title}
    onClick={onToggle}
  >
    <span className={`lcos-receiver-chip-dot status-${status}`} aria-hidden="true" />
    <span className="lcos-receiver-chip-label">{label}</span>
  </button>
}

/** RECEIVER-1 项目级会话承接 Chip：常驻 Project Strip 顶条。
 *  数据模式照 ProjectToolsDialog：挂载（含项目切换）拉一次 + 动作后主动刷新，0.1 不做轮询。 */
export function ReceiverChip({ projectId, client, onOpenArchive, handoffContext, onIdentityChanged }: Props) {
  const [conversations, setConversations] = useState<readonly ConnectedConversationV1[]>([])
  const [identity, setIdentity] = useState<ActiveReceiverIdentityV1 | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true); setError(false)
    const [listCall, identityCall] = await Promise.all([
      client.listConnectedConversations(projectId),
      client.activeReceiverIdentity(projectId),
    ])
    if (listCall.result.ok) setConversations(listCall.result.value)
    if (identityCall.result.ok) {
      setIdentity(identityCall.result.value)
      onIdentityChanged?.(identityCall.result.value)
    }
    setError(!listCall.result.ok || !identityCall.result.ok)
    setLoading(false)
  }, [client, onIdentityChanged, projectId])

  useEffect(() => { void refresh() }, [refresh])

  const active = identity?.chain?.connectedConversation ?? (identity?.activeReceiverId == null ? null : conversations.find((conversation) => conversation.id === identity.activeReceiverId) ?? null)
  const phase = identity?.chain?.lifecycle?.phase

  // 关闭回调稳定化：Switcher 的外点/Esc 监听依赖它，避免每次渲染重挂监听。
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), [])

  return <>
    <ReceiverChipFace active={active} expanded={switcherOpen} onToggle={() => setSwitcherOpen((open) => !open)} loading={loading} error={error} phase={phase} />
    <ReceiverSwitcher
      open={switcherOpen}
      projectId={projectId}
      client={client}
      conversations={conversations}
      activeReceiverId={identity?.activeReceiverId ?? null}
      onClose={closeSwitcher}
      onChanged={() => { void refresh() }}
      onOpenArchive={onOpenArchive}
      handoffContext={handoffContext ?? null}
      loading={loading}
      error={error}
      onRetry={() => { void refresh() }}
      activePhase={phase}
      onRecover={active && phase === 'disconnected' ? () => { void client.recoverSessionLifecycle(projectId, active.provider).then(() => refresh()) } : undefined}
    />
  </>
}

import { useCallback, useEffect, useState } from 'react'
import type { ConnectedConversationV1, ProjectReceiverBindingV1 } from '@local-creative-os/contracts'
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
  /** RECEIVER-5（43O）：active receiver 的会话被判定失效（Run 的 providerError 命中 session 失效特征）。
   *  stale 只影响展示与恢复入口，Project/Surface/Selection 一概不动。 */
  readonly stale?: boolean
  /** RECEIVER-5「重新连接」动作：清除 stale 标记（lease 层在下次 Run 自动恢复替代会话，只建一次）。 */
  readonly onStaleCleared?: () => void
}

/** Chip 纯展示面（43B.1）：极简一行「● Codex · GUI 收口」——状态圆点 + provider 名 + label；
 *  只显示四态（working/waiting/ready/offline），不显示 token/queue/session UUID/port/model。
 *  0.5 波 GUI 收口：补 loading/error 两态——列表拉取失败或加载中不再静默冒充「未连接对话」。
 *  RECEIVER-5：stale（会话失效）→ 按 offline 呈现（43O「已断开」），label 追加断开说明。 */
export function ReceiverChipFace({ active, expanded, onToggle, loading = false, error = false, stale = false }: {
  readonly active: ConnectedConversationV1 | null
  readonly expanded: boolean
  readonly onToggle: () => void
  readonly loading?: boolean
  readonly error?: boolean
  readonly stale?: boolean
}) {
  const status = loading ? 'loading' : error ? 'error' : active === null ? 'offline' : stale ? 'offline' : projectConnectedConversationStatusV1(active)
  const label = loading ? '连接中…' : error ? '承接状态获取失败' : active === null ? '未连接对话' : stale ? `${receiverProviderLabel(active.provider)} · ${active.label} · 已断开` : `${receiverProviderLabel(active.provider)} · ${active.label}`
  const title = loading ? '正在获取承接状态' : error ? '承接状态获取失败：点击打开会话承接并重试' : active === null ? '未连接对话：点击选择谁来继续这个项目' : stale ? '当前承接的会话已断开：点击打开会话承接，重新连接或新开对话接着做（项目现场不受影响）' : `当前承接：${active.label}（${receiverProviderLabel(active.provider)}）`
  return <button
    type="button"
    className={`lcos-receiver-chip${active === null ? ' is-idle' : ''}`}
    data-testid="lcos-receiver-chip"
    data-stale={stale && active !== null ? 'true' : undefined}
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
export function ReceiverChip({ projectId, client, onOpenArchive, handoffContext, stale = false, onStaleCleared }: Props) {
  const [conversations, setConversations] = useState<readonly ConnectedConversationV1[]>([])
  const [binding, setBinding] = useState<ProjectReceiverBindingV1 | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true); setError(false)
    const [listCall, bindingCall] = await Promise.all([
      client.listConnectedConversations(projectId),
      client.getProjectReceiverBinding(projectId),
    ])
    if (listCall.result.ok) setConversations(listCall.result.value)
    if (bindingCall.result.ok) setBinding(bindingCall.result.value)
    // 内容真实性（0.5 波 GUI 收口）：任一拉取失败都如实进入 error 态，不静默降级成「未连接对话」。
    setError(!listCall.result.ok || !bindingCall.result.ok)
    setLoading(false)
  }, [client, projectId])

  useEffect(() => { void refresh() }, [refresh])

  const active = binding?.activeReceiverId == null
    ? null
    : conversations.find((conversation) => conversation.id === binding.activeReceiverId) ?? null

  return <>
    <ReceiverChipFace active={active} expanded={switcherOpen} onToggle={() => setSwitcherOpen(true)} loading={loading} error={error} stale={stale} />
    <ReceiverSwitcher
      open={switcherOpen}
      projectId={projectId}
      client={client}
      conversations={conversations}
      activeReceiverId={binding?.activeReceiverId ?? null}
      onClose={() => setSwitcherOpen(false)}
      // 承接关系变化（切换/新建/断开）意味着 stale 标记描述的旧会话已不是 active receiver，一并清除。
      onChanged={() => { void refresh(); onStaleCleared?.() }}
      onOpenArchive={onOpenArchive}
      handoffContext={handoffContext ?? null}
      loading={loading}
      error={error}
      onRetry={() => { void refresh() }}
      activeStale={stale && active !== null}
      onReconnect={() => onStaleCleared?.()}
    />
  </>
}

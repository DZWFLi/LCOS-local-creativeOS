import { ArrowLeft, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ConnectedConversationV1, ConversationMessageV1, ConversationProjectionV1, ConversationRole, RuntimeProviderStatus } from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { LcosButton } from '../ui/LcosButton'
import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'
import { explicitExecutionReferenceIds, proposalCompatibilityBlockReason, referenceCandidates } from '../execution/commandDraft'
import type { SharedComposerCommandState, SurfaceExecutionSubmission, SurfaceExecutionSubmissionResult } from '../execution/surfaceExecution'

interface Props {
  projectId: string
  conversationId?: string | null
  onExit?: () => void
  execution?: {
    readonly command: SharedComposerCommandState
    readonly receivers: readonly ConnectedConversationV1[]
    readonly activeReceiverId: string | null
    readonly providers: readonly RuntimeProviderStatus[]
    readonly busy: boolean
    readonly onSubmit: (input: SurfaceExecutionSubmission) => Promise<SurfaceExecutionSubmissionResult | void> | SurfaceExecutionSubmissionResult | void
    readonly onReadReach?: (connectedConversationId: string) => Promise<number>
  }
}

const ROLE_LABEL: Record<ConversationRole, string> = {
  user: '你', assistant: 'AI', tool: '工具', system: '系统', event: '事件',
}

function unwrap<T>(call: { readonly result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } } }): T {
  if (!call.result.ok) throw new Error(call.result.error.message)
  return call.result.value
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('zh-CN')
}

/**
 * Project-local Conversation Subcanvas.
 *
 * The timeline is a projection of the canonical ConversationSession; its messages are NOT
 * promoted into fake Project references. Work uses the same UnifiedExecutionComposer as
 * Main/Context/Workflow and defaults to this Conversation's linked Receiver Glyth.
 */
export function ConversationSpaceSurface({ projectId, conversationId, onExit, execution }: Props) {
  const client = useLocalCoreClientOrNull()
  const [camera, setCamera] = useSpatialSessionCamera(projectId, conversationId ?? 'missing-conversation', 'conversation-space', { x: 72, y: 58, zoom: 1 })
  const [projection, setProjection] = useState<ConversationProjectionV1 | null>(null)
  const [messages, setMessages] = useState<readonly ConversationMessageV1[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [reachCount, setReachCount] = useState(0)

  useEffect(() => {
    if (!conversationId || !client) {
      setLoading(false); setProjection(null); setMessages([])
      setError(!conversationId ? '没有可进入的对话。' : '本地核心未连接。')
      return
    }
    const controller = new AbortController()
    setLoading(true); setError('')
    void Promise.all([
      client.conversationProjection(projectId, conversationId, controller.signal),
      client.conversationMessages(projectId, conversationId, { limit: 500 }, controller.signal),
    ]).then(([projectionCall, messagesCall]) => {
      if (controller.signal.aborted) return
      setProjection(unwrap<ConversationProjectionV1>(projectionCall))
      setMessages(unwrap<readonly ConversationMessageV1[]>(messagesCall))
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '读取对话失败')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [client, conversationId, projectId])

  const currentReceiver = useMemo(
    () => execution?.receivers.find((item) => item.conversationSessionId === conversationId) ?? null,
    [conversationId, execution?.receivers],
  )

  useEffect(() => {
    // Conversation Subcanvas defaults to its own Glyth. Do not silently fall back to the
    // Project Active Receiver when this Conversation has not been explicitly linked.
    execution?.command.onReceiverChange(currentReceiver?.id ?? null)
    execution?.command.onFinishReferencePick()
    setReachCount(0)
    setComposerOpen(false)
  }, [conversationId, currentReceiver?.id])

  const receiverId = execution?.command.receiverId ?? null

  useEffect(() => {
    if (!composerOpen || !execution?.onReadReach || !receiverId) { setReachCount(0); return }
    let cancelled = false
    void execution.onReadReach(receiverId).then((count) => { if (!cancelled) setReachCount(count) }).catch(() => { if (!cancelled) setReachCount(0) })
    return () => { cancelled = true }
  }, [composerOpen, execution, receiverId])

  const groups = useMemo(() => {
    if (!projection) return []
    const assigned = new Set<string>()
    const result = projection.sections.map((section, sectionIndex) => {
      const items = messages.filter((message) => message.seq >= section.startSeq && message.seq <= section.endSeq)
      items.forEach((item) => assigned.add(item.id))
      const firstUser = items.find((item) => item.role === 'user')
      const titleDuplicatesFirstUser = firstUser !== undefined && normalizedText(firstUser.contentText) === normalizedText(section.title)
      return { id: section.id, title: section.title, showTitle: !titleDuplicatesFirstUser, items, sectionIndex }
    })
    const unassigned = messages.filter((message) => !assigned.has(message.id))
    if (unassigned.length) result.push({ id: '__unarchived', title: '未归档', showTitle: true, items: unassigned, sectionIndex: result.length })
    return result
  }, [messages, projection])

  const title = projection?.session.title ?? '对话现场'
  let runningY = 118
  const laidOut = groups.map((group) => {
    const sectionY = runningY
    const messagesWithY = group.items.map((message) => {
      const length = message.contentText.trim().length
      const height = Math.max(62, Math.min(360, 54 + Math.ceil(length / 48) * 22))
      const item = { message, y: runningY, height }
      runningY += height + 26
      return item
    })
    runningY += 54
    return { ...group, sectionY, messages: messagesWithY }
  })

  const executionReferenceIds = execution
    ? explicitExecutionReferenceIds(execution.command.referenceIds)
    : []
  const executionReferences = execution
    ? referenceCandidates(executionReferenceIds, execution.command.nodes, receiverId, execution.receivers)
    : []
  const executionBlockedReason = execution && composerOpen
    ? proposalCompatibilityBlockReason({ receiverId, activeReceiverId: execution.activeReceiverId, receivers: execution.receivers, references: executionReferences })
    : undefined

  const submit = () => {
    if (!execution || !receiverId || executionBlockedReason || !execution.command.prompt.trim()) return
    void Promise.resolve(execution.onSubmit({
      prompt: execution.command.prompt.trim(),
      surface: 'conversation',
      selectionIds: execution.command.selectionIds,
      receiverId,
      referenceIds: execution.command.referenceIds,
      provider: execution.command.provider,
      intent: execution.command.intent,
      resultPolicy: execution.command.resultPolicy,
    })).then((result) => {
      if (result?.runId) execution.command.onPromptChange('')
    })
  }

  return <div className="lcos-conversation-space" data-conversation-id={conversationId ?? undefined}>
    <div className="lcos-conversation-space-hud">
      <LcosButton variant="ghost" size="sm" className="lcos-conversation-space-back" onClick={onExit} aria-label="返回主画布"><ArrowLeft size={15} aria-hidden="true" />返回</LcosButton>
      <div className="lcos-conversation-space-identity"><strong>{title}</strong><span>{projection ? `${projection.session.messageCount} 条消息 · ${projection.sections.length} 个章节` : 'Conversation Subcanvas'}</span></div>
      <LcosButton variant="ghost" size="sm" className="lcos-conversation-space-work" disabled={!execution} aria-expanded={composerOpen} onClick={() => setComposerOpen((value) => !value)} title={currentReceiver ? '用这段 Conversation 的 Glyth 工作' : '这段 Conversation 尚未显式 link-session；打开后只会显示真实不可用状态'}><Sparkles size={14} aria-hidden="true" />Work</LcosButton>
    </div>
    <SpatialCanvas surfaceRef={conversationId ? `conversation:${conversationId}` : undefined} camera={camera} setCamera={setCamera} className="lcos-conversation-spatial-canvas" worldClassName="lcos-conversation-world" nodeCount={messages.length} edgeCount={0}>
      {loading && <div className="lcos-conversation-space-status"><LoaderCircle size={18} aria-hidden="true" />正在读取真实时间线…</div>}
      {!loading && error && <div className="lcos-conversation-space-status is-error">{error}</div>}
      {!loading && !error && laidOut.map((group) => <section key={group.id} className="lcos-conversation-space-section" style={{ top: group.sectionY }} data-conversation-section={group.id}><span className="lcos-conversation-space-section-mark" aria-hidden="true" />{group.showTitle && <h3>{group.title}</h3>}</section>)}
      {!loading && !error && laidOut.flatMap((group) => group.messages.map(({ message, y, height }) => <article key={message.id} className="lcos-conversation-space-message" data-role={message.role} data-message-id={message.id} style={{ top: y, minHeight: height }}><span className="lcos-conversation-space-role">{ROLE_LABEL[message.role] ?? message.role}</span><p>{message.contentText}</p></article>))}
    </SpatialCanvas>
    {composerOpen && execution && <UnifiedExecutionComposer
      nodes={execution.command.nodes}
      selectedIds={execution.command.selectionIds}
      referenceIds={execution.command.referenceIds}
      receivers={execution.receivers}
      activeReceiverId={execution.activeReceiverId}
      receiverId={receiverId}
      reachCount={reachCount}
      x={148}
      y={54}
      prompt={execution.command.prompt}
      provider={execution.command.provider}
      createAsNewNode={execution.command.intent === 'create'}
      intent={execution.command.intent}
      resultPolicy={execution.command.resultPolicy}
      providers={execution.providers}
      busy={execution.busy}
      referencePickAvailable={false}
      referencePickUnavailableReason="对话时间线里的消息不是项目对象；不能把聊天气泡伪造成参考。画布、搜索和装配区加入的项目参考会继续保留在同一个参考栏里。"
      {...(executionBlockedReason ? { executionBlockedReason } : {})}
      onPromptChange={execution.command.onPromptChange}
      onProviderChange={execution.command.onProviderChange}
      onCreateAsNewNodeChange={() => undefined}
      onIntentChange={execution.command.onIntentChange}
      onResultPolicyChange={execution.command.onResultPolicyChange}
      onReceiverChange={(value) => execution.command.onReceiverChange(value)}
      onRemoveReference={execution.command.onToggleReference}
      onMoveReference={execution.command.onMoveReference}
      onStartReferencePick={() => undefined}
      onFinishReferencePick={execution.command.onFinishReferencePick}
      onSend={submit}
      onClose={() => setComposerOpen(false)}
    />}
  </div>
}

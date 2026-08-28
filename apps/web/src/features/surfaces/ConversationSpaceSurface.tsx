import { ArrowLeft, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ConnectedConversationV1, ConversationMessageV1, ConversationProjectionV1, ConversationRole, RuntimeProviderStatus } from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { LcosButton } from '../ui/LcosButton'
import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'
import { register as registerOverlay } from '../ui/overlayStack'
import { proposalCompatibilityBlockReason } from '../execution/commandDraft'
import type { SurfaceExecutionSubmission, SurfaceExecutionSubmissionResult } from '../execution/surfaceExecution'

interface Props {
  projectId: string
  conversationId?: string | null
  onExit?: () => void
  execution?: {
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
  const [prompt, setPrompt] = useState('')
  const [receiverId, setReceiverId] = useState<string | null>(null)
  const [provider, setProvider] = useState('auto')
  const [intent, setIntent] = useState<'analyze' | 'create' | 'revise'>('analyze')
  const [resultPolicy, setResultPolicy] = useState<'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'>('reply_only')
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
    setReceiverId(currentReceiver?.id ?? null)
    setPrompt('')
    setProvider('auto')
    setIntent('analyze')
    setResultPolicy('reply_only')
    setReachCount(0)
    setComposerOpen(false)
  }, [conversationId, currentReceiver?.id])

  useEffect(() => {
    if (!composerOpen) return undefined
    return registerOverlay(`conversation-work:${conversationId ?? 'missing'}`, {
      kind: 'popover',
      onEsc: () => setComposerOpen(false),
      dismissOnOutside: false,
    })
  }, [composerOpen, conversationId])

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

  const executionBlockedReason = execution && composerOpen
    ? proposalCompatibilityBlockReason({ receiverId, activeReceiverId: execution.activeReceiverId, receivers: execution.receivers, references: [] })
    : undefined

  const submit = () => {
    if (!execution || !receiverId || executionBlockedReason || !prompt.trim()) return
    void Promise.resolve(execution.onSubmit({
      prompt: prompt.trim(),
      surface: 'conversation',
      receiverId,
      referenceIds: [],
      provider,
      intent,
      resultPolicy,
    })).then((result) => {
      if (result?.runId) setPrompt('')
    })
  }

  return <div className="lcos-conversation-space" data-conversation-id={conversationId ?? undefined}>
    <div className="lcos-conversation-space-hud">
      <LcosButton variant="ghost" size="sm" className="lcos-conversation-space-back" onClick={onExit} aria-label="返回主画布"><ArrowLeft size={15} aria-hidden="true" />返回</LcosButton>
      <div className="lcos-conversation-space-identity"><strong>{title}</strong><span>{projection ? `${projection.session.messageCount} 条消息 · ${projection.sections.length} 个章节` : 'Conversation Subcanvas'}</span></div>
      <LcosButton variant="ghost" size="sm" className="lcos-conversation-space-work" disabled={!execution} aria-expanded={composerOpen} onClick={() => setComposerOpen((value) => !value)} title={currentReceiver ? '用这段 Conversation 的 Glyth 工作' : '这段 Conversation 尚未显式 link-session；打开后只会显示真实不可用状态'}><Sparkles size={14} aria-hidden="true" />Work</LcosButton>
    </div>
    <SpatialCanvas camera={camera} setCamera={setCamera} className="lcos-conversation-spatial-canvas" worldClassName="lcos-conversation-world" nodeCount={messages.length} edgeCount={0}>
      {loading && <div className="lcos-conversation-space-status"><LoaderCircle size={18} aria-hidden="true" />正在读取真实时间线…</div>}
      {!loading && error && <div className="lcos-conversation-space-status is-error">{error}</div>}
      {!loading && !error && laidOut.map((group) => <section key={group.id} className="lcos-conversation-space-section" style={{ top: group.sectionY }} data-conversation-section={group.id}><span className="lcos-conversation-space-section-mark" aria-hidden="true" />{group.showTitle && <h3>{group.title}</h3>}</section>)}
      {!loading && !error && laidOut.flatMap((group) => group.messages.map(({ message, y, height }) => <article key={message.id} className="lcos-conversation-space-message" data-role={message.role} data-message-id={message.id} style={{ top: y, minHeight: height }}><span className="lcos-conversation-space-role">{ROLE_LABEL[message.role] ?? message.role}</span><p>{message.contentText}</p></article>))}
    </SpatialCanvas>
    {composerOpen && execution && <UnifiedExecutionComposer
      nodes={[]}
      selectedIds={[]}
      referenceIds={[]}
      receivers={execution.receivers}
      activeReceiverId={execution.activeReceiverId}
      receiverId={receiverId}
      reachCount={reachCount}
      x={148}
      y={54}
      prompt={prompt}
      provider={provider}
      createAsNewNode={intent === 'create'}
      intent={intent}
      resultPolicy={resultPolicy}
      providers={execution.providers}
      busy={execution.busy}
      referencePickAvailable={false}
      referencePickUnavailableReason="Conversation 时间线里的 Message 不是 Project Entity；不能把聊天气泡伪造成 Run Reference。Project Search / Assembly 引用会继续接入同一 Reference Tray。"
      {...(executionBlockedReason ? { executionBlockedReason } : {})}
      onPromptChange={setPrompt}
      onProviderChange={setProvider}
      onCreateAsNewNodeChange={(value) => { setIntent(value ? 'create' : 'analyze'); setResultPolicy(value ? 'create_artifact' : 'reply_only') }}
      onIntentChange={(next) => { setIntent(next); setResultPolicy(next === 'create' ? 'create_artifact' : next === 'revise' ? 'draft_revision_per_target' : 'reply_only') }}
      onResultPolicyChange={setResultPolicy}
      onReceiverChange={setReceiverId}
      onRemoveReference={() => undefined}
      onMoveReference={() => undefined}
      onStartReferencePick={() => undefined}
      onFinishReferencePick={() => undefined}
      onSend={submit}
      onClose={() => setComposerOpen(false)}
    />}
  </div>
}

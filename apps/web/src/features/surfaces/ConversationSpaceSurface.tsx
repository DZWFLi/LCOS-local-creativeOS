import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ConversationMessageV1, ConversationProjectionV1, ConversationRole } from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { LcosButton } from '../ui/LcosButton'

interface Props {
  projectId: string
  conversationId?: string | null
  onExit?: () => void
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

/** Conversation is a first-class project subcanvas, never a markdown-reader disguise. */
export function ConversationSpaceSurface({ projectId, conversationId, onExit }: Props) {
  const client = useLocalCoreClientOrNull()
  const [camera, setCamera] = useSpatialSessionCamera(projectId, conversationId ?? 'missing-conversation', 'conversation-space', { x: 72, y: 58, zoom: 1 })
  const [projection, setProjection] = useState<ConversationProjectionV1 | null>(null)
  const [messages, setMessages] = useState<readonly ConversationMessageV1[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  return <div className="lcos-conversation-space" data-conversation-id={conversationId ?? undefined}>
    <div className="lcos-conversation-space-hud">
      <LcosButton variant="ghost" size="sm" className="lcos-conversation-space-back" onClick={onExit} aria-label="返回主画布"><ArrowLeft size={15} aria-hidden="true" />返回</LcosButton>
      <div className="lcos-conversation-space-identity"><strong>{title}</strong><span>{projection ? `${projection.session.messageCount} 条消息 · ${projection.sections.length} 个章节` : 'Conversation Subcanvas'}</span></div>
    </div>
    <SpatialCanvas camera={camera} setCamera={setCamera} className="lcos-conversation-spatial-canvas" worldClassName="lcos-conversation-world" nodeCount={messages.length} edgeCount={0}>
      {loading && <div className="lcos-conversation-space-status"><LoaderCircle size={18} aria-hidden="true" />正在读取真实时间线…</div>}
      {!loading && error && <div className="lcos-conversation-space-status is-error">{error}</div>}
      {!loading && !error && laidOut.map((group) => <section key={group.id} className="lcos-conversation-space-section" style={{ top: group.sectionY }} data-conversation-section={group.id}><span className="lcos-conversation-space-section-mark" aria-hidden="true" />{group.showTitle && <h3>{group.title}</h3>}</section>)}
      {!loading && !error && laidOut.flatMap((group) => group.messages.map(({ message, y, height }) => <article key={message.id} className="lcos-conversation-space-message" data-role={message.role} data-message-id={message.id} style={{ top: y, minHeight: height }}><span className="lcos-conversation-space-role">{ROLE_LABEL[message.role] ?? message.role}</span><p>{message.contentText}</p></article>))}
    </SpatialCanvas>
  </div>
}

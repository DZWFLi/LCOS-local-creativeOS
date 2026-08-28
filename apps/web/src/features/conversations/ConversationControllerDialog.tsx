import { Radio, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ConnectedConversationV1 } from '@local-creative-os/contracts'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'
import { register } from '../ui/overlayStack'
import { receiverProviderLabel } from '../shell/ReceiverSwitcher'

export function ConversationControllerDialog({ sessionTitle, conversations, busy, error, onChoose, onClose }: {
  readonly sessionTitle: string
  readonly conversations: readonly ConnectedConversationV1[]
  readonly busy: boolean
  readonly error?: string | null
  readonly onChoose: (conversationId: string) => void
  readonly onClose: () => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unregister = register('conversation-controller-link', { kind: 'dialog', element: () => panelRef.current, onEsc: () => { if (!busy) onClose() }, dismissOnOutside: false })
    const timer = window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button[data-controller-choice]')?.focus())
    return () => { window.cancelAnimationFrame(timer); unregister(); returnFocus.current?.focus() }
  }, [busy, onClose])

  return <div className="confirm-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onClose, busy)}>
    <section ref={panelRef} className="confirm-dialog lcos-conversation-controller-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-controller-title">
      <header><Radio size={18} /><div><span>Controller Link</span><h2 id="conversation-controller-title">让谁承接「{sessionTitle}」？</h2></div><button aria-label="关闭" title="关闭" disabled={busy} onClick={onClose}><X size={15} /></button></header>
      <p>这一步只建立显式 ConversationSession ↔ ConnectedConversation 链接并设为当前，不会发送消息或启动 Run。</p>
      <div className="lcos-conversation-controller-choices">
        {conversations.length ? conversations.map((conversation) => <button key={conversation.id} data-controller-choice type="button" className="secondary-action" disabled={busy} onClick={() => onChoose(conversation.id)}>
          <strong>{conversation.label}</strong><small>{receiverProviderLabel(conversation.provider)} · {conversation.conversationRef}</small>
        </button>) : <p>当前没有 ConnectedConversation。请先从顶栏承接入口连接或新建一个会话。</p>}
      </div>
      {error ? <p className="lcos-conversation-controller-error" role="alert">{error}</p> : null}
      <footer><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>取消</button></footer>
    </section>
  </div>
}

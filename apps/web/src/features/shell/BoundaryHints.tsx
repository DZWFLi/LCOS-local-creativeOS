import { ArrowRight, Bot, Clock3, Sparkles, X } from 'lucide-react'

export interface DepositHintItem {
  readonly id: string
  readonly label: string
  readonly source: string
}

export function ProjectResumeHint({ eyebrow = '上次工作', title, subtitle, actionLabel = '继续这里', onContinue, onDismiss }: {
  readonly eyebrow?: string
  readonly title: string
  readonly subtitle?: string
  readonly actionLabel?: string
  readonly onContinue?: () => void
  readonly onDismiss: () => void
}) {
  return <aside className="lcos-boundary-hint lcos-resume-hint" role="status">
    <header><Clock3 size={14}/><span>{eyebrow}</span><button type="button" aria-label="关闭提示" onClick={onDismiss}><X size={12}/></button></header>
    <strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}
    {onContinue ? <button type="button" className="primary" onClick={onContinue}>{actionLabel}<ArrowRight size={13}/></button> : null}
  </aside>
}

export function SurfaceDepositHint({ kind, items, reflection, onOrganize, onDismiss }: {
  readonly kind: 'context' | 'workflow'
  readonly items: readonly DepositHintItem[]
  readonly reflection?: string
  readonly onOrganize: () => void
  readonly onDismiss: () => void
}) {
  const title = kind === 'context' ? '最近这些可能值得记住' : '最近这些做法可能值得复盘'
  return <aside className={`lcos-boundary-hint lcos-deposit-hint kind-${kind}`} role="status">
    <header><Sparkles size={14}/><span>{kind === 'context' ? '上下文沉淀' : '方法沉淀'}</span><button type="button" aria-label="关闭沉淀提示" onClick={onDismiss}><X size={12}/></button></header>
    <strong>{title}</strong>
    {reflection ? <p>{reflection}</p> : null}
    <ul>{items.slice(0, 4).map((item) => <li key={item.id}><span>{item.label}</span><small>{item.source}</small></li>)}</ul>
    <button type="button" className="primary" onClick={onOrganize}><Bot size={13}/>让 Agent 帮我整理</button>
  </aside>
}

import { ArrowUp, Grip, Loader2, X } from 'lucide-react'
import { SessionGlyph } from '../design/LcosGlyphs'
import { LcosGlyth, type LcosGlythState } from '../spatial/visual/LcosGlyth'
import { useEffect, useRef, useState } from 'react'

interface Point { x: number; y: number }

export interface SurfaceAgentSubmission {
  readonly prompt: string
  readonly sessionId: string
  readonly surface: 'context' | 'workflow'
}

export interface SurfaceAgentSubmissionResult {
  readonly runId?: string
  readonly sessionId: string
}

export interface SurfaceAgentRunState {
  readonly status: 'created' | 'queued' | 'running' | 'waiting_input' | 'review' | 'completed' | 'failed' | 'cancelled'
  readonly summary?: string
  readonly error?: string
}

export function SurfaceAgentNode({ x, y, contextLabel, seedPrompt, surface, onSubmit, onReadRun, onClose }: {
  readonly x: number
  readonly y: number
  readonly contextLabel: string
  readonly seedPrompt?: string
  readonly surface: 'context' | 'workflow'
  readonly onSubmit: (input: SurfaceAgentSubmission) => Promise<SurfaceAgentSubmissionResult | void> | SurfaceAgentSubmissionResult | void
  readonly onReadRun?: (runId: string) => Promise<SurfaceAgentRunState | null>
  readonly onClose: () => void
}) {
  const [prompt, setPrompt] = useState(seedPrompt ?? '')
  const [position, setPosition] = useState<Point>({ x, y })
  const [sessionId] = useState(() => `surface-agent-${crypto.randomUUID()}`)
  const [runId, setRunId] = useState<string | null>(null)
  const [runState, setRunState] = useState<SurfaceAgentRunState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    if (!runId || !onReadRun) return
    let cancelled = false
    let timer = 0
    const poll = async (): Promise<void> => {
      const next = await onReadRun(runId).catch(() => null)
      if (cancelled || next === null) return
      setRunState(next)
      if (!['completed', 'failed', 'cancelled'].includes(next.status)) {
        timer = window.setTimeout(() => { void poll() }, 1_800)
      }
    }
    void poll()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [onReadRun, runId])

  const submit = async () => {
    const value = prompt.trim()
    if (!value || submitting) return
    setSubmitting(true)
    setRunState({ status: 'created' })
    try {
      const result = await onSubmit({ prompt: value, sessionId, surface })
      if (result?.runId) setRunId(result.runId)
      setPrompt('')
      window.requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = runState?.status === 'completed'
    ? '已完成'
    : runState?.status === 'failed'
      ? '执行失败'
      : runState?.status === 'cancelled'
        ? '已取消'
        : runState?.status === 'waiting_input'
          ? '等待补充'
          : runState?.status === 'review'
            ? '结果待确认'
            : runState
              ? 'Agent 工作中'
              : '局部会话'
  const glyphState: LcosGlythState = runState?.status === 'failed'
    ? 'error'
    : runState?.status === 'completed'
      ? 'confirm'
      : runState?.status === 'waiting_input' || runState?.status === 'review'
        ? 'waiting'
        : runState && !['completed', 'cancelled'].includes(runState.status)
          ? 'working'
          : 'stable'

  return <aside className={`lcos-surface-agent-node ${runState ? `is-${runState.status}` : ''}`} style={{ left: position.x, top: position.y }} data-native-context-menu="true" aria-label="局部 Agent">
    <header
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        setPosition({ x: Math.max(8, current.originX + event.clientX - current.startX), y: Math.max(8, current.originY + event.clientY - current.startY) })
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => { drag.current = null }}
    >
      <span className="lcos-agent-node-identity"><Grip size={11}/><i className="lcos-agent-node-signal" aria-label="局部 Agent 状态"><SessionGlyph/><LcosGlyth state={glyphState}/></i><strong>Agent</strong></span><button type="button" onClick={onClose} aria-label="关闭 Agent"><X size={13}/></button>
    </header>
    <small>{contextLabel} · {statusLabel}</small>
    <textarea ref={ref} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="针对这里直接说要做什么" rows={2} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void submit() } }}/>
    <footer><span>{surface === 'context' ? '当前选择会冻结为这轮 Context；需要改 Context 时 Agent 只提交 Proposal' : '当前选择会冻结为这轮 Workflow 局部上下文'}</span><button type="button" disabled={!prompt.trim() || submitting} onClick={() => { void submit() }} aria-label="交给 Agent">{submitting ? <Loader2 size={14}/> : <ArrowUp size={14}/>}</button></footer>
    {runState?.summary && <section className="lcos-agent-node-reply" aria-label="最近回复摘要"><strong>最近回复</strong><p>{runState.summary}</p></section>}
    {runState?.error && <section className="lcos-agent-node-reply is-error"><strong>执行未完成</strong><p>{runState.error}</p></section>}
  </aside>
}

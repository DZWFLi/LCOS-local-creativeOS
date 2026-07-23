import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Layers3, Play, Sparkles, Target, X } from 'lucide-react'
import type { CanvasNode, TargetContextInference } from '../../model'

interface Props {
  open: boolean
  command: string
  nodes: CanvasNode[]
  inference: TargetContextInference
  leftInset: number
  rightInset: number
  onCommandChange: (value: string) => void
  onSelectTarget: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function RunConfirmDialog({
  open,
  command,
  nodes,
  inference,
  leftInset,
  rightInset,
  onCommandChange,
  onSelectTarget,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const cancelRef = useRef(onCancel)
  const confirmRef = useRef(onConfirm)
  const readyRef = useRef(false)
  const keyboardArmedRef = useRef(false)

  const targets = useMemo(
    () => inference.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node)),
    [inference.targetIds, nodes],
  )
  const contexts = useMemo(
    () => inference.contextIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node)),
    [inference.contextIds, nodes],
  )
  const ambiguousTargets = useMemo(
    () => inference.ambiguousTargetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node)),
    [inference.ambiguousTargetIds, nodes],
  )
  const ready = command.trim().length > 0 && targets.length === 1 && ambiguousTargets.length === 0

  useEffect(() => { cancelRef.current = onCancel }, [onCancel])
  useEffect(() => { confirmRef.current = onConfirm }, [onConfirm])
  useEffect(() => { readyRef.current = ready }, [ready])

  useEffect(() => {
    if (!open) return
    setAdvancedOpen(false)
    keyboardArmedRef.current = false
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0)
    const armTimer = window.setTimeout(() => { keyboardArmedRef.current = true }, 180)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRef.current()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && readyRef.current && keyboardArmedRef.current && !event.repeat) {
        event.preventDefault()
        confirmRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.clearTimeout(armTimer)
      keyboardArmedRef.current = false
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="run-confirm-layer"
      data-testid="run-confirm-layer"
      role="presentation"
      style={{ gridTemplateColumns: `${leftInset}px minmax(0, 1fr) ${rightInset}px` }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onWheel={(event) => { event.preventDefault(); event.stopPropagation() }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}
    >
      <section
        className="run-confirm-dialog"
        data-testid="run-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="run-confirm-heading-icon"><Sparkles size={18} /></div>
          <div>
            <span>发送前确认</span>
            <h2 id={titleId}>把这次修改交给 Codex</h2>
          </div>
          <button type="button" aria-label="关闭" onClick={onCancel}><X size={17} /></button>
        </header>

        <div className="run-confirm-body">
          <label className="run-confirm-command">
            <span>你想怎么修改</span>
            <textarea
              ref={textareaRef}
              data-testid="run-confirm-command"
              value={command}
              onChange={(event) => onCommandChange(event.target.value)}
              rows={4}
              placeholder="用一句话说明判断、修改要求或交付目标"
            />
          </label>

          <section className="run-confirm-block target-block">
            <header><Target size={15} /><h3>修改目标</h3></header>
            {ambiguousTargets.length > 0
              ? <div className="run-confirm-target-question">
                  <p>这次主要修改哪个文件？</p>
                  {ambiguousTargets.map((node) => <button key={node.id} type="button" onClick={() => onSelectTarget(node.id)}><span className="target-radio" /><b>{node.title}</b><small>{node.subtitle}</small></button>)}
                </div>
              : targets.length > 0
                ? <div className="run-confirm-primary-target"><Target size={15} /><span><b>{targets[0].title}</b><small>{targets[0].subtitle}</small></span><em>目标</em></div>
                : <p className="run-confirm-empty">请先在画布上选择一个可编辑文件。</p>}
          </section>

          <section className="run-confirm-block context-block-simple">
            <header><Layers3 size={15} /><h3>参考内容</h3><span>{contexts.length} 项</span></header>
            {contexts.length
              ? <div className="run-confirm-context-chips">{contexts.slice(0, 5).map((node) => <span key={node.id}>{node.title}</span>)}{contexts.length > 5 && <span>另有 {contexts.length - 5} 项</span>}</div>
              : <p className="run-confirm-empty">系统会使用当前工作视角中的相关资料。</p>}
            <small className="run-confirm-reason">{inference.reason}</small>
          </section>

          <button className="run-confirm-advanced-toggle" type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((current) => !current)}>
            <span>执行方式：Codex · 保存为新版本</span><ChevronDown size={15} />
          </button>
          {advancedOpen && <section className="run-confirm-advanced">
            <div><span>执行器</span><b>Codex</b></div>
            <div><span>结果处理</span><b>保存为新版本</b></div>
            <p>Alpha 接入后，这里只在需要切换执行器或输出方式时展开。</p>
          </section>}
        </div>

        <footer>
          <span>Esc 取消 · Ctrl/Cmd+Enter 执行</span>
          <div><button type="button" className="quiet" onClick={onCancel}>返回修改</button><button type="button" className="primary" data-testid="run-confirm-start" disabled={!ready} onClick={onConfirm}><Play size={15} />开始执行</button></div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

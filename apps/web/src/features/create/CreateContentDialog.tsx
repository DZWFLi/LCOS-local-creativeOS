import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FolderPlus, MessageSquareText, X } from 'lucide-react'

interface Props {
  open: boolean
  leftInset: number
  rightInset: number
  onCancel: () => void
  onCreate: (kind: 'note' | 'context') => void
}

export function CreateContentDialog({ open, leftInset, rightInset, onCancel, onCreate }: Props) {
  const titleId = useId()
  const noteRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => noteRef.current?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel, open])

  if (!open) return null

  return createPortal(
    <div
      className="canvas-create-layer"
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
    >
      <section
        className="canvas-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>添加到画布</span>
            <h2 id={titleId}>你想记录什么？</h2>
          </div>
          <button type="button" aria-label="关闭" onClick={onCancel}><X size={17} /></button>
        </header>

        <p className="canvas-create-intro">只选择结果，节点类型、关系和位置由系统处理。文件仍然直接拖入画布。</p>

        <div className="canvas-create-options">
          <button ref={noteRef} type="button" onClick={() => onCreate('note')}>
            <span className="canvas-create-icon note"><MessageSquareText size={19} /></span>
            <span><b>记录一个想法</b><small>判断、灵感、修改意见或临时备注</small></span>
          </button>
          <button type="button" onClick={() => onCreate('context')}>
            <span className="canvas-create-icon collection"><FolderPlus size={19} /></span>
            <span><b>建立内容集合</b><small>创建可进入的子画布，用于方向、参考或交付</small></span>
          </button>
        </div>

        <footer>
          <span>Esc 取消</span>
          <button type="button" onClick={onCancel}>取消</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

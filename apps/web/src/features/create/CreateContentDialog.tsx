import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FolderPlus, MessageSquareText, X } from 'lucide-react'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

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
      onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}
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
            <h2 id={titleId}>创建内容</h2>
          </div>
          <button type="button" aria-label="关闭" onClick={onCancel}><X size={17} /></button>
        </header>

        <p className="canvas-create-intro">这里只创建最基础的文本或集合。文件、链接和 Agent 过程由各自来源自动建立。</p>

        <div className="canvas-create-options">
          <button ref={noteRef} type="button" onClick={() => onCreate('note')}>
            <span className="canvas-create-icon note"><MessageSquareText size={19} /></span>
            <span><b>新建文本</b><small>轻量文字内容，可直接加入 Context 或交给 Agent 整理</small></span>
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

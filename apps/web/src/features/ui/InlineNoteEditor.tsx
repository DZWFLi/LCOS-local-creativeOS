import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Camera, CanvasNode } from '../../model'

interface Props {
  readonly node: CanvasNode
  readonly camera: Camera
  readonly onCancel: () => void
  readonly onSave: (input: { readonly title: string; readonly body: string }) => void
}

function readViewport() {
  if (typeof window === 'undefined') return { width: 1440, height: 900 }
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * Inline note editor — double-click a text node to edit its body in place
 * (mubu-style canvas writing). First line doubles as the node title.
 * Ctrl/⌘+Enter saves, Escape cancels. Positioned like InlineNodeRename.
 */
export function InlineNoteEditor({ node, camera, onCancel, onSave }: Props) {
  const initial = node.noteLayout === 'mindmap' ? (node.noteOutline ?? node.noteBody ?? '') : (node.noteBody ?? '')
  const [value, setValue] = useState(`${node.title}\n${initial.startsWith(node.title) ? '' : initial}`)
  const [viewport, setViewport] = useState(readViewport)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const lines = value.split('\n')
  const title = (lines[0] ?? '').trim()
  const body = lines.slice(1).join('\n')

  const position = useMemo(() => {
    const width = 340
    const height = 240
    const railWidth = viewport.width <= 900 ? 0 : 420
    const sceneWidth = Math.max(520, viewport.width - railWidth)
    const sceneHeight = Math.max(480, viewport.height - 52)
    const nodeRight = camera.x + (node.x + node.width) * camera.zoom
    const nodeLeft = camera.x + node.x * camera.zoom
    const nodeTop = camera.y + node.y * camera.zoom
    const preferredLeft = nodeRight + 12
    const left = preferredLeft + width <= sceneWidth - 16
      ? preferredLeft
      : Math.max(16, nodeLeft - width - 12)
    const top = Math.min(Math.max(16, nodeTop), Math.max(16, sceneHeight - height - 16))
    return { left, top }
  }, [camera, node.width, node.x, node.y, viewport.height, viewport.width])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      areaRef.current?.focus()
      // Put the caret at the end of the body, after the title line.
      const area = areaRef.current
      if (area) area.selectionStart = area.selectionEnd = area.value.length
    })
    const handleResize = () => setViewport(readViewport())
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const save = () => {
    if (!title) return
    onSave({ title, body })
  }

  return <form
    className="inline-node-rename inline-note-editor"
    style={{ ...position, width: 340 }}
    aria-label="编辑文本节点"
    onPointerDown={(event) => event.stopPropagation()}
    onSubmit={(event) => { event.preventDefault(); save() }}
  >
    <label>文本节点 <small>第一行 = 标题</small></label>
    <textarea
      ref={areaRef}
      value={value}
      rows={7}
      spellCheck={false}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel() }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); save() }
      }}
    />
    <div>
      <button type="button" className="ghost" aria-label="取消编辑" onClick={onCancel}><X size={14}/></button>
      <button type="submit" className="ghost" aria-label="保存文本" disabled={!title}><Check size={14}/></button>
    </div>
    <small>Ctrl+Enter 保存 · Esc 取消</small>
  </form>
}

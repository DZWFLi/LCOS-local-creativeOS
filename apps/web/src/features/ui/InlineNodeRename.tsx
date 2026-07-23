import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Camera, CanvasNode } from '../../model'

interface Props {
  node: CanvasNode
  camera: Camera
  onCancel: () => void
  onSave: (value: string) => void
}

function readViewport() {
  if (typeof window === 'undefined') return { width: 1440, height: 900 }
  return { width: window.innerWidth, height: window.innerHeight }
}

export function InlineNodeRename({ node, camera, onCancel, onSave }: Props) {
  const [value, setValue] = useState(node.title)
  const [viewport, setViewport] = useState(readViewport)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const trimmed = value.trim()
  const position = useMemo(() => {
    const width = 286
    const height = 112
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
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    const handleResize = () => setViewport(readViewport())
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <form
    className="inline-node-rename"
    style={position}
    aria-label="重命名节点"
    onPointerDown={(event) => event.stopPropagation()}
    onSubmit={(event) => { event.preventDefault(); if (trimmed) onSave(trimmed) }}
  >
    <label>节点名称</label>
    <div>
      <input
        ref={inputRef}
        value={value}
        maxLength={80}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } }}
      />
      <button type="button" aria-label="取消重命名" onClick={onCancel}><X size={14} /></button>
      <button type="submit" aria-label="保存名称" disabled={!trimmed}><Check size={14} /></button>
    </div>
    <small>回车保存 · Esc 取消</small>
  </form>
}

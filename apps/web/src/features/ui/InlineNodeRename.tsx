import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Camera, CanvasNode } from '../../model'
import { readShellChromeInsets } from './shellChromeInsets'

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
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const trimmed = value.trim()

  const submit = () => {
    if (!trimmed) {
      setInvalid(true)
      window.setTimeout(() => setInvalid(false), 600)
      return
    }
    onSave(trimmed)
  }
  const position = useMemo(() => {
    const width = 286
    const height = 112
    // B-3：安全区扣除 shell chrome 占位（左 Rail + 底部 Dock），节点在安全区外时翻转到另一侧。
    const chrome = readShellChromeInsets()
    const railWidth = viewport.width <= 900 ? 0 : 420
    const safeLeft = chrome.left + 12
    const safeRight = Math.max(safeLeft + width, viewport.width - railWidth - 16)
    const safeBottom = Math.max(safeLeft + height, viewport.height - chrome.bottom - 16)
    const nodeRight = camera.x + (node.x + node.width) * camera.zoom
    const nodeLeft = camera.x + node.x * camera.zoom
    const nodeTop = camera.y + node.y * camera.zoom
    const preferredLeft = nodeRight + 12
    // 右侧安全区放不下 → 翻转到节点左侧，并 clamp 进左侧安全区。
    const left = preferredLeft + width <= safeRight
      ? Math.min(preferredLeft, safeRight - width)
      : Math.max(safeLeft, nodeLeft - width - 12)
    // 底部安全区放不下（节点太靠下/被 Dock 遮挡）→ 翻转到节点上方。
    const top = nodeTop + height > safeBottom
      ? Math.max(16, nodeTop - height - 12)
      : Math.min(Math.max(16, nodeTop), safeBottom - height)
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
    className={`inline-node-rename${invalid ? ' is-invalid' : ''}`}
    style={position}
    aria-label="重命名节点"
    onPointerDown={(event) => event.stopPropagation()}
    onSubmit={(event) => { event.preventDefault(); submit() }}
  >
    <label>{invalid ? '名称不能为空' : '节点名称'}</label>
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

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  readonly open: boolean
  readonly title: string
  readonly hint?: string
  readonly onClose: () => void
  readonly children: ReactNode
}

/**
 * 组件级沉浸容器（施工单 §4.13.2-G-1「最大化复用沉浸式预览」）。
 *
 * 结构/演进/关系/来源链组件卡的「最大化」出口：外壳零新写，直接复用
 * ImmersiveViewer 的 vnext-immersive-* 样式（backdrop + viewer + header + content，
 * vnext.css 已有全部定义）。children 由调用方塞入该组件的完整内容无尺寸限制版。
 *
 * - portal 到 body 并挂 .lcos-reconstructed：画布侧样式（product-interface.css 等）
 *   多以 .lcos-reconstructed 为前缀，挂上后组件内容在浮层内继续命中；
 *   --lcos-ui-scale 已由 App 写到 documentElement，可从根继承（同 NodeInfoPopover 先例）。
 * - Esc 关闭；关闭只卸载浮层，不触碰画布 state（DoD ③ 关闭回原位）。
 */
export function SurfaceComponentImmersive({ open, title, hint, onClose, children }: Props) {
  // Esc 关闭（与 ImmersiveViewer 的关闭钮同级交互；监听挂 window，浮层内任意位置生效）
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    // onPointerDown 阻断 React portal 事件沿组件树冒泡回 SurfaceFrame——沉浸内的指针交互不得透传为底层组件卡的拖拽/选中
    <div className="lcos-reconstructed vnext-immersive-backdrop" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(event) => event.stopPropagation()}>
      <div className="vnext-immersive-viewer">
        <header className="vnext-immersive-header">
          <div><strong>{title}</strong>{hint ? <small>{hint}</small> : null}</div>
          <span className="vnext-immersive-spacer" />
          <button type="button" onClick={onClose} aria-label="关闭并回到画布" title="关闭并回到画布（Esc）"><X size={16} /></button>
        </header>
        <div className="vnext-immersive-content">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

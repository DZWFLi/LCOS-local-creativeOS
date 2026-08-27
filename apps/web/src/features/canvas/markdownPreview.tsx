import { useEffect, useRef } from 'react'
import type { Crepe } from '@milkdown/crepe'
// Crepe 主题：common/style.css 是排版骨架（.milkdown/.ProseMirror 规则），
// classic.css 只注入 CSS 变量基色——两者都进主 CSS bundle（体积小，且 vitest 对 css 静默 stub，
// renderToStaticMarkup 场景不会执行任何 Crepe 代码）。
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/classic.css'

export interface CrepeHostProps {
  /** 只读渲染的 Markdown 全文（非空由调用方保证）。 */
  markdown: string
  className?: string
}

/**
 * A-1：Milkdown Crepe 只读真渲染（Grammar §10 direct reading）。
 *
 * LOD 策略：仅在节点 expanded 态挂载（一个 ProseMirror 实例的成本由「用户已展开该节点」
 * 的高注意力信号买单）；standard/compact 态维持 TextPreview 纸质摘要。
 *
 * 生命周期：
 * - Crepe 在 useEffect 内动态 import（主 chunk 不含 ProseMirror；SSR 静态渲染只得到空容器）；
 * - create() 完成后 setReadonly(true)；
 * - 卸载/换文时 destroy()——异步 create 途中的卸载用 disposed 标记防竞态（StrictMode 双挂载同防）；
 * - markdown 变化 = 卸载重建（保存后重挂刷新全文，低频路径不走 replaceAll 增量）。
 */
export function CrepeHost({ markdown, className }: CrepeHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const markdownRef = useRef(markdown)
  markdownRef.current = markdown

  useEffect(() => {
    const root = hostRef.current
    if (!root) return
    let disposed = false
    const instance: { current: Crepe | null } = { current: null }
    void (async () => {
      const { Crepe: CrepeCtor } = await import('@milkdown/crepe')
      // create 异步窗口内组件被卸载（或 StrictMode 双挂载第一帧被丢弃）：不再挂载。
      if (disposed || hostRef.current !== root) return
      const crepe = new CrepeCtor({
        root,
        defaultValue: markdownRef.current,
        // 只读阅读态：关掉一切编辑交互 feature（工具条/块拖拽/链接浮窗/占位/光标/图片上传），
        // 保留 CodeMirror 代码块高亮、列表、表格、公式的阅读价值。
        features: {
          toolbar: false,
          'block-edit': false,
          'link-tooltip': false,
          placeholder: false,
          cursor: false,
          'image-block': false,
        },
      })
      await crepe.create()
      if (disposed) {
        void crepe.destroy()
        return
      }
      crepe.setReadonly(true)
      instance.current = crepe
    })()
    return () => {
      disposed = true
      const crepe = instance.current
      instance.current = null
      void crepe?.destroy()
    }
  }, [markdown])

  return <div ref={hostRef} className={className} aria-busy="false" />
}
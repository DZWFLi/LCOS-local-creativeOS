import { FileText, Presentation } from 'lucide-react'
import type { CanvasNode } from '../../model'

export function PreviewSurface({ node, variant = 'single' }: { node: CanvasNode; variant?: 'single' | 'before' | 'after' }) {
  const title = variant === 'before' ? '当前 V6' : variant === 'after' ? '草稿 V7' : node.title
  return <div className={`preview-surface ${variant}`}>
    <div className="preview-toolbar"><Presentation size={13} /><span>{title}</span><small>第 5 页</small></div>
    <div className="preview-page">
      <div className="preview-page-copy"><small>PORTASPLIT</small><strong>{variant === 'after' ? '更直接的产品利益点' : 'Thinker 创意方向'}</strong><span>{variant === 'after' ? '35% 节能信息已被提前并强化。' : '产品利益点与视觉方向概览。'}</span></div>
      <div className="preview-page-visual"><i /><i /><i /></div>
      {variant === 'after' && <div className="diff-outline" />}
    </div>
    <footer><FileText size={12} /> PPT 演示文件 · 12 页</footer>
  </div>
}

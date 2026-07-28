import { FileText, Presentation } from 'lucide-react'
import type { CanvasNode } from '../../model'

export function PreviewSurface({ node, variant = 'single' }: { node: CanvasNode; variant?: 'single' | 'before' | 'after' }) {
  const title = variant === 'before' ? '当前版本' : variant === 'after' ? '待确认版本' : node.title
  const summary = node.subtitle || (node.previewStatus === 'ready' ? 'Preview cache is ready.' : 'Preview content is not generated yet.')
  return <div className={`preview-surface ${variant}`}>
    <div className="preview-toolbar"><Presentation size={13} /><span>{title}</span><small>{node.fileType ?? 'Artifact'}</small></div>
    <div className="preview-page">
      <div className="preview-page-copy"><small>{node.previewStatus ?? 'runtime'}</small><strong>{node.title}</strong><span>{summary}</span></div>
      <div className="preview-page-visual"><i /><i /><i /></div>
      {variant === 'after' && <div className="diff-outline" />}
    </div>
    <footer><FileText size={12} /> {node.revisionId ? `Revision ${node.revisionId}` : 'Runtime artifact'}</footer>
  </div>
}

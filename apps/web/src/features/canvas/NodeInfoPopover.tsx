import { ExternalLink, FileStack, FileText, GitBranch, Layers3, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Camera, CanvasNode } from '../../model'
import { nodeMeta } from '../../model'

interface Props {
  node: CanvasNode
  camera: Camera
  relationCount: number
  onClose: () => void
  onRelations: () => void
  onShowResource?: (node: CanvasNode) => void
  onPreview?: (node: CanvasNode) => void
  onRevisions?: (node: CanvasNode) => void
}

export function NodeInfoPopover({ node, camera, relationCount, onClose, onRelations, onShowResource, onPreview, onRevisions }: Props) {
  const popoverRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.node-details')) return
      if (popoverRef.current?.contains(target as Node)) return
      onClose()
    }
    window.addEventListener('pointerdown', closeFromOutside)
    return () => window.removeEventListener('pointerdown', closeFromOutside)
  }, [onClose])
  const canvas = document.querySelector<HTMLElement>('[data-testid="canvas"]')
  const rect = canvas?.getBoundingClientRect()
  const anchorX = (rect?.left ?? 0) + camera.x + (node.x + node.width) * camera.zoom
  const anchorY = (rect?.top ?? 44) + camera.y + 8 * camera.zoom + node.y * camera.zoom
  const width = 294
  const preferLeft = anchorX + width + 12 > window.innerWidth - 56
  const left = preferLeft ? Math.max(12, anchorX - width - 10) : Math.min(window.innerWidth - width - 12, anchorX + 10)
  const top = Math.max(54, Math.min(window.innerHeight - 510, anchorY))
  const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
  const revisionState = node.historical ? 'Historical' : node.current ? 'Current' : node.draft ? 'Draft' : node.revisionId ? 'Revision' : '—'
  const revisionCount = Math.max(node.revisionCount ?? 0, node.revisionId ? 1 : 0)
  const source = url ? 'External URL' : node.runtimeState === 'persisted' ? 'Runtime' : node.fileRecordId ? 'Local Core' : 'Local'
  const processState = node.parentRunId ? `${node.parentRunId}${node.runStatus ? ` · ${node.runStatus}` : ''}` : '没有关联执行记录'
  const hasReadOnlyPreview = Boolean(node.fileRecordId && (node.fileType === 'pdf' || node.fileType === 'presentation'))

  return createPortal(<aside ref={popoverRef} className={`node-info-popover ${preferLeft ? 'place-left' : 'place-right'}`} style={{ left, top }} data-testid="node-info-popover" role="dialog" aria-label={`${node.title} 信息`}>
    <header><div><small>{nodeMeta[node.kind].label}</small><h3>{node.title}</h3></div><button className="icon-button pressable" aria-label="关闭节点信息" onClick={onClose}><X size={14} /></button></header>
    <dl>
      <div><dt><FileText size={12} />版本</dt><dd>{revisionState}</dd></div>
      <div><dt><Layers3 size={12} />来源</dt><dd>{source}</dd></div>
      <div><dt><GitBranch size={12} />流程</dt><dd>{processState}</dd></div>
      <div><dt>Preview</dt><dd>{hasReadOnlyPreview ? 'read-only available' : node.previewStatus ?? 'not-generated'}</dd></div>
      {node.fileAvailability && <div><dt>文件</dt><dd>{node.fileAvailability}</dd></div>}
      {node.revisionId && <div><dt>Revision ID</dt><dd title={node.revisionId}>{node.revisionId}</dd></div>}
    </dl>
    {revisionCount > 1 && <section className="revision-history" aria-label="版本历史">
      <header><span><FileStack size={12} />版本历史</span><b>{revisionCount}</b></header>
      <ol>
        <li className="active"><i /><div><strong>{node.revisionLabel ?? `V${revisionCount}`}</strong><span>{node.draft ? 'Draft · 等待确认' : node.current ? 'Current · 当前使用' : '正在查看'}</span></div><em>NOW</em></li>
        {Array.from({ length: Math.min(2, revisionCount - 1) }, (_, index) => {
          const version = Math.max(1, revisionCount - index - 1)
          return <li key={version}><i /><div><strong>V{version}</strong><span>{index === 0 ? 'Previous · 上一版本' : 'Historical · 稳定历史'}</span></div><em>{index === 0 ? 'PREV' : 'HISTORY'}</em></li>
        })}
      </ol>
      <p>恢复旧版会创建新 Draft，不覆盖 Current。</p>
    </section>}
    <div className="node-info-actions"><button className="pressable" onClick={onRelations}><GitBranch size={13} />查看关联 <span>{relationCount}</span></button>{node.artifactId && onRevisions && <button className="pressable" onClick={() => onRevisions(node)}><FileStack size={13} />版本与来源</button>}{hasReadOnlyPreview && onPreview && <button className="pressable" onClick={() => onPreview(node)}><ExternalLink size={13} />只读预览</button>}{node.artifactId && onShowResource && <button className="pressable" onClick={() => onShowResource(node)}><FileText size={13} />资源理解</button>}{url && <button className="pressable" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={13} />浏览器打开</button>}</div>
    <footer>{node.observedPath ?? node.subtitle}</footer>
  </aside>, document.body)
}

import { Copy, ExternalLink, FileStack, FileText, FolderOpen, GitBranch, Layers3, Link2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Camera, CanvasNode } from '../../model'
import { nodeMeta } from '../../model'
import { detectFileIdentity } from './CanvasNodeVisual'
import { nodeVisualBounds } from './canvasVisualGeometry'
import { collectSpatialOverlayOccupiedRects } from '../ui/spatialOverlayEnvironment'
import { resolveSpatialOverlayPlacement } from '../ui/spatialOverlayPlacement'

interface Props {
  node: CanvasNode
  camera: Camera
  relationCount: number
  onClose: () => void
  onRelations: () => void
  onShowResource?: (node: CanvasNode) => void
  onPreview?: (node: CanvasNode) => void
  onOpenMaterialSource?: (node: CanvasNode) => void
  onRevisions?: (node: CanvasNode) => void
  onOpenSource?: (node: CanvasNode) => void
  onRevealSource?: (node: CanvasNode) => void
  onCopyPath?: (node: CanvasNode) => void
  onCopyImage?: (node: CanvasNode) => void
  onCopyLink?: (node: CanvasNode) => void
  onCopyText?: (node: CanvasNode) => void
  onRelinkSource?: (node: CanvasNode, path: string) => void
  shortcutResolution?: { resolvedTarget: string | null; targetKind: string; targetExists: boolean } | null
}

export function NodeInfoPopover({ node, camera, relationCount, onClose, onRelations, onShowResource, onPreview, onOpenMaterialSource, onRevisions, onOpenSource, onRevealSource, onCopyPath, onCopyImage, onCopyLink, onCopyText, onRelinkSource, shortcutResolution }: Props) {
  const popoverRef = useRef<HTMLElement | null>(null)
  const [relinkPath, setRelinkPath] = useState('')
  const [measuredOverlaySize, setMeasuredOverlaySize] = useState({ width: 294, height: 510 })
  useLayoutEffect(() => {
    const element = popoverRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 1 || rect.height <= 1) return
      setMeasuredOverlaySize((current) => Math.abs(current.width - rect.width) < .5 && Math.abs(current.height - rect.height) < .5
        ? current
        : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
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
  const canvasRect = canvas?.getBoundingClientRect()
  const visualBounds = nodeVisualBounds(node)
  const targetBounds = canvasRect ? {
    left: canvasRect.left + camera.x + visualBounds.x * camera.zoom,
    top: canvasRect.top + camera.y + visualBounds.y * camera.zoom,
    width: visualBounds.width * camera.zoom,
    height: visualBounds.height * camera.zoom,
  } : { left: 0, top: 0, width: 1, height: 1 }
  const viewport = canvasRect
    ? { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  const placement = resolveSpatialOverlayPlacement({
    targetBounds,
    overlaySize: measuredOverlaySize,
    viewport,
    occupiedRects: collectSpatialOverlayOccupiedRects(viewport, popoverRef.current),
    preferredSide: 'right',
    gap: 10,
    margin: 12,
  })
  const left = placement.left
  const top = placement.top
  const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
  const identity = detectFileIdentity(node)
  const linkUrl = url
    ?? (node.previewUrl?.startsWith('http') ? node.previewUrl : undefined)
    ?? node.title.match(/^https?:\/\/\S+/)?.[0]
    ?? node.observedPath?.match(/^https?:\/\/\S+/)?.[0]
  const revisionState = node.historical ? 'Historical' : node.current ? 'Current' : node.draft ? 'Draft' : node.revisionId ? 'Revision' : '—'
  const revisionCount = Math.max(node.revisionCount ?? 0, node.revisionId ? 1 : 0)
  const source = url ? 'External URL' : node.runtimeState === 'persisted' ? 'Runtime' : node.fileRecordId ? 'Local Core' : 'Local'
  const processState = node.parentRunId ? `${node.parentRunId}${node.runStatus ? ` · ${node.runStatus}` : ''}` : '没有关联执行记录'
  const hasReadOnlyPreview = Boolean(node.fileRecordId && (node.fileType === 'pdf' || node.fileType === 'presentation'))
  const localFile = Boolean(node.fileRecordId || node.observedPath)
  const canCopyImage = Boolean(identity === 'image' && onCopyImage && (node.previewDataUrl || node.previewUrl))
  const canCopyLink = Boolean(linkUrl && onCopyLink)
  const canCopyText = Boolean(onCopyText && (node.previewText?.trim() || node.kind === 'source' || node.kind === 'working'))
  const isShortcut = node.title.toLocaleLowerCase('en-US').endsWith('.lnk')
    || Boolean(node.observedPath?.toLocaleLowerCase('en-US').endsWith('.lnk'))
  // GUI-2 §5：有值才显示；Revision ID / 工程字段后置到 Developer 折叠区。
  const hasRevision = revisionCount > 0
  const hasPreview = node.previewStatus !== undefined && node.previewStatus !== 'not-generated'

  return createPortal(<aside ref={popoverRef} className={`node-info-popover place-${placement.side}`} data-spatial-placement-side={placement.side} data-spatial-placement-free={placement.free || undefined} style={{ position: 'fixed', left, top, zIndex: 'var(--lcos-z-overlay-ui)' /* z-tier: overlay-ui（B-1 归层；portal 到 body 须自带定位与层级） */ }} data-testid="node-info-popover" role="dialog" aria-label={`${node.title} 信息`} onContextMenu={(event) => event.preventDefault()}>
    <header><div><small>{nodeMeta[node.kind].label}</small><h3>{node.title}</h3></div><button className="icon-button pressable" aria-label="关闭节点信息" onClick={onClose}><X size={14} /></button></header>
    <dl>
      {hasRevision && <div><dt><FileText size={12} />版本</dt><dd>{revisionState}</dd></div>}
      <div><dt><Layers3 size={12} />来源</dt><dd>{source}</dd></div>
      {node.parentRunId && <div><dt><GitBranch size={12} />流程</dt><dd>{processState}</dd></div>}
      {hasPreview && <div><dt>Preview</dt><dd>{hasReadOnlyPreview ? 'read-only available' : node.previewStatus}</dd></div>}
      {node.fileAvailability && <div><dt>文件</dt><dd>{node.fileAvailability}</dd></div>}
    </dl>
    {isShortcut && shortcutResolution && !shortcutResolution.targetExists && (
      <section className="source-broken" aria-label="源快捷方式已失效">
        <p><Link2 size={12} />来源已失效：{shortcutResolution.resolvedTarget ?? '无法解析快捷方式目标'}</p>
        <div className="source-relink">
          <input value={relinkPath} placeholder="输入新的文件路径" onChange={(event) => setRelinkPath(event.target.value)} />
          <button type="button" className="pressable" disabled={!relinkPath.trim()} onClick={() => onRelinkSource?.(node, relinkPath.trim())}>重新链接</button>
        </div>
      </section>
    )}
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
    <div className="node-info-actions"><button className="pressable" onClick={onRelations}><GitBranch size={13} />查看关联 <span>{relationCount}</span></button>{node.materialSource && onOpenMaterialSource && <button className="pressable" onClick={() => onOpenMaterialSource(node)}><Link2 size={13} />回到来源</button>}{node.artifactId && onRevisions && <button className="pressable" onClick={() => onRevisions(node)}><FileStack size={13} />版本与来源</button>}{hasReadOnlyPreview && onPreview && <button className="pressable" onClick={() => onPreview(node)}><ExternalLink size={13} />只读预览</button>}{node.artifactId && onShowResource && <button className="pressable" onClick={() => onShowResource(node)}><FileText size={13} />详情</button>}{localFile && onOpenSource && <button className="pressable" onClick={() => onOpenSource(node)}><ExternalLink size={13} />打开</button>}{localFile && onRevealSource && <button className="pressable" onClick={() => onRevealSource(node)}><FolderOpen size={13} />定位</button>}{localFile && onCopyPath && <button className="pressable" onClick={() => onCopyPath(node)}><Copy size={13} />复制路径</button>}{canCopyImage && <button className="pressable" onClick={() => onCopyImage!(node)}><Copy size={13} />复制图片</button>}{canCopyLink && <button className="pressable" onClick={() => onCopyLink!(node)}><Link2 size={13} />复制链接</button>}{canCopyText && <button className="pressable" onClick={() => onCopyText!(node)}><Copy size={13} />复制文本</button>}{url && <button className="pressable" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={13} />浏览器打开</button>}</div>
    {(node.revisionId || node.fileRecordId || node.contentHash) && <details className="node-info-developer">
      <summary>Developer / 工程字段</summary>
      <dl>
        {node.revisionId && <div><dt>Revision ID</dt><dd title={node.revisionId}>{node.revisionId}</dd></div>}
        {node.fileRecordId && <div><dt>File Record</dt><dd title={node.fileRecordId}>{node.fileRecordId}</dd></div>}
        {node.contentHash && <div><dt>Content Hash</dt><dd title={node.contentHash}>{node.contentHash.slice(0, 16)}…</dd></div>}
      </dl>
    </details>}
    {(node.observedPath || node.subtitle) && <footer>{node.observedPath ?? node.subtitle}</footer>}
  </aside>, document.body)
}

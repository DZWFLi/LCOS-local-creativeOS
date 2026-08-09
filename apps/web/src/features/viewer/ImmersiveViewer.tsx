import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { CanvasNode } from '../../model'
import { ArtifactViewerHost, resolveArtifactViewerKind } from './artifactViewerRegistry'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

interface Props {
  node: CanvasNode
  projectId: string
  onClose: () => void
}

export function ImmersiveViewer({ node, projectId, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const kind = resolveArtifactViewerKind(node)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [onClose])

  const externalUrl = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]

  return <div className="vnext-immersive-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onClose)}>
    <section ref={panelRef} tabIndex={-1} className={`vnext-immersive-viewer viewer-${kind}`} role="dialog" aria-modal="true" aria-label={`${node.title} 预览`}>
      <header className="vnext-immersive-header">
        <button type="button" className="vnext-immersive-back" onClick={onClose} aria-label="返回画布"><ArrowLeft size={16} /></button>
        <div><strong>{node.title}</strong>{node.pageCount ? <small>{node.pageCount} 页</small> : null}</div>
        <span className="vnext-immersive-spacer" />
        {externalUrl ? <a href={externalUrl} target="_blank" rel="noopener noreferrer" aria-label="在浏览器中打开"><ExternalLink size={16} /></a> : null}
        <button type="button" onClick={onClose} aria-label="关闭预览"><X size={16} /></button>
      </header>
      <div className="vnext-immersive-content">
        <ArtifactViewerHost node={node} projectId={projectId} />
      </div>
    </section>
  </div>
}

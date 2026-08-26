import { Drawer } from '@base-ui/react/drawer'
import { ArrowLeft, ExternalLink, GripVertical, X } from 'lucide-react'
import type { CanvasNode } from '../../model'
import { ArtifactViewerHost, resolveArtifactViewerKind } from './artifactViewerRegistry'
import { displayNodeTitle, nodeSecondaryLine } from '../canvas/CanvasNodeVisual'

interface Props {
  node: CanvasNode
  projectId: string
  onClose: () => void
}

/**
 * Read-only material drawer.
 *
 * Deliberately non-modal: the canvas remains visible and accepts native
 * DataTransfer drops while a page/slide/text selection is being inspected.
 */
export function ImmersiveViewer({ node, projectId, onClose }: Props) {
  const kind = resolveArtifactViewerKind(node)
  const title = displayNodeTitle(node)
  const secondary = nodeSecondaryLine(node)
  const externalUrl = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]

  return <Drawer.Root
    open
    onOpenChange={(open) => { if (!open) onClose() }}
    swipeDirection="right"
    modal={false}
    disablePointerDismissal
  >
    <Drawer.Portal>
      <Drawer.Viewport className={`lcos-viewer-drawer-viewport viewer-viewport-${kind}`}>
        <Drawer.Popup className={`lcos-viewer-drawer-popup viewer-${kind}`}>
          <Drawer.Content className="lcos-viewer-drawer-content">
            <div className="lcos-viewer-drawer-grip" aria-hidden="true"><GripVertical size={14}/></div>
            <header className="vnext-immersive-header">
              <button type="button" className="vnext-immersive-back" onClick={onClose} aria-label="返回画布"><ArrowLeft size={16} /></button>
              <div>
                <Drawer.Title className="lcos-viewer-title">{title}</Drawer.Title>
                {secondary ? <small>{secondary}</small> : node.pageCount ? <small>{node.pageCount} 页</small> : <small>拖出选区 / 页面即可放回画布</small>}
              </div>
              <span className="vnext-immersive-spacer" />
              {externalUrl ? <a href={externalUrl} target="_blank" rel="noopener noreferrer" aria-label="在浏览器中打开"><ExternalLink size={16} /></a> : null}
              <Drawer.Close className="lcos-viewer-close" aria-label="关闭预览"><X size={16} /></Drawer.Close>
            </header>
            <div className="vnext-immersive-content" data-base-ui-swipe-ignore>
              <ArtifactViewerHost node={node} projectId={projectId} />
            </div>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
}

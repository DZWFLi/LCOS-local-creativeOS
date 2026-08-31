import { Crosshair, Eye, GitBranch, MapPin } from 'lucide-react'
import type { RefObject } from 'react'
import type { CanvasNode } from '../../model'
import { displayNodeTitle } from '../canvas/CanvasNodeVisual'
import { useProjectSpatialMarkersOrNull } from '../spatial/ProjectSpatialMarkerContext'
import { markerForNavigationTarget } from '../spatial/spatialNavigationFamily'
import { ObjectOrbit, type ObjectOrbitAction } from './ObjectOrbit'

interface Props {
  readonly open: boolean
  readonly node: CanvasNode
  readonly anchorRef: RefObject<Element | null>
  readonly onClose: () => void
  readonly onOpen?: () => void
  readonly onLocate?: () => void
  readonly onRelation?: () => void
}

/**
 * Universal ordinary-project-object Orbit projection.
 *
 * This component owns no Project truth. It only projects capabilities that are
 * actually available for the current object: Open is emitted only when the object
 * has a real deeper destination, Locate is optional, and Pin is exposed only when
 * the canonical Spatial Marker runtime is
 * present. Relation is emitted only when the caller wires the canonical spatial
 * relation intent owner. Assembly / More remain absent until their real owners are
 * wired; capability gaps must fail-close rather than become fake UI.
 */

export function projectObjectCanOpen(node: CanvasNode): boolean {
  if (node.entityKind === 'conversation' || node.entityKind === 'collection') return false
  if (node.id.startsWith('workspace:')) return true
  if (node.id.startsWith('scope:')) return node.entityKind === 'context' || node.entityKind === 'workflow' || Boolean(node.opensScopeId)
  if (node.kind === 'note' || node.fileType === 'markdown') return true
  if (node.opensScopeId || node.artifactId) return true

  // Keep capability detection lightweight here. The full viewer registry imports
  // document renderers; Orbit only needs to know whether handleDoubleClick has a
  // real read destination for an unpersisted preview-shaped object.
  const fileType = (node.fileType ?? '').toLocaleLowerCase('en-US')
  const title = node.title.toLocaleLowerCase('en-US')
  if (node.previewText?.startsWith('url:')) return true
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'image', 'pdf', 'ppt', 'pptx', 'presentation', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'webm', 'mov', 'mkv', 'md', 'txt', 'text', 'json', 'yaml', 'yml'].includes(fileType)
    || /\.(png|jpe?g|webp|gif|svg|pdf|pptx?|mp3|wav|ogg|m4a|flac|mp4|webm|mov|mkv|md|txt|json|ya?ml)$/.test(title)
}

export function ProjectObjectOrbit({ open, node, anchorRef, onClose, onOpen, onLocate, onRelation }: Props) {
  const markerRuntime = useProjectSpatialMarkersOrNull()
  const targetRef = markerRuntime
    ? { projectId: markerRuntime.projectId, kind: 'view' as const, id: node.id }
    : null
  const marker = markerRuntime && targetRef ? markerForNavigationTarget(markerRuntime.records, targetRef) : null

  const actions: ObjectOrbitAction[] = [
    ...(onOpen && projectObjectCanOpen(node)
      ? [{ id: 'object-open', label: '打开', icon: Eye, primary: true, onClick: onOpen } satisfies ObjectOrbitAction]
      : []),
    ...(onLocate ? [{ id: 'object-locate', label: '在哪', icon: Crosshair, onClick: onLocate } satisfies ObjectOrbitAction] : []),
    ...(onRelation ? [{ id: 'object-relation', label: '关系', icon: GitBranch, onClick: onRelation } satisfies ObjectOrbitAction] : []),
    ...(markerRuntime && targetRef
      ? [marker
        ? { id: 'object-pin', label: '取消 Pin', icon: MapPin, onClick: () => { void markerRuntime.deleteMarker(marker.id) } }
        : { id: 'object-pin', label: 'Pin', icon: MapPin, onClick: () => { void markerRuntime.createMarker({ targetRef, scope: 'cross-surface' }) } }]
      : []),
  ]

  return <ObjectOrbit
    open={open}
    onClose={onClose}
    anchorRef={anchorRef}
    ariaLabel={`「${displayNodeTitle(node)}」的动作`}
    actions={actions}
  />
}

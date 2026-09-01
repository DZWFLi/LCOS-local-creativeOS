import { Crosshair, Eye, GitBranch, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { CanvasNode } from '../../model'
import { displayNodeTitle } from '../canvas/CanvasNodeVisual'
import { ObjectOrbit, type ObjectOrbitAction } from './ObjectOrbit'
import { ColorPinAuthoringPopover } from '../spatial/ColorPinAuthoringPopover'
import { colorPinRecordsForTarget, colorPinTargetRef, useProjectColorPinRuntime } from '../spatial/ProjectColorPinContext'

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
 * has a real deeper destination and Locate is optional. Relation is emitted only
 * when the caller wires the canonical spatial relation intent owner. The legacy
 * binary Spatial Marker action is intentionally not presented as Color Pin; A25-7
 * wires the real many-to-many Color Pin authoring capability. Assembly / More remain absent until their real owners are
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
  const colorPins = useProjectColorPinRuntime()
  const [pinAuthoringOpen, setPinAuthoringOpen] = useState(false)
  useEffect(() => { if (!open) setPinAuthoringOpen(false) }, [open])
  const colorPinTarget = colorPins ? colorPinTargetRef(colorPins.projectId, node.id) : null
  const assignedPins = colorPins && colorPinTarget ? colorPinRecordsForTarget(colorPins.records, colorPinTarget) : []
  const closeAll = () => { setPinAuthoringOpen(false); onClose() }

  const actions: ObjectOrbitAction[] = [
    ...(onOpen && projectObjectCanOpen(node)
      ? [{ id: 'object-open', label: '打开', icon: Eye, primary: true, onClick: onOpen } satisfies ObjectOrbitAction]
      : []),
    ...(onRelation ? [{ id: 'object-relation', label: '关系', icon: GitBranch, onClick: onRelation } satisfies ObjectOrbitAction] : []),
    ...(colorPins && colorPinTarget ? [{ id: 'object-color-pin', label: assignedPins.length > 0 ? `Pin · ${assignedPins.length}` : 'Pin', icon: MapPin, keepOpen: true, onClick: () => setPinAuthoringOpen((current) => !current) } satisfies ObjectOrbitAction] : []),
    ...(onLocate ? [{ id: 'object-locate', label: '在哪', icon: Crosshair, onClick: onLocate } satisfies ObjectOrbitAction] : []),
  ]

  return <>
  <ObjectOrbit
    open={open}
    onClose={closeAll}
    anchorRef={anchorRef}
    ariaLabel={`「${displayNodeTitle(node)}」的动作`}
    actions={actions}
  />
  {colorPinTarget ? <ColorPinAuthoringPopover open={pinAuthoringOpen} targetRef={colorPinTarget} anchorRef={anchorRef} onClose={() => setPinAuthoringOpen(false)} /> : null}
  </>
}

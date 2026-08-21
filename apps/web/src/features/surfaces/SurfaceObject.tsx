import type { PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical } from 'lucide-react'
import type { CanvasNode, NodeDisplayMode } from '../../model'
import { CanvasNodeVisual, detectFileIdentity, displayNodeTitle } from '../canvas/CanvasNodeVisual'
import { beginSemanticDrop } from '../spatial/semanticDrop'
import { LcosSignalGlyph, type LcosSignalState } from '../design/DotGlyph'
import { ArchiveGlyph, AudioGlyph, BenchGlyph, CollectionGlyph, ContextGlyph, DocumentGlyph, ImageGlyph, LinkGlyph, NoteGlyph, RunGlyph, SessionGlyph, VideoGlyph, WorkflowGlyph, WorkGlyph } from '../design/LcosGlyphs'
import { nodeRole } from './surfaceModel'
import type { SurfaceAttentionBucket } from './surfaceContracts'

export function SurfaceIdentityGlyph({ node }: { node: CanvasNode }) {
  if (node.entityKind === 'collection') return <CollectionGlyph/>
  if (node.entityKind === 'context' || node.kind === 'context') return <ContextGlyph/>
  if (node.entityKind === 'workflow') return <WorkflowGlyph/>
  if (node.entityKind === 'workspace') return <BenchGlyph/>
  const role = nodeRole(node)
  if (role === 'run') return <RunGlyph/>
  if (role === 'session') return <SessionGlyph/>
  if (role === 'skill') return <WorkGlyph/>
  if (node.kind === 'note') return <NoteGlyph/>
  const file = detectFileIdentity(node)
  if (file === 'image') return <ImageGlyph/>
  if (file === 'video') return <VideoGlyph/>
  if (file === 'audio') return <AudioGlyph/>
  if (file === 'link') return <LinkGlyph/>
  if (file === 'archive') return <ArchiveGlyph/>
  return <DocumentGlyph/>
}

interface Props {
  node: CanvasNode
  selected: boolean
  compact?: boolean
  /** Tiny relationship maps can still request a pure signal, but normal surfaces must reuse the material face. */
  glyph?: boolean
  dim?: boolean
  attentionBucket?: SurfaceAttentionBucket
  /** Surface-specific usage line. Identity/title/material stay canonical. */
  usageHint?: string
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
  dropIds?: readonly string[]
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
}

export function SurfaceObject({
  node,
  selected,
  compact = false,
  glyph = false,
  dim = false,
  attentionBucket,
  usageHint,
  onSelect,
  onDoubleClick,
  dropIds,
  onDirectProjectViewDrop,
}: Props) {
  const role = nodeRole(node)
  const signalState: LcosSignalState = node.error || node.runtimeState === 'failed'
    ? 'failed'
    : node.draft
      ? 'pending'
      : node.runStatus === 'running'
        ? 'working'
        : selected
          ? 'focus'
          : 'stable'
  const semanticDropIds = dropIds?.length ? dropIds : [node.id]
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    beginSemanticDrop(event, semanticDropIds, onDirectProjectViewDrop)
  }

  if (glyph) {
    return <button
      type="button"
      data-surface-role={role}
      data-attention={attentionBucket}
      className={`lcos-surface-glyph role-${role} ${selected ? 'selected' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${dim ? 'dim' : ''}`}
      aria-label={displayNodeTitle(node)}
      onPointerDown={onPointerDown}
      onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
      <span className="lcos-surface-identity-glyph" aria-hidden="true"><SurfaceIdentityGlyph node={node}/></span>
      <span className="lcos-glyph-label">{displayNodeTitle(node)}</span>
    </button>
  }

  const density: NodeDisplayMode = compact ? 'compact' : (node.displayMode ?? 'standard')
  return <button
    type="button"
    data-surface-role={role}
    data-attention={attentionBucket}
    className={`lcos-surface-object lcos-surface-material role-${role} ${selected ? 'selected' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${compact ? 'compact' : ''} ${dim ? 'dim' : ''}`}
    aria-label={displayNodeTitle(node)}
    onPointerDown={onPointerDown}
    onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
    onDoubleClick={() => onDoubleClick(node.id)}
  >
    <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
    <CanvasNodeVisual
      node={node}
      density={density}
      runId=""
      runStatus={node.runStatus ?? null}
      pending={Boolean(node.draft)}
      onDetails={() => onDoubleClick(node.id)}
      showDetails={false}
      showControls={false}
    />
    {usageHint && <span className="lcos-surface-usage-hint">{usageHint}</span>}
    <span className="lcos-surface-system-signal" aria-hidden="true"><LcosSignalGlyph state={signalState}/></span>
  </button>
}

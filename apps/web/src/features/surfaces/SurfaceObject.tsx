import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical } from 'lucide-react'
import type { CanvasNode, NodeDisplayMode } from '../../model'
import { CanvasNodeVisual, detectFileIdentity, displayNodeTitle } from '../canvas/CanvasNodeVisual'
import { beginSemanticDrop } from '../spatial/semanticDrop'
import { additiveSelectionModifier } from '../spatial/pointerInteractionLanguage'
import { DropFeedbackLayer } from '../drop/dropFeedbackLayer'
import { useSemanticDropFeedback } from '../drop/useSemanticDropFeedback'
import { ArchiveGlyph, AudioGlyph, BenchGlyph, CollectionGlyph, ContextGlyph, DocumentGlyph, ImageGlyph, LinkGlyph, NoteGlyph, RunGlyph, SessionGlyph, VideoGlyph, WorkflowGlyph, WorkGlyph } from '../design/LcosGlyphs'
import { LcosSignalGlyph } from '../design/DotGlyph'
import { resolveSpatialSignal, type SpatialRuntimeSignal } from '../spatial/visual/spatialSignal'
import { nodeRole } from './surfaceModel'
import type { SurfaceAttentionBucket } from './surfaceContracts'
import { ProjectObjectOrbit } from '../ui/ProjectObjectOrbit'

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
  performanceProxy?: boolean
  /** Shared camera zoom so Conversation Glyth can use the same semantic LOD on spatial Surfaces. */
  zoom?: number
  /** Tiny relationship maps can still request a pure signal, but normal surfaces must reuse the material face. */
  glyph?: boolean
  dim?: boolean
  attentionBucket?: SurfaceAttentionBucket
  /** Surface-specific usage line. Identity/title/material stay canonical. */
  usageHint?: string
  /** Presentation-only Region hint. It never changes the underlying Entity. */
  spatialSemantic?: string
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
  /** Universal Object Orbit: optional project-level Focus/在哪 capability. */
  onLocate?: (id: string) => void
  /** Parent selection truth decides whether a single-object Orbit is admissible. */
  orbitEligible?: boolean
  /** A13: ordinary Project material can expose Relation from Object Orbit. */
  onRelation?: () => void
  /** A13 physical gesture state. Persistence stays owned by the parent Surface. */
  relationActive?: boolean
  relationEligible?: boolean
  relationSource?: boolean
  relationTarget?: boolean
  onRelationCommit?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  dropIds?: readonly string[]
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
}

export function SurfaceObject({
  node,
  selected,
  compact = false,
  performanceProxy = false,
  zoom = 1,
  glyph = false,
  dim = false,
  attentionBucket,
  usageHint,
  spatialSemantic,
  onSelect,
  onDoubleClick,
  onLocate,
  orbitEligible = true,
  onRelation,
  relationActive = false,
  relationEligible = false,
  relationSource = false,
  relationTarget = false,
  onRelationCommit,
  dropIds,
  onDirectProjectViewDrop,
}: Props) {
  const role = nodeRole(node)
  const runtimeSignal: SpatialRuntimeSignal = node.error || node.runtimeState === 'failed' || node.runStatus === 'failed'
    ? 'failed'
    : node.runStatus === 'running'
      ? 'processing'
      : 'idle'
  const signal = resolveSpatialSignal({
    selected,
    runtime: runtimeSignal,
    semantic: [spatialSemantic, node.draft ? 'draft' : ''].filter(Boolean).join(' · '),
  })
  const semanticDropIds = dropIds?.length ? dropIds : [node.id]
  const dropFeedback = useSemanticDropFeedback()
  const orbitAnchorRef = useRef<HTMLButtonElement | null>(null)
  const relationPointerConsumed = useRef(false)
  const [orbitOpen, setOrbitOpen] = useState(false)

  // Selection owns Orbit lifetime. An unselected object or a multi-selection
  // must never leave a detached single-object Orbit behind.
  useEffect(() => {
    if (!selected || !orbitEligible) setOrbitOpen(false)
  }, [orbitEligible, selected])

  const selectAndMaybeOpenOrbit = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (relationPointerConsumed.current) {
      relationPointerConsumed.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const additive = additiveSelectionModifier(event)
    onSelect(node.id, additive)
    if (node.entityKind === 'conversation' || additive) {
      setOrbitOpen(false)
      return
    }
    setOrbitOpen(true)
  }

  const openDeeper = () => {
    setOrbitOpen(false)
    onDoubleClick(node.id)
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (onRelationCommit) {
      relationPointerConsumed.current = true
      event.preventDefault()
      event.stopPropagation()
      onRelationCommit(event)
      return
    }
    // While the source intent is live, the material body must not accidentally
    // become a Semantic Drop source. The temporary Relation layer owns pointer intent.
    if (relationActive && relationSource) {
      relationPointerConsumed.current = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
    beginSemanticDrop(event, semanticDropIds, onDirectProjectViewDrop, dropFeedback.onPhase)
  }

  if (glyph) {
    return <>
      <button
        ref={orbitAnchorRef}
        type="button"
        data-node-id={node.id}
        data-project-relation-target={relationEligible ? node.id : undefined}
        data-surface-role={role}
        data-attention={attentionBucket}
        className={`lcos-surface-glyph role-${role} ${selected ? 'selected' : ''} ${relationSource ? 'is-relation-source' : ''} ${relationTarget ? 'is-relation-target' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${dim ? 'dim' : ''}`}
        aria-label={displayNodeTitle(node)}
        onPointerDown={onPointerDown}
        onClick={selectAndMaybeOpenOrbit}
        onDoubleClick={openDeeper}
      >
        <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
        <span className="lcos-surface-identity-glyph" aria-hidden="true"><SurfaceIdentityGlyph node={node}/></span>
        <span className="lcos-glyph-label">{displayNodeTitle(node)}</span>
      </button>
      {relationSource && <span data-testid={`relation-source-port-${node.id}`} className="lcos-relation-port lcos-surface-relation-port" style={{ '--canvas-zoom': String(zoom) } as CSSProperties} aria-hidden="true"><span/></span>}
      {node.entityKind !== 'conversation' && <ProjectObjectOrbit open={orbitOpen} node={node} anchorRef={orbitAnchorRef} onClose={() => setOrbitOpen(false)} onOpen={openDeeper} {...(onRelation ? { onRelation } : {})} {...(onLocate ? { onLocate: () => onLocate(node.id) } : {})}/>}
      <DropFeedbackLayer phase={dropFeedback.phase} hitElement={dropFeedback.hitElement} />
    </>
  }

  const density: NodeDisplayMode = compact ? 'compact' : (node.displayMode ?? 'standard')
  return <>
    <button
      ref={orbitAnchorRef}
      type="button"
      data-node-id={node.id}
      data-project-relation-target={relationEligible ? node.id : undefined}
      data-surface-role={role}
      data-attention={attentionBucket}
      className={`lcos-surface-object lcos-surface-material role-${role} ${selected ? 'selected' : ''} ${relationSource ? 'is-relation-source' : ''} ${relationTarget ? 'is-relation-target' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${compact ? 'compact' : ''} ${dim ? 'dim' : ''}`}
      aria-label={displayNodeTitle(node)}
      onPointerDown={onPointerDown}
      onClick={selectAndMaybeOpenOrbit}
      onDoubleClick={openDeeper}
    >
      <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
      {performanceProxy && node.entityKind !== 'conversation'
        ? <div className={`lcos-overview-node-proxy proxy-${detectFileIdentity(node)}`} aria-label={displayNodeTitle(node)}><span>{detectFileIdentity(node).toUpperCase()}</span><strong>{displayNodeTitle(node)}</strong></div>
        : <CanvasNodeVisual
            node={node}
            density={density}
            runId=""
            runStatus={node.runStatus ?? null}
            pending={Boolean(node.draft)}
            onDetails={() => onDoubleClick(node.id)}
            showDetails={false}
            showControls={false}
          />}
      {usageHint && <span className="lcos-surface-usage-hint">{usageHint}</span>}
      {(selected || signal.state !== 'stable') && <span className="lcos-surface-system-signal" data-spatial-signal={selected && signal.state === 'stable' ? 'focus' : signal.state} aria-hidden="true"><LcosSignalGlyph state={selected && signal.state === 'stable' ? 'focus' : signal.state}/></span>}
    </button>
    {relationSource && <span data-testid={`relation-source-port-${node.id}`} className="lcos-relation-port lcos-surface-relation-port" style={{ '--canvas-zoom': String(zoom) } as CSSProperties} aria-hidden="true"><span/></span>}
    {node.entityKind !== 'conversation' && <ProjectObjectOrbit open={orbitOpen} node={node} anchorRef={orbitAnchorRef} onClose={() => setOrbitOpen(false)} onOpen={openDeeper} {...(onRelation ? { onRelation } : {})} {...(onLocate ? { onLocate: () => onLocate(node.id) } : {})}/>}
    <DropFeedbackLayer phase={dropFeedback.phase} hitElement={dropFeedback.hitElement} />
  </>
}

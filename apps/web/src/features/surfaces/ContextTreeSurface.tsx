import { ChevronRight, MessageSquareText } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { buildHierarchySeed, toggleHierarchyCollapsed } from '../presentation/presentationHierarchy'
import { layoutMindMap, mindMapEdgePath } from '../presentation/mindMapLayout'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { usePresentationHierarchyState } from '../../state/presentationHierarchyState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { nodeTypeIcon } from '../canvas/CanvasNodeVisual'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  source?: { kind: string; label: string }
  runtime?: ContextSurfaceRuntime
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
}

const COLORS = ['#7862c8', '#4f83a3', '#bd766b', '#71906a', '#9a72a8', '#a58a52']
const WORLD_WIDTH = 1320
const WORLD_HEIGHT = 820

/** Mind Map is a spatial renderer of the exact same Presentation hierarchy edited in Outline. */
export function ContextTreeSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-tree', { x: 0, y: 0, zoom: 1 })
  const seed = useMemo(() => buildHierarchySeed(props.nodes, props.edges), [props.edges, props.nodes])
  const [state, setState] = usePresentationHierarchyState(props.projectId, props.scopeId, 'context-hierarchy', seed, props.nodes)
  const layout = useMemo(() => layoutMindMap(props.nodes, state, WORLD_WIDTH, WORLD_HEIGHT), [props.nodes, state])
  const byPlaced = useMemo(() => new Map(layout.placements.map((item) => [item.id, item])), [layout.placements])
  const toggle = (id: string) => setState((current) => toggleHierarchyCollapsed(current, id))

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return
    event.preventDefault()
    const current = layout.placements[index]
    if (!current) return
    const parent = current.parentId ? byPlaced.get(current.parentId) : null
    const child = layout.placements.find((item) => item.parentId === current.id)
    const sibling = layout.placements[Math.max(0, Math.min(layout.placements.length - 1, index + (key === 'ArrowUp' ? -1 : 1)))]
    const towardRoot = (current.side > 0 && key === 'ArrowLeft') || (current.side < 0 && key === 'ArrowRight')
    const awayFromRoot = (current.side > 0 && key === 'ArrowRight') || (current.side < 0 && key === 'ArrowLeft')
    const target = towardRoot ? parent : awayFromRoot ? child : sibling
    if (target) {
      props.onSelect(target.node.id)
      document.querySelector<HTMLButtonElement>(`[data-mind-topic="${CSS.escape(target.node.id)}"]`)?.focus()
    }
  }

  return <section className="lcos-dedicated-surface lcos-context-tree lcos-mind-map" data-testid="surface-context-tree">
    <header className="lcos-surface-heading">
      <div><strong>上下文</strong><span>思维导图</span></div>
      <small>{layout.placements.length} objects · 与大纲无损同构</small>
    </header>
    {props.source && <div className={`lcos-renderer-source source-${props.source.kind}`}><i/><span>{props.source.label}</span><small>Hierarchy v{state.version}</small></div>}
    <SpatialCanvas camera={camera} setCamera={setCamera} className="lcos-mind-map-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-mind-map-world" worldStyle={{width:layout.width,height:layout.height}} testId="context-tree-spatial">
      <SpatialEdgeLayer bounds={{ x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }} className="lcos-mind-map-edges" ariaLabel="思维导图层级关系">
        {layout.placements.map((to) => {
          const from = to.parentId ? byPlaced.get(to.parentId) : layout.rootCenter
          if (!from) return null
          return <path key={`${to.parentId ?? 'context-root'}:${to.id}`} d={mindMapEdgePath(from, to)} style={{ '--branch-color': COLORS[to.branch % COLORS.length] } as CSSProperties}/>
        })}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        <div className="lcos-mind-map-root" style={{ left: layout.rootCenter.x, top: layout.rootCenter.y, width: layout.rootCenter.width, minHeight: layout.rootCenter.height }}>
          <MessageSquareText size={14}/><span><strong>当前 Context</strong><small>{props.nodes.length} 个对象 · Presentation</small></span>
        </div>
        {layout.placements.map((item, index) => {
          const Icon = nodeTypeIcon(item.node)
          const color = COLORS[item.branch % COLORS.length]
          const collapsed = state.collapsedIds.includes(item.node.id)
          return <div key={item.node.id} className={`lcos-mind-topic-wrap depth-${Math.min(3, item.depth + 1)} side-${item.side > 0 ? 'right' : 'left'}`} style={{ left: item.x, top: item.y, width: item.width, '--branch-color': color, '--i': index } as CSSProperties}>
            <button type="button" data-mind-topic={item.node.id} className={`lcos-mind-topic ${props.selectedIds.includes(item.node.id) ? 'selected' : ''}`} onClick={(event) => props.onSelect(item.node.id, event.shiftKey || event.metaKey || event.ctrlKey)} onDoubleClick={() => props.onDoubleClick(item.node.id)} onKeyDown={(event) => navigate(event, index)}>
              <Icon/><span><strong>{item.node.title}</strong>{item.node.subtitle && <small>{item.node.subtitle}</small>}</span>
            </button>
            {item.hasChildren && <div className="lcos-mind-topic-tools"><button type="button" aria-label={collapsed ? '展开分支' : '折叠分支'} onClick={() => toggle(item.node.id)}><ChevronRight size={11} className={collapsed ? '' : 'expanded'}/></button></div>}
            <span className="lcos-surface-hover-card lcos-mind-hover-card" aria-hidden="true"><strong>{item.node.title}</strong><small>{item.node.subtitle || item.node.previewText || '双击进入对象详情'}</small><em>{item.node.observedPath || item.node.sourceProvider || 'Context object'}</em></span>
          </div>
        })}
      </SpatialNodeLayer>
    </SpatialCanvas>
    {props.runtime && <ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { GitBranch, History, Layers3, Maximize2, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { CanvasEdge } from '../../../model'
import type { PresentationHierarchyState } from '../../presentation/presentationHierarchy'
import { layoutMindMap, mindMapEdgePath, type MindMapLayout } from '../../presentation/mindMapLayout'
import { relativeTime } from '../../shell/relativeTime'
import type { ContextHistoryEntry } from '../../surfaces/surfaceContracts'
import type { SurfaceBinding } from '../model/surfaceElementTypes'
import { LcosSignalGlyph } from '../../design/DotGlyph'
import { LightSegment } from '../visual/LightSegment'
import { SurfaceComponentImmersive } from './SurfaceComponentImmersive'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

/** 关系 kind 的中文语义标签：CanvasEdge 契约固定五种，如实映射、不虚构语义 */
const EDGE_KIND_LABELS: Record<CanvasEdge['kind'], string> = {
  reference: '引用',
  generate: '生成',
  modify: '修改',
  feedback: '反馈',
  hierarchy: '层级',
}

/** 未绑定时的统一空态指引：不假装有内容，只给可行动路径 */
const UNBOUND_HINT = '暂无绑定对象——在画布选中对象后拖入此组件即可绑定'

/** 各卡默认可见条数（保持原有默认密度），超出部分由 ExpandToggle 提供展开出口；结构卡已改为卡内导图全量直绘，不再需要条数上限；演进卡已改为时间轴标记点 */
const RELATIONSHIP_ROW_LIMIT = 10
const PACK_ITEM_LIMIT = 9

/** 演进时间轴标记点上限：条目过多时按时间序均匀抽样（保留首尾），footer 仍如实显示总数 */
const EVOLUTION_MARK_LIMIT = 24

/** binding 语义分组：projectViewId(s) 是视图成员，可进入卡内成员列表；
 *  其余键（runId/checkpointId 等）只计为「其他绑定来源」，不混进成员渲染。 */
function bindingGroups(element: SurfaceComponentRenderProps['element']) {
  const binding: SurfaceBinding = element.binding ?? {}
  const viewIds = [...new Set([
    ...(typeof binding.projectViewId === 'string' && binding.projectViewId ? [binding.projectViewId] : []),
    ...(Array.isArray(binding.projectViewIds) ? binding.projectViewIds.filter((id) => typeof id === 'string' && id.length > 0) : []),
  ])]
  const otherIds = [...new Set((Object.keys(binding) as (keyof SurfaceBinding)[])
    .filter((key) => key !== 'projectViewId' && key !== 'projectViewIds')
    .flatMap((key) => {
      const value = binding[key]
      if (typeof value === 'string' && value.length) return [value]
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      return []
    }))]
  return { viewIds, otherIds }
}

/** footer 如实标注绑定来源数：视图成员与其他来源分开计数，不混算 */
function sourceNote(viewIds: readonly string[], otherIds: readonly string[]) {
  const parts = [`${viewIds.length} 个视图引用`]
  if (otherIds.length) parts.push(`${otherIds.length} 项其他绑定`)
  return parts.join(' · ')
}

/** 绑定范围内的节点：只按视图成员过滤；未绑定时返回空列表，不回退到全量节点冒充内容 */
function scopedNodes(viewIds: readonly string[], context: SurfaceComponentRenderProps['context']) {
  const nodes = context?.nodes ?? []
  return viewIds.length ? nodes.filter((node) => viewIds.includes(node.id)) : []
}

/** 演进时间：复用 shell 的四档相对时间；解析失败时原样展示，不伪造精度。完整时间由调用方放进 title */
function evolutionTime(createdAt: string, now: number) {
  const ts = Date.parse(createdAt)
  return Number.isNaN(ts) ? createdAt : relativeTime(ts, now)
}

function Header({ icon, title, hint, selected, onMaximize }: { icon: ReactNode; title: string; hint: string; selected?: boolean; onMaximize?: () => void }) {
  return <header className="lcos-context-component-header">
    <span className="lcos-context-component-icon">{icon}</span>
    <span><strong>{title}</strong><small>{hint}</small></span>
    <LightSegment axis="horizontal" length={20} active={selected}/>{selected && <LcosSignalGlyph state="focus"/>}
    {/* G-1 最大化入口：与控制钮同款 20×20 方钮（.lcos-context-maximize）；button 已在 SurfaceFrame 的 INTERACTIVE_SELECTOR 内，不会被拖拽劫持 */}
    {onMaximize ? <button type="button" className="lcos-context-maximize" onClick={(event) => { event.stopPropagation(); onMaximize() }} aria-label={`最大化查看${title}`} title={`最大化查看${title}`}><Maximize2 size={11}/></button> : null}
  </header>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="lcos-context-component-empty">{children}</div>
}

/** 「+N 项」展开/收起：超限成员不再静默消失，点击展开完整列表（卡内 overflow 滚动查看） */
function ExpandToggle({ overflow, expanded, onToggle }: { overflow: number; expanded: boolean; onToggle: () => void }) {
  return <button type="button" className="lcos-context-expand" onClick={onToggle}>
    {expanded ? '收起' : `+${overflow} 项`}
  </button>
}

/** 与整页导图（ContextTreeSurface）同源的分支色环：卡内导图沿用同一视觉词汇，不另造颜色 */
const MINDMAP_BRANCH_COLORS = ['#7862c8', '#4f83a3', '#bd766b', '#71906a', '#9a72a8', '#a58a52']

/** 卡内导图自适应缩放：取 placements（含中心根）的实际外接框，把整张导图 fit 进卡内容区，
 *  四周保留 8px 边距；内容小于容器时不放大（scale 上限 1）、按边距原点居中摆放。
 *  返回值直接写进舞台的 translate+scale（transformOrigin 固定 0 0），容器尺寸由 ResizeObserver 实测传入。 */
function fitMindMapScale(layout: MindMapLayout, containerW: number, containerH: number) {
  if (!layout.placements.length || containerW <= 0 || containerH <= 0) return { scale: 1, offsetX: 0, offsetY: 0 }
  let minX = layout.rootCenter.x
  let minY = layout.rootCenter.y
  let maxX = layout.rootCenter.x + layout.rootCenter.width
  let maxY = layout.rootCenter.y + layout.rootCenter.height
  for (const item of layout.placements) {
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }
  const margin = 8
  // 极限小卡也保留 0.02 的最小缩放，避免除出负/零比例
  const scale = Math.max(0.02, Math.min(1, (containerW - margin * 2) / (maxX - minX), (containerH - margin * 2) / (maxY - minY)))
  // 先按缩放后的内容尺寸在边距区内居中，再补回 bounds 左上角相对坐标系的偏移
  const offsetX = margin + Math.max(0, (containerW - margin * 2 - (maxX - minX) * scale) / 2) - minX * scale
  const offsetY = margin + Math.max(0, (containerH - margin * 2 - (maxY - minY) * scale) / 2) - minY * scale
  return { scale, offsetX, offsetY }
}

/** 沉浸版结构导图的固定大画布（G-1 施工方案给定）：布局与 fit 都按此尺寸计算，
 *  与卡内实测尺寸版互不干扰——卡内保持现状，最大化才用大画布。 */
const STRUCTURE_IMMERSIVE_STAGE = { width: 1320, height: 820 }

export function StructureMapComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const { viewIds, otherIds } = bindingGroups(props.element)
  const nodes = scopedNodes(viewIds, context)
  const [maximized, setMaximized] = useState(false)
  // 层级数据：context.hierarchy 缺失、或其 orderIds 与绑定成员完全不交（无 roots 可画）时，
  // 退化为平铺单层（全部 depth 0 并排，首个 placement 即根），保证导图总能成图、不报错；
  // collapse 沿用 context.hierarchy.collapsedIds，由 layoutMindMap 内部消化（visibleHierarchyRows）。
  const hierarchy = useMemo<PresentationHierarchyState>(() => {
    const state = context?.hierarchy
    if (state && nodes.some((node) => state.orderIds.includes(node.id))) return state
    return { orderIds: nodes.map((node) => node.id), depthById: {}, collapsedIds: [], version: 0 }
  }, [context?.hierarchy, nodes])
  // 卡内容区尺寸用 ResizeObserver 实测（卡宽随外层布局变化，不做固定值假设）
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const hasMap = nodes.length > 0
  useEffect(() => {
    // 容器只在有成图时挂载（空态走 Empty），hasMap 翻真后重装观察器
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setBox((current) => (current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMap])
  // 导图画布优先用容器实测尺寸，但保底 640×400：layoutMindMap 的横向间距（根间隙 128 + 每层 224）
  // 按整页尺度设计，画布过窄节点会大量重叠；实际溢出交给 fitMindMapScale 兜底缩放
  const layout = useMemo(() => layoutMindMap(nodes, hierarchy, Math.max(640, box.width), Math.max(400, box.height)), [nodes, hierarchy, box.width, box.height])
  const fit = useMemo(() => fitMindMapScale(layout, box.width, box.height), [layout, box.width, box.height])
  // 沉浸版布局：同一份节点/层级按 1320×820 大画布重排，fit 也按大画布——完整查看、无硬截断
  const fullLayout = useMemo(() => layoutMindMap(nodes, hierarchy, STRUCTURE_IMMERSIVE_STAGE.width, STRUCTURE_IMMERSIVE_STAGE.height), [nodes, hierarchy])
  const fullFit = useMemo(() => fitMindMapScale(fullLayout, STRUCTURE_IMMERSIVE_STAGE.width, STRUCTURE_IMMERSIVE_STAGE.height), [fullLayout])
  /** 导图舞台纯渲染：卡内与沉浸版共用（同一 JSX；卡内传 ref 实测容器，沉浸传固定尺寸 style） */
  const renderStage = (stageLayout: MindMapLayout, stageFit: { scale: number; offsetX: number; offsetY: number }, options?: { ref?: RefObject<HTMLDivElement | null>; style?: CSSProperties }) => {
    const placedById = new Map(stageLayout.placements.map((item) => [item.id, item]))
    return <div ref={options?.ref} className="lcos-context-mindmap" style={options?.style}>
      <div className="lcos-context-mindmap-stage" style={{ width: stageLayout.width, height: stageLayout.height, transform: `translate(${stageFit.offsetX}px, ${stageFit.offsetY}px) scale(${stageFit.scale})` }}>
        <svg className="lcos-mind-map-edges" viewBox={`0 0 ${stageLayout.width} ${stageLayout.height}`} aria-hidden="true">
          {stageLayout.placements.map((to) => {
            // depth-0 节点的连线从中心根出发，其余从父 placement 出发（同 ContextTreeSurface）
            const from = to.parentId ? placedById.get(to.parentId) : stageLayout.rootCenter
            if (!from) return null
            return <path key={`${to.parentId ?? 'root'}:${to.id}`} d={mindMapEdgePath(from, to)}/>
          })}
        </svg>
        <div className="lcos-mind-map-root lcos-context-mindmap-root" style={{ left: stageLayout.rootCenter.x, top: stageLayout.rootCenter.y, width: stageLayout.rootCenter.width, minHeight: stageLayout.rootCenter.height }}>
          <span><strong>当前结构</strong><small>{stageLayout.placements.length} 个对象</small></span>
        </div>
        {stageLayout.placements.map((item, index) => (
          <div key={item.id} className={`lcos-mind-topic-wrap side-${item.side > 0 ? 'right' : 'left'}`} style={{ left: item.x, top: item.y, width: item.width, '--branch-color': MINDMAP_BRANCH_COLORS[item.branch % MINDMAP_BRANCH_COLORS.length], '--i': index } as CSSProperties}>
            <button type="button" className="lcos-mind-topic" title={item.node.title} onClick={() => context?.onSelectNode?.(item.id)} onDoubleClick={() => context?.onOpenNode?.(item.id)}>
              <span><strong>{item.node.title}</strong></span>
            </button>
          </div>
        ))}
      </div>
    </div>
  }
  return <div className={`lcos-context-component lcos-context-structure ${selected ? 'is-selected' : ''}`} data-context-component="structure-map">
    <Header icon={<Layers3 size={15}/>} title="结构" hint="当前材料的阅读层级，不改写项目真相" selected={selected} onMaximize={() => setMaximized(true)}/>
    {layout.placements.length ? renderStage(layout, fit, { ref: containerRef }) : <Empty>{viewIds.length ? '绑定引用未出现在当前画布，无法生成阅读结构' : UNBOUND_HINT}</Empty>}
    <footer><span>{layout.placements.length ? `${layout.placements.length} 个对象 · ${sourceNote(viewIds, otherIds)}` : (viewIds.length ? '绑定引用未出现在当前画布' : '未绑定——拖入画布对象后生成')}</span></footer>
    {/* G-1 最大化：沉浸版导图（大画布 1320×820），关闭只卸载浮层、画布 state 不变 */}
    <SurfaceComponentImmersive open={maximized} title="结构" hint="当前材料的阅读层级，不改写项目真相" onClose={() => setMaximized(false)}>
      <div style={{ width: '100%', height: '100%', display: 'grid', overflow: 'auto' }}>
        <div style={{ margin: 'auto', width: STRUCTURE_IMMERSIVE_STAGE.width, height: STRUCTURE_IMMERSIVE_STAGE.height }}>
          {fullLayout.placements.length ? renderStage(fullLayout, fullFit, { style: { width: '100%', height: '100%' } }) : <Empty>{viewIds.length ? '绑定引用未出现在当前画布，无法生成阅读结构' : UNBOUND_HINT}</Empty>}
        </div>
      </div>
    </SurfaceComponentImmersive>
  </div>
}

/** 演进时间轴主体（G-1 抽出）：卡内与沉浸最大化各渲染一份、hover/带宽测量各自独立，
 *  渲染逻辑同一份——沉浸版容器更宽，时间轴自然拉满宽、标记点分布更从容。 */
function EvolutionTimelineBody({ history, context }: { history: readonly ContextHistoryEntry[]; context: SurfaceComponentRenderProps['context'] }) {
  // 悬停状态：entryId 命中标记点（半径吸附）时弹预览卡，否则视为空带只给时间提示；pointerX 为带内像素位，-1 表示光标不在带内
  const [hover, setHover] = useState<{ entryId: string | null; pointerX: number }>({ entryId: null, pointerX: -1 })
  // 带宽仅在指针事件中测量（卡的水平夹回需要像素值），无悬停时不渲染弹出层，无需初始测量
  const [bandWidth, setBandWidth] = useState(0)
  const bandRef = useRef<HTMLDivElement | null>(null)
  const now = Date.now()
  // 时间升序；无 createdAt 的稳定排最后（保持原有相对顺序）
  const sorted = [...history].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : NaN
    const tb = b.createdAt ? Date.parse(b.createdAt) : NaN
    if (Number.isNaN(ta)) return Number.isNaN(tb) ? 0 : 1
    return Number.isNaN(tb) ? -1 : ta - tb
  })
  // 超上限时按索引等距抽样（含首尾），保留时间带整体形状
  const marks = sorted.length > EVOLUTION_MARK_LIMIT
    ? Array.from({ length: EVOLUTION_MARK_LIMIT }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (EVOLUTION_MARK_LIMIT - 1))])
    : sorted
  // 布局：时间在 [最早, 最晚] 区间线性分布；单条居中；时间全同或全缺时按索引等距铺开
  const times = marks.map((entry) => (entry.createdAt ? Date.parse(entry.createdAt) : NaN))
  const validTimes = times.filter((ts) => Number.isFinite(ts))
  const minTs = validTimes.length ? Math.min(...validTimes) : 0
  const maxTs = validTimes.length ? Math.max(...validTimes) : 0
  const span = maxTs - minTs
  const step = Math.min(0.09, marks.length > 1 ? 1 / (marks.length - 1) : 1)
  const baseRatios = marks.map((_, index) => {
    if (marks.length === 1) return 0.5
    if (!validTimes.length || span === 0) return index / (marks.length - 1)
    // 无时间条目已排在末尾，先聚合在带尾，再由下面的分组铺开防重叠
    return Number.isFinite(times[index]) ? (times[index] - minTs) / span : 1
  })
  // 同比例（时间相同 / 无时间聚尾）的条目按索引在组内等距铺开，组整体夹回带内，避免标记点重叠
  const ratios: number[] = []
  for (let i = 0; i < baseRatios.length;) {
    let j = i
    while (j + 1 < baseRatios.length && Math.abs(baseRatios[j + 1] - baseRatios[i]) < 1e-6) j += 1
    const groupSize = j - i + 1
    const half = ((groupSize - 1) / 2) * step
    const center = Math.min(Math.max(baseRatios[i], half), 1 - half)
    for (let k = 0; k < groupSize; k++) ratios.push(Math.min(Math.max(center + (k - (groupSize - 1) / 2) * step, 0), 1))
    i = j + 1
  }
  const hoverIndex = hover.entryId ? marks.findIndex((entry) => entry.id === hover.entryId) : -1
  const hoverEntry = hoverIndex >= 0 ? marks[hoverIndex] : null
  // 预览卡水平定位：在标记点上方居中，左右溢出时夹回带内（卡宽 216px，半宽留 8px 边距）
  const cardHalf = 116
  const hoverRatio = hoverIndex >= 0 ? ratios[hoverIndex] : 0.5
  const cardLeft = bandWidth ? Math.min(Math.max(hoverRatio * bandWidth, cardHalf), Math.max(bandWidth - cardHalf, cardHalf)) : `${hoverRatio * 100}%`
  // 空带时间提示：有真实时间跨度时反解指针位置对应的时间点，否则退化为最近条目标题
  const hintLeft = bandWidth ? Math.min(Math.max(hover.pointerX, 44), Math.max(bandWidth - 44, 44)) : '50%'
  const hintHasTime = validTimes.length > 1 && span > 0
  let nearestIndex = 0
  for (let i = 1; i < marks.length; i++) {
    if (Math.abs(ratios[i] * (bandWidth || 1) - hover.pointerX) < Math.abs(ratios[nearestIndex] * (bandWidth || 1) - hover.pointerX)) nearestIndex = i
  }
  const hintRatio = bandWidth ? Math.min(Math.max(hover.pointerX / bandWidth, 0), 1) : 0.5
  const hintText = hintHasTime ? evolutionTime(new Date(minTs + hintRatio * span).toISOString(), now) : (marks[nearestIndex]?.title ?? '')
  return <div ref={bandRef} className="lcos-context-timeline"
    onPointerMove={(event) => {
      const band = bandRef.current
      if (!band) return
      const rect = band.getBoundingClientRect()
      const x = event.clientX - rect.left
      setBandWidth(rect.width)
      // 半径 24px 内吸附最近标记点；不在任何标记附近即空带，只保留时间提示
      let hitIndex = -1
      let hitDistance = 24
      for (let i = 0; i < ratios.length; i++) {
        const distance = Math.abs(ratios[i] * rect.width - x)
        if (distance <= hitDistance) { hitDistance = distance; hitIndex = i }
      }
      setHover({ entryId: hitIndex >= 0 ? marks[hitIndex].id : null, pointerX: x })
    }}
    onPointerLeave={() => setHover({ entryId: null, pointerX: -1 })}>
    <i className="lcos-context-timeline-base" aria-hidden="true"/>
    {marks.map((entry, index) => <button key={entry.id} type="button" className={`lcos-context-timeline-node ${entry.current ? 'is-current' : ''}`} style={{ left: `${ratios[index] * 100}%` }} aria-label={entry.title} onClick={() => context?.onOpenHistorySource?.(entry)}/>)}
    <AnimatePresence>
      {hoverEntry ? <motion.div key={`card-${hoverEntry.id}`} className="lcos-context-timeline-card" style={{ left: cardLeft }}
        initial={{ y: 6, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}>
        <strong>{hoverEntry.title}</strong>
        <small>{hoverEntry.summary || hoverEntry.label}</small>
        <span className="lcos-context-timeline-meta">
          {hoverEntry.createdAt && <time title={hoverEntry.createdAt}>{evolutionTime(hoverEntry.createdAt, now)}</time>}
          <em>{hoverEntry.objectIds.length} 个对象</em>
        </span>
      </motion.div>
        : hover.pointerX >= 0 ? <motion.span key="timeline-hint" className="lcos-context-timeline-hint" style={{ left: hintLeft }}
          initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}>
          {hintText}
        </motion.span> : null}
    </AnimatePresence>
  </div>
}

export function EvolutionComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const { viewIds, otherIds } = bindingGroups(props.element)
  // 演进 = 该 Context 的快照历史(Context 级,语义同 Codex turn rail 的会话级导览):
  // Core 快照本身不携带对象级关联(objectIds 恒空),按绑定过滤会把真实历史滤光(2R 实测修)。
  // 绑定关系仍进 footer 计数;历史条目原样呈现,不做对象级裁剪。
  const history = context?.history ?? []
  const [maximized, setMaximized] = useState(false)
  return <div className={`lcos-context-component lcos-context-evolution ${selected ? 'is-selected' : ''}`} data-context-component="evolution">
    <Header icon={<History size={15}/>} title="演进" hint="真实版本、变化与决策来源" selected={selected} onMaximize={() => setMaximized(true)}/>
    {history.length ? <EvolutionTimelineBody history={history} context={context}/> : <Empty>该 Context 暂无快照——保存 Context 或建立现场后会出现在这里</Empty>}
    <footer><span>{history.length ? `${history.length} 条演进 · ${sourceNote(viewIds, otherIds)}` : '暂无快照——演进随 Context 保存自动记录'}</span></footer>
    {/* G-1 最大化：沉浸版时间轴拉满宽（同一渲染逻辑、独立 hover 状态），关闭回原位 */}
    <SurfaceComponentImmersive open={maximized} title="演进" hint="真实版本、变化与决策来源" onClose={() => setMaximized(false)}>
      <div style={{ width: '100%', padding: '26px 30px', boxSizing: 'border-box' }}>
        {history.length ? <EvolutionTimelineBody history={history} context={context}/> : <Empty>该 Context 暂无快照——保存 Context 或建立现场后会出现在这里</Empty>}
      </div>
    </SurfaceComponentImmersive>
  </div>
}

export function RelationshipFieldComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const { viewIds, otherIds } = bindingGroups(props.element)
  const [expanded, setExpanded] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const nodes = scopedNodes(viewIds, context)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = (context?.edges ?? []).filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  const overflow = edges.length - RELATIONSHIP_ROW_LIMIT
  /** 关系列表渲染：fullscreen=true（沉浸）全量不截断、无展开钮；卡内维持现状条数上限 + ExpandToggle */
  const renderBody = (fullscreen: boolean) => {
    const visibleEdges = fullscreen || expanded ? edges : edges.slice(0, RELATIONSHIP_ROW_LIMIT)
    return edges.length ? <div className="lcos-context-relationship-rows" style={fullscreen ? { width: '100%', height: '100%', maxWidth: 1080, padding: '20px 24px', boxSizing: 'border-box' } : undefined}>
      {visibleEdges.map((edge) => <div key={edge.id}>
        <button type="button" onClick={() => context?.onSelectNode?.(edge.from)}>{byId.get(edge.from)?.title}</button>
        <span>{edge.label || EDGE_KIND_LABELS[edge.kind] || edge.kind}{edge.label && <small>{EDGE_KIND_LABELS[edge.kind] || edge.kind}</small>}</span>
        <button type="button" onClick={() => context?.onSelectNode?.(edge.to)}>{byId.get(edge.to)?.title}</button>
      </div>)}
      {!fullscreen && overflow > 0 && <ExpandToggle overflow={overflow} expanded={expanded} onToggle={() => setExpanded((value) => !value)}/>}
    </div> : <Empty>{viewIds.length ? '绑定的对象之间暂无真实关系——在画布连接两个对象后如实呈现' : UNBOUND_HINT}</Empty>
  }
  return <div className={`lcos-context-component lcos-context-relationship ${selected ? 'is-selected' : ''}`} data-context-component="relationship-field">
    <Header icon={<GitBranch size={15}/>} title="关系" hint="当前材料之间的局部关联" selected={selected} onMaximize={() => setMaximized(true)}/>
    {renderBody(false)}
    <footer><span>{edges.length ? `${edges.length} 条真实关系 · ${sourceNote(viewIds, otherIds)}` : (viewIds.length ? '绑定对象之间暂无关系，不自动猜测因果' : '未绑定——拖入对象后呈现关系')}</span></footer>
    {/* G-1 最大化：沉浸版全量关系列表（无条数截断），关闭回原位 */}
    <SurfaceComponentImmersive open={maximized} title="关系" hint="当前材料之间的局部关联" onClose={() => setMaximized(false)}>
      {renderBody(true)}
    </SurfaceComponentImmersive>
  </div>
}

export function ContextPackComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const { viewIds, otherIds } = bindingGroups(props.element)
  const [expanded, setExpanded] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const nodes = scopedNodes(viewIds, context)
  const overflow = nodes.length - PACK_ITEM_LIMIT
  /** Pack 列表渲染：fullscreen=true（沉浸）全量不截断、列宽自适应铺满；卡内维持现状两列 + 条数上限 */
  const renderBody = (fullscreen: boolean) => {
    const visibleNodes = fullscreen || expanded ? nodes : nodes.slice(0, PACK_ITEM_LIMIT)
    return viewIds.length && nodes.length ? <div className="lcos-context-pack-items" style={fullscreen ? { width: '100%', height: '100%', padding: '20px 24px', boxSizing: 'border-box', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' } : undefined}>
      {visibleNodes.map((node) => <button key={node.id} type="button" onClick={() => context?.onSelectNode?.(node.id)} onDoubleClick={() => context?.onOpenNode?.(node.id)}><span>{node.title}</span><small>{node.subtitle || node.fileType || '项目对象'}</small></button>)}
      {!fullscreen && overflow > 0 && <ExpandToggle overflow={overflow} expanded={expanded} onToggle={() => setExpanded((value) => !value)}/>}
    </div> : <Empty>{viewIds.length ? '绑定的引用未出现在当前画布，无法打包阅读范围' : UNBOUND_HINT}</Empty>
  }
  return <div className={`lcos-context-component lcos-context-pack ${selected ? 'is-selected' : ''}`} data-context-component="context-pack">
    <Header icon={<Sparkles size={15}/>} title="Context Pack" hint="交给 Agent 的当前阅读范围" selected={selected} onMaximize={() => setMaximized(true)}/>
    {renderBody(false)}
    <footer><span>{viewIds.length ? `${sourceNote(viewIds, otherIds)} · 不复制 Project Truth` : '未绑定——拖入对象后再打包'}</span></footer>
    {/* G-1 最大化：沉浸版全量 Pack 列表（无条数截断），关闭回原位 */}
    <SurfaceComponentImmersive open={maximized} title="Context Pack" hint="交给 Agent 的当前阅读范围" onClose={() => setMaximized(false)}>
      {renderBody(true)}
    </SurfaceComponentImmersive>
  </div>
}

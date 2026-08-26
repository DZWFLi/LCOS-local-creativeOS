import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasNode } from '../../model'
import { extractOutlineBranchText, outlineHue, parseOutline, type OutlineNode } from './outlineTree'

/**
 * G-4 导图分支拖出的窗口事件：MindMapNoteVisual 松手时派发 {text, clientX, clientY}，
 * 当前挂载的画布（ProjectCanvas / ContextSpaceSurface）监听并换算成世界坐标建新文本节点。
 * 不走 HTML5 DnD——SVG 元素的 draggable 在 Chromium 里不可靠，且按下文字会被文本选择抢走手势；
 * 指针事件 + 原始坐标跟手与画布自身拖拽同一套纪律。
 */
export const LCOS_MINDMAP_BRANCH_EXTRACT_EVENT = 'lcos:mindmap-branch-extract'

/**
 * Mind-map rendering for a text node in `noteLayout === 'mindmap'` mode.
 * 经典思维导图布局（XMind paradigm）：根节点居中，一级分支左右分布，
 * 子树垂直堆叠、父节点居中于子节点跨度，水平贝塞尔连线。
 * 大纲文本是唯一数据源（markmap paradigm）；沉浸式编辑器复用同一布局。
 */

interface Props {
  readonly node: CanvasNode
  readonly density: 'compact' | 'standard' | 'expanded'
  readonly onEdit?: () => void
}

/** 拖出会话：按住分支 → 浮起幽灵 → 松手派发窗口事件（世界坐标由画布层换算）。 */
interface BranchDragSession {
  readonly pointerId: number
  readonly text: string
  readonly svg: SVGSVGElement | null
  moved: boolean
  ghost: HTMLDivElement | null
}

/** 显示宽度：CJK 全角 ≈ 1.0em，ASCII ≈ .58em。中文按 ASCII 估宽会重叠（排列纯乱的根因）。 */
export function textDisplayWidth(text: string, fontSize: number) {
  let width = 0
  for (const ch of text) width += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? fontSize : fontSize * .58
  return width
}

/** 按显示宽度截断，中英文一致不会溢出分支框。 */
export function ellipsizeByWidth(text: string, fontSize: number, maxWidth: number) {
  let width = 0
  for (const [index, ch] of [...text].entries()) {
    width += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? fontSize : fontSize * .58
    if (width > maxWidth - 14) return `${text.slice(0, Math.max(1, index))}…`
  }
  return text
}

export interface MindMapPlacement {
  readonly id: string
  readonly text: string
  readonly depth: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly side: -1 | 0 | 1
  readonly parentId: string | null
  readonly hue: number
  readonly hasChildren: boolean
}

export interface MindMapMetrics {
  readonly fontByDepth: readonly number[]
  readonly nodeH: readonly number[]
  readonly colGap: number
  readonly sibGap: number
  readonly maxText: number
}

/** 卡片内预览（小字）与沉浸式编辑器（大字）共用布局，只换尺寸档。 */
export const MINDMAP_PREVIEW: MindMapMetrics = { fontByDepth: [13, 11, 10, 9], nodeH: [30, 26, 24, 22], colGap: 44, sibGap: 8, maxText: 160 }
export const MINDMAP_IMMERSIVE: MindMapMetrics = { fontByDepth: [16, 13.5, 12, 11], nodeH: [36, 30, 26, 24], colGap: 60, sibGap: 10, maxText: 300 }

export const MINDMAP_ROOT_ID = '__root__'

/**
 * 经典思维导图布局：根居中、一级分支左右交替分布、子树自顶向下堆叠、
 * 父节点垂直居中于其子节点跨度中心。返回归一化（左上角 0,0）后的 placements。
 */
export function mindmapLayout(roots: readonly OutlineNode[], rootText: string, m: MindMapMetrics): {
  placements: readonly MindMapPlacement[]
  width: number
  height: number
} {
  const fontOf = (depth: number) => m.fontByDepth[Math.min(depth, 3)]!
  const nodeHOf = (depth: number) => m.nodeH[Math.min(depth, 3)]!
  const widthOf = (text: string, depth: number) => {
    const font = fontOf(depth)
    const shown = ellipsizeByWidth(text, font, m.maxText)
    return Math.max(nodeHOf(depth) + 10, textDisplayWidth(shown, font) + 18)
  }

  // 子树总高（叶子 = 行高；父 = max(自身行高, 子跨度)）。
  const heightOf = (node: OutlineNode, depth: number): number => {
    const own = nodeHOf(depth)
    if (!node.children.length) return own
    const childrenSpan = node.children.reduce((sum, child) => sum + heightOf(child, depth + 1), 0)
      + (node.children.length - 1) * m.sibGap
    return Math.max(own, childrenSpan)
  }

  const placements: MindMapPlacement[] = []
  const rootWidth = widthOf(rootText, 0)
  placements.push({
    id: MINDMAP_ROOT_ID, text: ellipsizeByWidth(rootText, fontOf(0), m.maxText), depth: 0,
    x: 0, y: 0, width: rootWidth, side: 0, parentId: null, hue: 262, hasChildren: roots.length > 0,
  })

  // 自顶向下放子树：top = 本子树顶边的（局部）y。
  const place = (node: OutlineNode, parentId: string, depth: number, side: 1 | -1, edge: number, top: number) => {
    const ownH = nodeHOf(depth)
    const width = widthOf(node.text, depth)
    const x = side > 0 ? edge : edge - width
    const childEdge = side > 0 ? x + width + m.colGap : x - m.colGap
    const total = heightOf(node, depth)
    if (!node.children.length) {
      placements.push({
        id: node.id, text: ellipsizeByWidth(node.text, fontOf(depth), m.maxText), depth,
        x, y: top + (total - ownH) / 2, width, side, parentId, hue: outlineHue(node), hasChildren: false,
      })
      return
    }
    const childrenSpan = node.children.reduce((sum, child) => sum + heightOf(child, depth + 1), 0)
      + (node.children.length - 1) * m.sibGap
    let cursor = top + (total - childrenSpan) / 2
    const mids: number[] = []
    node.children.forEach((child) => {
      const childH = heightOf(child, depth + 1)
      place(child, node.id, depth + 1, side, childEdge, cursor)
      mids.push(cursor + childH / 2)
      cursor += childH + m.sibGap
    })
    placements.push({
      id: node.id, text: ellipsizeByWidth(node.text, fontOf(depth), m.maxText), depth,
      x, y: (mids[0]! + mids[mids.length - 1]!) / 2 - ownH / 2, width, side, parentId,
      hue: outlineHue(node), hasChildren: true,
    })
  }

  // 一级分支左右分布（幕布式规整）：第一支上右侧，之后每支去总高较轻的一侧，
  // 两侧高度尽量均衡；分支对称轴 = 根的垂直中心（旧实现用根顶边 y=0，
  // 根整颗挂在分支轴心下方 —— 导图"歪掉"的根因）。
  const sides: Array<{ dir: 1 | -1; items: OutlineNode[] }> = [
    { dir: 1, items: [] },
    { dir: -1, items: [] },
  ]
  const sideHeight = [0, 0]
  roots.forEach((child, index) => {
    const target = index === 0 ? 0 : (sideHeight[0]! <= sideHeight[1]! ? 0 : 1)
    sides[target]!.items.push(child)
    sideHeight[target] = sideHeight[target]! + heightOf(child, 1) + m.sibGap
  })
  const rootCenterY = m.nodeH[0]! / 2
  sides.forEach(({ dir, items }) => {
    if (!items.length) return
    const total = items.reduce((sum, child) => sum + heightOf(child, 1), 0) + (items.length - 1) * m.sibGap
    let cursor = rootCenterY - total / 2
    // 根矩形实际占据 [0, rootWidth]：分支从根的左右边外退 colGap 起步
    // （旧计算按"根以原点为中心"，右侧分支往根框里叠了 rootWidth/2-colGap）。
    const edge = dir > 0 ? rootWidth + m.colGap : -m.colGap
    items.forEach((child) => {
      place(child, MINDMAP_ROOT_ID, 1, dir, edge, cursor)
      cursor += heightOf(child, 1) + m.sibGap
    })
  })

  // 归一化到 (0,0) 起。
  const minX = Math.min(...placements.map((p) => p.x))
  const minY = Math.min(...placements.map((p) => p.y))
  const shifted = placements.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }))
  const width = Math.max(...shifted.map((p) => p.x + p.width))
  const height = Math.max(...shifted.map((p) => p.y + m.nodeH[Math.min(p.depth, 3)]!))
  return { placements: shifted, width, height }
}

/**
 * Natural mind-map content size (the SVG viewBox) for an outline text.
 * Used by the layout toggle to grow the node to the map's real size and to
 * fit the camera so the whole map is visible (mubu behaviour).
 */
export function mindmapContentSize(outline: string, title = '大纲'): { width: number; height: number } {
  const roots = parseOutline(outline)
  if (!roots.length && !title.trim()) return { width: 240, height: 120 }
  const { width, height } = mindmapLayout(roots, title, MINDMAP_PREVIEW)
  return { width: Math.max(240, width), height: Math.max(120, height) }
}

/** Node size policy for a mind-map note: grow to the map's natural size,
 *  clamped so a huge outline scrolls inside the card instead of blanketing the canvas. */
export function mindmapNodeSize(outline: string, title = '大纲'): { width: number; height: number } {
  const { width, height } = mindmapContentSize(outline, title)
  return {
    width: Math.round(Math.max(244, Math.min(980, width + 28))),
    height: Math.round(Math.max(140, Math.min(482, height + 62))),
  }
}

/** 折叠 = 保留节点本身、剪掉其整棵子孙（点折叠"折没了"的 bug 就是旧实现把节点自己也删了）。 */
function pruneCollapsed(nodes: readonly OutlineNode[], collapsed: ReadonlySet<string>): OutlineNode[] {
  return nodes.map((node) => collapsed.has(node.id)
    ? { ...node, children: [] }
    : { ...node, children: pruneCollapsed(node.children, collapsed) })
}

export function MindMapNoteVisual({ node }: Props) {
  // markdown 投影正文可能只在 previewText —— 与 toggleNoteLayout 同一回退链。
  const outline = node.noteOutline || node.noteBody || node.previewText || ''
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const branchDragRef = useRef<BranchDragSession | null>(null)
  const suppressClickRef = useRef(false)
  const roots = useMemo(() => parseOutline(outline), [outline])
  const visibleRoots = useMemo(() => {
    if (!collapsed.size) return roots
    if (collapsed.has(MINDMAP_ROOT_ID)) return [] // 折叠根 = 收起全部一级分支
    return pruneCollapsed(roots, collapsed)
  }, [roots, collapsed])
  const { placements, width, height } = useMemo(
    () => mindmapLayout(visibleRoots, node.title, MINDMAP_PREVIEW),
    [visibleRoots, node.title],
  )
  const byId = useMemo(() => new Map(placements.map((item) => [item.id, item])), [placements])
  const metrics = MINDMAP_PREVIEW

  if (!roots.length) {
    return <div className="lcos-note-mindmap is-empty">空大纲 · 双击直接编辑导图</div>
  }

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // —— G-4 分支拖出（指针事件，原始坐标跟手）——
  const beginBranchDrag = (event: ReactPointerEvent<SVGGElement>, itemId: string) => {
    const text = extractOutlineBranchText(roots, itemId)
    if (!text) return
    event.stopPropagation() // 阻断节点级画布拖拽（分支拖出与节点移动互斥）
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* 指针可能已释放 */ }
    branchDragRef.current = { pointerId: event.pointerId, text, svg: event.currentTarget.ownerSVGElement, moved: false, ghost: null }
  }
  const moveBranchDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const session = branchDragRef.current
    if (!session || session.pointerId !== event.pointerId) return
    if (!session.moved) {
      session.moved = true
      const ghost = document.createElement('div')
      ghost.className = 'lcos-mindmap-branch-ghost'
      const label = document.createElement('span')
      label.textContent = session.text.split('\n')[0]?.replace(/^[-*+]\s*/, '').trim() || '分支'
      const hint = document.createElement('small')
      hint.textContent = '松手摘成新文本节点'
      ghost.append(label, hint)
      document.body.appendChild(ghost)
      session.ghost = ghost
    }
    session.ghost!.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 16}px)`
  }
  const endBranchDrag = (event: ReactPointerEvent<SVGGElement>, cancelled: boolean) => {
    const session = branchDragRef.current
    branchDragRef.current = null
    if (!session || session.pointerId !== event.pointerId) return
    session.ghost?.remove()
    suppressClickRef.current = session.moved // 拖动过的松手不再触发折叠 click
    if (cancelled || !session.moved) return
    // 落回导图自身 → 视为取消（拖出才是摘取语义）
    const rect = session.svg?.getBoundingClientRect()
    if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return
    window.dispatchEvent(new CustomEvent(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, {
      detail: { text: session.text, clientX: event.clientX, clientY: event.clientY },
    }))
  }

  // viewBox 有 240×120 最小尺寸；内容比它小时整体平移居中（xMinYMin 会
  // 贴左上角留右侧空档 —— 小导图"歪向一边"的根因），并交给 xMidYMid 居中。
  const vbW = Math.max(240, width)
  const vbH = Math.max(120, height)
  const padX = Math.max(0, (vbW - width) / 2)
  const padY = Math.max(0, (vbH - height) / 2)

  return <div className="lcos-note-mindmap" data-note-mindmap={node.id}>
    <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={`translate(${padX} ${padY})`}>
      {placements.map((item) => {
        const parent = item.parentId ? byId.get(item.parentId) : undefined
        if (!parent) return null
        const x1 = item.side > 0 ? parent.x + parent.width : parent.x
        const y1 = parent.y + metrics.nodeH[Math.min(parent.depth, 3)]! / 2
        const x2 = item.side > 0 ? item.x : item.x + item.width
        const y2 = item.y + metrics.nodeH[Math.min(item.depth, 3)]! / 2
        const dx = (x2 - x1) * .5
        return <path
          key={`link-${item.id}`}
          className="lcos-mindmap-link"
          d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
        />
      })}
      {placements.map((item) => {
        // 折叠态下子树被剪空（hasChildren=false），但折叠 stub 必须仍可点击展开。
        const foldable = item.hasChildren || collapsed.has(item.id)
        // G-4 分支拖出：非根分支按住拖到画布空白处 → 提取该分支（含整棵子孙，
        // 用完整 roots 而非折叠后的 visibleRoots，拖出的是完整知识切片）成新文本节点。
        const draggableBranch = item.id !== MINDMAP_ROOT_ID
        return <g
          key={item.id}
          className={`lcos-mindmap-topic depth-${item.depth} ${foldable ? 'has-children' : ''} ${collapsed.has(item.id) ? 'is-collapsed' : ''}`}
          onPointerDown={draggableBranch ? (event) => beginBranchDrag(event, item.id) : undefined}
          onPointerMove={draggableBranch ? moveBranchDrag : undefined}
          onPointerUp={draggableBranch ? (event) => endBranchDrag(event, false) : undefined}
          onPointerCancel={draggableBranch ? (event) => endBranchDrag(event, true) : undefined}
          onClick={(event) => {
            event.stopPropagation()
            if (suppressClickRef.current) { suppressClickRef.current = false; return } // 拖出后的松手不是点击
            if (foldable) toggle(item.id)
          }}
        >
        <rect
          x={item.x} y={item.y} width={item.width} height={metrics.nodeH[Math.min(item.depth, 3)]!} rx={item.depth === 0 ? 12 : 8}
          style={{
            fill: item.depth === 0 ? `hsl(${item.hue} 38% 92%)` : item.depth === 1 ? `hsl(${item.hue} 34% 95%)` : 'rgba(255,255,255,.85)',
            stroke: `hsl(${item.hue} 38% 58% / ${item.depth === 0 ? .55 : .3})`,
            strokeWidth: item.depth === 0 ? 1.6 : 1,
          }}
        />
        <text x={item.x + 9} y={item.y + metrics.nodeH[Math.min(item.depth, 3)]! / 2 + 3.5} style={{ fontSize: metrics.fontByDepth[Math.min(item.depth, 3)] }}>
          {item.text}
        </text>
        {foldable && <circle
          cx={item.side >= 0 ? item.x + item.width - 7 : item.x + 7} cy={item.y + metrics.nodeH[Math.min(item.depth, 3)]! / 2} r={2.6}
          className="lcos-mindmap-fold"
          style={{ fill: `hsl(${item.hue} 38% 52% / ${collapsed.has(item.id) ? .95 : .4})` }}
        />}
      </g>})}
      </g>
    </svg>
    <span className="lcos-note-mindmap-hint">双击直接编辑导图 · 点分支折叠 · 拖分支到空白处摘成新节点</span>
  </div>
}

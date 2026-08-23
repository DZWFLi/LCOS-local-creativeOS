import { useMemo, useState } from 'react'
import type { CanvasNode } from '../../model'
import { outlineHue, outlineRows, parseOutline } from './outlineTree'

/**
 * Mind-map rendering for a text node in `noteLayout === 'mindmap'` mode.
 * The outline text is the data source (markmap paradigm); this component only
 * lays it out inside the node: root on the left, branches to the right,
 * parent→child links drawn as chunky light segments. Level font sizes step
 * down (13/11/10px); branch hue comes from the tag hash (six low-saturation
 * presets). Branches collapse to a checkpoint stub.
 */

interface Props {
  readonly node: CanvasNode
  readonly density: 'compact' | 'standard' | 'expanded'
  readonly onEdit?: () => void
}

interface Placement {
  readonly id: string
  readonly text: string
  readonly depth: number
  readonly hasChildren: boolean
  readonly x: number
  readonly y: number
  readonly width: number
  readonly parentId: string | null
  readonly hue: number
}

const FONT_BY_DEPTH = [13, 11, 10, 9]
const ROW_HEIGHT = [30, 26, 24, 22]
const LEVEL_GAP = 46
const BRANCH_GAP = 8

function layout(rows: ReturnType<typeof outlineRows>): { placements: Placement[]; height: number } {
  // Right-side tree: x by depth; y stacked per level group.
  // Classic tidy-tree pass 1: leaves stack bottom-up, parents centre on children.
  const placements: Placement[] = []
  const byRowId = new Map(rows.map((row) => [row.node.id, row]))
  let cursorY = 0
  const place = (rowId: string, depth: number): number => {
    const row = byRowId.get(rowId)
    if (!row) return cursorY
    const height = ROW_HEIGHT[Math.min(depth, 3)]
    const children = rows.filter((item) => item.parentId === rowId)
    let ownY: number
    if (children.length) {
      const childTop = cursorY
      const childMid = children.map((child) => place(child.node.id, depth + 1))
      // Centre on the children span without pushing the global cursor.
      ownY = (childMid[0]! + childMid[childMid.length - 1]!) / 2 - height / 2
      ownY = Math.max(ownY, childTop)
    } else {
      ownY = cursorY
      cursorY += height + BRANCH_GAP
    }
    const text = row.node.text.length > 22 ? `${row.node.text.slice(0, 21)}…` : row.node.text
    placements.push({
      id: row.node.id,
      text,
      depth,
      hasChildren: row.hasChildren,
      x: depth * LEVEL_GAP,
      y: Math.max(0, ownY),
      width: Math.max(64, text.length * (FONT_BY_DEPTH[Math.min(depth, 3)] * .62) + 18),
      parentId: row.parentId,
      hue: outlineHue(row.node),
    })
    return ownY + height / 2
  }
  rows.filter((row) => row.parentId === null).forEach((root) => place(root.node.id, 0))
  return { placements, height: cursorY }
}

export function MindMapNoteVisual({ node }: Props) {
  const outline = node.noteOutline ?? node.noteBody ?? ''
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const rows = useMemo(() => outlineRows(parseOutline(outline)), [outline])
  const visibleRows = useMemo(() => {
    if (!collapsed.size) return rows
    const hidden = new Set<string>()
    const walk = (parentId: string | null) => {
      rows.forEach((row) => {
        if (row.parentId !== parentId || hidden.has(row.node.id)) return
        if (collapsed.has(parentId ?? '__root__') || collapsed.has(row.node.id)) {
          hidden.add(row.node.id)
          return
        }
        walk(row.node.id)
      })
    }
    walk(null)
    return rows.filter((row) => !hidden.has(row.node.id))
  }, [rows, collapsed])

  const { placements, height } = useMemo(() => layout(visibleRows), [visibleRows])
  const byId = useMemo(() => new Map(placements.map((item) => [item.id, item])), [placements])

  if (!rows.length) {
    return <div className="lcos-note-mindmap is-empty">空大纲 · 双击编辑文本（缩进即层级，行尾 #标签 定分支色）</div>
  }

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return <div className="lcos-note-mindmap" data-note-mindmap={node.id}>
    <svg viewBox={`0 0 ${Math.max(240, Math.max(...placements.map((p) => p.x + p.width)) + 12)} ${Math.max(120, height + 8)}`} preserveAspectRatio="xMinYMin meet" aria-hidden="true">
      {placements.map((item) => {
        const parent = item.parentId ? byId.get(item.parentId) : undefined
        if (!parent) return null
        const x1 = parent.x + parent.width
        const y1 = parent.y + ROW_HEIGHT[Math.min(parent.depth, 3)] / 2
        const x2 = item.x
        const y2 = item.y + ROW_HEIGHT[Math.min(item.depth, 3)] / 2
        const midX = x1 + (x2 - x1) * .45
        return <path
          key={`link-${item.id}`}
          className="lcos-mindmap-link"
          style={{ stroke: `hsl(${item.hue} 38% 58%)` }}
          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
        />
      })}
      {placements.map((item) => <g
        key={item.id}
        className={`lcos-mindmap-topic depth-${item.depth} ${item.hasChildren ? 'has-children' : ''} ${collapsed.has(item.id) ? 'is-collapsed' : ''}`}
        onClick={(event) => { event.stopPropagation(); if (item.hasChildren) toggle(item.id) }}
      >
        <rect
          x={item.x} y={item.y} width={item.width} height={ROW_HEIGHT[Math.min(item.depth, 3)]} rx={item.depth === 0 ? 12 : 8}
          style={{
            fill: item.depth === 0 ? `hsl(${item.hue} 38% 92%)` : item.depth === 1 ? `hsl(${item.hue} 34% 95%)` : 'rgba(255,255,255,.85)',
            stroke: `hsl(${item.hue} 38% 58% / ${item.depth === 0 ? .55 : .3})`,
            strokeWidth: item.depth === 0 ? 1.6 : 1,
          }}
        />
        <text x={item.x + 9} y={item.y + ROW_HEIGHT[Math.min(item.depth, 3)] / 2 + 3.5} style={{ fontSize: FONT_BY_DEPTH[Math.min(item.depth, 3)] }}>
          {item.text}
        </text>
        {item.hasChildren && <circle
          cx={item.x + item.width - 7} cy={item.y + ROW_HEIGHT[Math.min(item.depth, 3)] / 2} r={2.6}
          className="lcos-mindmap-fold"
          style={{ fill: `hsl(${item.hue} 38% 52% / ${collapsed.has(item.id) ? .95 : .4})` }}
        />}
      </g>)}
    </svg>
    <span className="lcos-note-mindmap-hint">点分支点折叠 · 双击节点编辑大纲</span>
  </div>
}

/**
 * Outline tree — the data layer for mubu-style mind-map text nodes.
 *
 * The outline TEXT is the single source of truth (markmap paradigm):
 * indentation (two spaces, four spaces, or tabs, optionally with "-"/"*"
 * bullets) defines the hierarchy. Tags are `#tag` tokens at line end.
 * Parsing and serialization round-trip, so editing the text IS editing
 * the mind map — no second data structure.
 */

export interface OutlineNode {
  readonly id: string
  readonly text: string
  readonly tags: readonly string[]
  readonly depth: number
  readonly children: readonly OutlineNode[]
}

const TAG_PATTERN = /(?:^|\s)#([^\s#]+)/g
const BULLET_PATTERN = /^[-*+]\s+/

function indentWidth(line: string): number {
  const expanded = line.replace(/\t/g, '  ')
  const match = expanded.match(/^ */)
  return match ? match[0].length : 0
}

function parseLine(rawLine: string): { text: string; tags: string[] } {
  // Strip the leading bullet first (indentation was already measured), then tags.
  const unbulleted = rawLine.trim().replace(BULLET_PATTERN, '')
  const tags: string[] = []
  let match: RegExpExecArray | null
  TAG_PATTERN.lastIndex = 0
  while ((match = TAG_PATTERN.exec(unbulleted)) !== null) tags.push(match[1])
  const text = unbulleted.replace(TAG_PATTERN, '').replace(/\s+/g, ' ').trim()
  return { text, tags }
}

let idCounter = 0
const nextId = () => `outline-${(idCounter += 1)}`

/** Parse indented outline text into a forest. Blank lines and pure-tag lines are dropped. */
export function parseOutline(source: string): readonly OutlineNode[] {
  idCounter = 0
  const lines = source.split(/\r?\n/)
  const roots: OutlineNode[] = []
  // Stack of { node, indent } for open ancestors.
  const stack: Array<{ node: OutlineNode; indent: number }> = []
  const pushChild = (parent: { node: OutlineNode } | null, child: OutlineNode) => {
    if (!parent) { roots.push(child); return }
    Object.assign(parent.node, { children: [...parent.node.children, child] } as Partial<OutlineNode>)
  }
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const indent = indentWidth(rawLine)
    const { text, tags } = parseLine(rawLine)
    if (!text) continue
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop()
    const parent = stack[stack.length - 1] ?? null
    const node: OutlineNode = { id: nextId(), text, tags, depth: parent ? parent.node.depth + 1 : 0, children: [] }
    pushChild(parent, node)
    stack.push({ node, indent })
  }
  return roots
}

/** Serialize a forest back to outline text (two-space indent, "-" bullets, tags appended). */
export function serializeOutline(roots: readonly OutlineNode[]): string {
  const lines: string[] = []
  const walk = (node: OutlineNode, depth: number) => {
    const indent = depth === 0 ? '' : '  '.repeat(depth)
    const tags = node.tags.length ? ` ${node.tags.map((tag) => `#${tag}`).join(' ')}` : ''
    lines.push(`${indent}- ${node.text}${tags}`)
    node.children.forEach((child) => walk(child, depth + 1))
  }
  roots.forEach((root) => walk(root, 0))
  return lines.join('\n')
}

/** Flatten a forest into display rows (depth, parent linkage) for layout consumers. */
export interface OutlineRow {
  readonly node: OutlineNode
  readonly parentId: string | null
  readonly depth: number
  readonly hasChildren: boolean
}

export function outlineRows(roots: readonly OutlineNode[]): readonly OutlineRow[] {
  const rows: OutlineRow[] = []
  const walk = (node: OutlineNode, parentId: string | null) => {
    rows.push({ node, parentId, depth: node.depth, hasChildren: node.children.length > 0 })
    node.children.forEach((child) => walk(child, node.id))
  }
  roots.forEach((root) => walk(root, null))
  return rows
}

/** Max depth across the forest (0 = single level). */
export function outlineDepth(roots: readonly OutlineNode[]): number {
  return roots.reduce((max, node) => {
    const childDepth = outlineDepth(node.children)
    return Math.max(max, node.depth === 0 && !node.children.length ? 0 : childDepth + (node.children.length ? 1 : 0))
  }, 0)
}

/**
 * Branch hue: deterministic tag/text hash → one of six low-saturation hues.
 * Same branch → same hue across renders (mubu branch coloring).
 */
export const OUTLINE_HUES = [262, 210, 168, 36, 12, 320] as const

export function outlineHue(node: OutlineNode): number {
  const key = node.tags.join('/') || node.text
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0
  }
  return OUTLINE_HUES[Math.abs(hash) % OUTLINE_HUES.length]
}

/** Tolerant parse for agent output: non-outline prose degrades to single-line roots. */
export function parseOutlineLoose(source: string): readonly OutlineNode[] {
  const parsed = parseOutline(source)
  if (parsed.length) return parsed
  // No indentation structure at all — treat each non-empty line as a root.
  idCounter = 0
  return source
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter((line) => line.text)
    .map((line) => ({ id: nextId(), text: line.text, tags: line.tags, depth: 0, children: [] }))
}

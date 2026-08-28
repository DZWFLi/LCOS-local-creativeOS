import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Check, Highlighter, Heading1, Heading2, Heading3, List, Network, X } from 'lucide-react'
import type { CanvasNode } from '../../model'
import { MindMapEditor } from './MindMapEditor'
import { readShellChromeInsets } from './shellChromeInsets'

interface Props {
  readonly node: CanvasNode
  readonly camera: unknown
  readonly onCancel: () => void
  readonly onSave: (input: { readonly title: string; readonly body: string }) => void
  /** 编辑器内直接转导图（幕布 paradigm：大纲 ↔ 导图一键切换），携带编辑中的最新内容。 */
  readonly onConvertToMindmap?: (input: { readonly title: string; readonly body: string }) => void
}

/** 节点在屏幕上的真实矩形（含相机变换），编辑层照着它覆盖。 */
function measureNodeRect(nodeId: string): DOMRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-testid="canvas-node-${nodeId}"]`)
  return el ? el.getBoundingClientRect() : null
}

type LineType = 'p' | 'h1' | 'h2' | 'h3' | 'li'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** markdown 行内 → HTML（保存语法与卡片渲染一致：**粗体**、==高光==）。 */
function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
}

interface ParsedMarkdownBlock {
  readonly type: LineType
  readonly indent: number
  readonly content: string
}

function parseMarkdownBlockLine(line: string): ParsedMarkdownBlock {
  const indent = Math.min(6, Math.floor((line.length - line.trimStart().length) / 2))
  const trimmed = line.trim()
  const heading = trimmed.match(/^(#{1,3})\s+(.*)$/)
  if (heading) return { type: `h${heading[1]!.length}` as 'h1' | 'h2' | 'h3', indent, content: heading[2] ?? '' }
  const list = trimmed.match(/^[-*]\s+(.*)$/)
  if (list) return { type: 'li', indent, content: list[1] ?? '' }
  return { type: 'p', indent, content: trimmed }
}

function applyParsedMarkdownBlock(block: HTMLElement, parsed: ParsedMarkdownBlock): void {
  block.setAttribute('data-t', parsed.type)
  block.setAttribute('data-indent', String(parsed.indent))
  block.innerHTML = inlineToHtml(parsed.content) || '<br>'
}

/** markdown → contentEditable 块结构：每行一个块，data-t 记录行类型、
 * data-indent 记录层级（两空格一级）。层级即大纲深度 —— 文本视图的
 * 缩进与导图视图的分支是同一份数据（幕布式无缝切换）。 */
function markdownToHtml(md: string): string {
  return md.split('\n').map((line) => {
    const parsed = parseMarkdownBlockLine(line)
    return `<div data-t="${parsed.type}" data-indent="${parsed.indent}">${inlineToHtml(parsed.content) || '<br>'}</div>`
  }).join('')
}

/** contentEditable DOM → markdown（标题/列表来自块 data-t，层级来自
 * data-indent → 两空格缩进；粗体/高光来自 b/mark 元素）。 */
function readMarkdown(root: HTMLElement): string {
  const lines: string[] = []
  for (const node of [...root.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) { lines.push(node.textContent ?? ''); continue }
    if (node.nodeName === 'BR') { lines.push(''); continue }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as HTMLElement
    const t = el.getAttribute('data-t') ?? 'p'
    const indent = '  '.repeat(Number(el.getAttribute('data-indent')) || 0)
    const prefix = t === 'h1' ? '# ' : t === 'h2' ? '## ' : t === 'h3' ? '### ' : t === 'li' ? '- ' : ''
    let inline = ''
    const walk = (current: Node) => {
      if (current.nodeType === Node.TEXT_NODE) { inline += current.textContent ?? ''; return }
      if (current.nodeName === 'BR') return
      if (current.nodeName === 'B' || current.nodeName === 'STRONG') { inline += `**${current.textContent ?? ''}**`; return }
      if (current.nodeName === 'MARK') { inline += `==${current.textContent ?? ''}==`; return }
      current.childNodes.forEach(walk)
    }
    el.childNodes.forEach(walk)
    lines.push(indent + prefix + inline)
  }
  if (!lines.length) lines.push('')
  return lines.join('\n')
}

/** 保存前规整 DOM：游离文本/BR 包成块、剥掉空格式元素（折叠光标开启格式后未输入的场景）。 */
function normalizeBlocks(root: HTMLElement): void {
  for (const node of [...root.childNodes]) {
    if ((node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').length) || node.nodeName === 'BR') {
      const div = document.createElement('div')
      div.setAttribute('data-t', 'p')
      div.setAttribute('data-indent', '0')
      root.replaceChild(div, node)
      div.appendChild(node)
    }
  }
  root.querySelectorAll('b:empty, mark:empty').forEach((el) => el.remove())
}

/** 标题取纯文本（剥离行前缀与行内标记）。 */
function plainTitleLine(line: string): string {
  return line
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/==([^=]*)==/g, '$1')
    .replace(/^(#{1,3}\s+|[-*]\s+)/, '')
    .trim()
}

/** 光标所在块（带 data-t 的顶层 div）。 */
function blockOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  let cur: Node | null = node
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && (cur as HTMLElement).hasAttribute('data-t')) return cur as HTMLElement
    cur = cur.parentNode
  }
  return null
}

/**
 * Inline note editor — mubu-style canvas writing.
 * 文本模式：编辑层精确覆盖节点卡片（实测 DOM 矩形，跟随缩放），像在卡片上直接写字。
 * 正文是 contentEditable 真富文本（幕布/Notion 方式）：无任何语法符号，
 * 加粗/高光/标题/列表由浏览器原生排版，保存时序列化回 markdown。
 * 导图模式：沉浸式大悬浮窗（画布最顶层）：左侧大纲编辑、右侧导图完全展开实时预览。
 */
export function InlineNoteEditor({ node, onCancel, onSave, onConvertToMindmap }: Props) {
  const mindmap = node.noteLayout === 'mindmap'
  // noteOutline 可能是空串（不是 null），?? 不会回退 → 用 ||；并剥掉与标题重复的首行。
  const raw = mindmap ? (node.noteOutline || node.noteBody || '') : (node.noteBody || '')
  const initial = raw.startsWith(node.title) ? raw.slice(node.title.length).replace(/^\r?\n/, '') : raw
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [titleEmpty, setTitleEmpty] = useState(!node.title.trim())
  const [invalid, setInvalid] = useState(false)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const seededRef = useRef(false)

  // 就地模式：每帧实测节点矩形（相机移动/focus 定位后节点会动，编辑器贴着走）。
  useLayoutEffect(() => {
    if (mindmap) return
    let raf = 0
    const sync = () => {
      const next = measureNodeRect(node.id)
      if (next) setRect((prev) => prev
        && Math.abs(prev.left - next.left) < .5
        && Math.abs(prev.top - next.top) < .5
        && Math.abs(prev.width - next.width) < .5
        && Math.abs(prev.height - next.height) < .5 ? prev : next)
      raf = requestAnimationFrame(sync)
    }
    sync()
    return () => cancelAnimationFrame(raf)
  }, [mindmap, node.id])

  // 首次挂载：灌入块结构 HTML 并把光标放到末尾（React 不管理子节点，重渲染不会重置内容）。
  useLayoutEffect(() => {
    if (mindmap || seededRef.current) return
    const area = areaRef.current
    if (!area) return
    seededRef.current = true
    area.innerHTML = markdownToHtml(`${node.title}\n${initial}`)
    area.focus()
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(area)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [initial, mindmap, node.title, rect])

  const currentValue = () => {
    const area = areaRef.current
    return area ? readMarkdown(area) : ''
  }

  const save = () => {
    const area = areaRef.current
    if (area) normalizeBlocks(area)
    const lines = currentValue().split('\n')
    const title = plainTitleLine(lines[0] ?? '')
    if (!title) {
      setInvalid(true)
      window.setTimeout(() => setInvalid(false), 600)
      return
    }
    onSave({ title, body: lines.slice(1).join('\n') })
  }

  // ── 行内格式（加粗/高光）：选区包裹 <b>/<mark>，再按一次解包 ──
  const toggleInline = (tag: 'b' | 'mark') => {
    const area = areaRef.current
    const sel = window.getSelection()
    if (!area || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const startEl = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as HTMLElement
      : range.commonAncestorContainer.parentElement
    const existing = startEl?.closest(tag) ?? null
    if (existing && area.contains(existing)) {
      const parent = existing.parentNode!
      while (existing.firstChild) parent.insertBefore(existing.firstChild, existing)
      parent.removeChild(existing)
      parent.normalize()
      area.focus()
      return
    }
    const el = document.createElement(tag)
    if (range.collapsed) {
      // 折叠光标：开启该格式，后续输入即为该样式（Notion 行为；空元素保存时剥除）。
      range.insertNode(el)
      const next = document.createRange()
      next.setStart(el, 0)
      next.collapse(true)
      sel.removeAllRanges()
      sel.addRange(next)
    } else {
      el.appendChild(range.extractContents())
      el.normalize()
      range.insertNode(el)
      const next = document.createRange()
      next.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(next)
    }
    area.focus()
  }

  // ── 行类型（标题/列表）：改当前行的 data-t，再按一次回退普通段落 ──
  const setLineType = (t: 'h1' | 'h2' | 'h3' | 'li') => {
    const area = areaRef.current
    const sel = window.getSelection()
    if (!area || !sel || !sel.rangeCount) return
    const blocks = new Set<HTMLElement>()
    const anchorBlock = blockOf(sel.anchorNode, area)
    if (anchorBlock) blocks.add(anchorBlock)
    const range = sel.getRangeAt(0)
    area.querySelectorAll('[data-t]').forEach((el) => {
      if (range.intersectsNode(el)) blocks.add(el as HTMLElement)
    })
    blocks.forEach((block) => {
      const next = block.getAttribute('data-t') === t ? 'p' : t
      block.setAttribute('data-t', next)
    })
    area.focus()
  }

  // ── 层级调整（与导图编辑器同一套按键语义）：Tab 降级 / Shift+Tab 升级 ──
  // 幕布防跳级：降级最多比上一块深一级。
  const adjustIndent = (delta: 1 | -1) => {
    const area = areaRef.current
    const sel = window.getSelection()
    if (!area || !sel || !sel.rangeCount) return
    const block = blockOf(sel.anchorNode, area)
    if (!block) return
    const current = Number(block.getAttribute('data-indent')) || 0
    let next = Math.max(0, Math.min(6, current + delta))
    if (delta > 0) {
      const prev = block.previousElementSibling
      const prevIndent = prev?.getAttribute('data-indent')
      next = prev ? Math.min(next, (Number(prevIndent) || 0) + 1) : 0
    }
    if (next === current) return
    block.setAttribute('data-indent', String(next))
    area.focus()
  }

  // ── Enter：手动分块（保持 data-t 结构；列表行内非空时继承列表）──
  const insertLine = () => {
    const area = areaRef.current
    const sel = window.getSelection()
    if (!area || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) range.deleteContents()
    const block = blockOf(range.startContainer, area)
    if (!block) {
      const div = document.createElement('div')
      div.setAttribute('data-t', 'p')
      div.appendChild(document.createElement('br'))
      area.appendChild(div)
      setCursorStart(div)
      return
    }
    const tailRange = document.createRange()
    tailRange.selectNodeContents(block)
    tailRange.setStart(range.startContainer, range.startOffset)
    const tail = tailRange.extractContents()
    const next = document.createElement('div')
    next.setAttribute('data-t', block.getAttribute('data-t') === 'li' && (block.textContent ?? '').trim() ? 'li' : 'p')
    next.setAttribute('data-indent', block.getAttribute('data-indent') ?? '0')
    next.appendChild(tail)
    if (!next.textContent) next.appendChild(document.createElement('br'))
    block.after(next)
    setCursorStart(next)
  }

  const setCursorStart = (block: HTMLElement) => {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.setStart(block, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const applyMarkdownShortcut = (): boolean => {
    const area = areaRef.current
    const sel = window.getSelection()
    if (!area || !sel || !sel.rangeCount) return false
    const block = blockOf(sel.anchorNode, area)
    if (!block || block === area.firstElementChild || block.getAttribute('data-t') !== 'p') return false
    const prefix = (block.textContent ?? '').trim()
    const next: LineType | null = prefix === '#' ? 'h1' : prefix === '##' ? 'h2' : prefix === '###' ? 'h3' : prefix === '-' || prefix === '*' ? 'li' : null
    if (!next) return false
    block.setAttribute('data-t', next)
    block.textContent = ''
    block.appendChild(document.createElement('br'))
    setCursorStart(block)
    return true
  }

  const toolbar = <div className="inline-note-editor-toolbar" onPointerDown={(event) => event.preventDefault()}>
    <button type="button" aria-label="加粗" title="加粗 (Ctrl+B)" onClick={() => toggleInline('b')}><Bold size={13}/></button>
    <button type="button" aria-label="高光" title="高光 (Ctrl+G)" onClick={() => toggleInline('mark')}><Highlighter size={13}/></button>
    <span className="inline-note-editor-toolbar-sep"/>
    <button type="button" aria-label="一级标题" title="一级标题" onClick={() => setLineType('h1')}><Heading1 size={13}/></button>
    <button type="button" aria-label="二级标题" title="二级标题" onClick={() => setLineType('h2')}><Heading2 size={13}/></button>
    <button type="button" aria-label="三级标题" title="三级标题" onClick={() => setLineType('h3')}><Heading3 size={13}/></button>
    <span className="inline-note-editor-toolbar-sep"/>
    <button type="button" aria-label="列表" title="列表" onClick={() => setLineType('li')}><List size={13}/></button>
  </div>

  const area = <div
    ref={areaRef}
    className="inline-note-editor-area"
    contentEditable
    suppressContentEditableWarning
    spellCheck={false}
    role="textbox"
    aria-multiline="true"
    aria-label="编辑文本节点正文"
    onInput={() => setTitleEmpty(!plainTitleLine(currentValue().split('\n')[0] ?? ''))}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); save() }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleInline('b') }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g') { event.preventDefault(); toggleInline('mark') }
      // Notion/飞书/Markdown 成熟心智：行首 # / ## / ### / - + Space 立即转结构块。
      if (event.key === ' ' && !event.metaKey && !event.ctrlKey && !event.altKey && applyMarkdownShortcut()) { event.preventDefault(); return }
      // Tab / Shift+Tab：层级调整 —— 与导图编辑器的 Tab=子级 / Shift+Tab=升级 同一语义。
      if (event.key === 'Tab') { event.preventDefault(); adjustIndent(event.shiftKey ? -1 : 1) }
      // 空行 Backspace：删除该块并把光标收到上一块末尾（导图的 Del=删除节点 同一语义）。
      if (event.key === 'Backspace') {
        const area = areaRef.current
        const sel = window.getSelection()
        const block = area && sel ? blockOf(sel.anchorNode, area) : null
        if (block && !(block.textContent ?? '').length && block.previousElementSibling) {
          event.preventDefault()
          const prev = block.previousElementSibling
          block.remove()
          const range = document.createRange()
          range.selectNodeContents(prev)
          range.collapse(false)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        insertLine()
      }
    }}
    onPaste={(event) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text/plain').replace(/\r/g, '')
      if (!text) return
      const lines = text.split('\n')
      const area = areaRef.current
      const sel = window.getSelection()
      if (!area || !sel || !sel.rangeCount) return
      if (lines.length === 1) {
        document.execCommand('insertText', false, lines[0])
        return
      }
      // 多行：首行插入当前位置，其余逐行成块（保持块结构规整）。
      const range = sel.getRangeAt(0)
      if (!range.collapsed) range.deleteContents()
      if (lines[0]) document.execCommand('insertText', false, lines[0])
      const block = blockOf(sel.anchorNode ?? range.startContainer, area)
      if (!block) return
      let anchor: HTMLElement = block
      for (let i = 1; i < lines.length; i++) {
        const div = document.createElement('div')
        applyParsedMarkdownBlock(div, parseMarkdownBlockLine(lines[i] ?? ''))
        anchor.after(div)
        anchor = div
      }
      const last = document.createRange()
      last.selectNodeContents(anchor)
      last.collapse(false)
      sel.removeAllRanges()
      sel.addRange(last)
    }}
  />

  // ── 导图沉浸式：纯导图编辑（双击图上文字直接改，XMind 方式，无侧栏编辑器）──
  if (mindmap) return <MindMapEditor title={node.title} outline={initial} onCancel={onCancel} onSave={onSave}/>

  // ── 文本就地：编辑层精确覆盖节点卡片（portal 到 body，fixed 相对视口生效）──
  if (!rect) return null
  // B-3：编辑层 clamp 进 shell chrome 安全区（左 Rail 右缘 / 底部 Dock 上缘）。
  // 覆盖式编辑器不能远离节点，节点卡片区落在安全区外时整体平移到可见一侧。
  const chrome = readShellChromeInsets()
  const editorWidth = Math.max(220, Math.round(rect.width))
  const editorLeft = Math.round(Math.min(Math.max(rect.left, chrome.left + 8), window.innerWidth - editorWidth - 8))
  const editorTop = Math.round(Math.min(Math.max(rect.top, 8), Math.max(8, window.innerHeight - chrome.bottom - Math.round(rect.height) - 8)))
  return createPortal(<>
    <div className="inline-note-editor-scrim light" onPointerDown={save}/>
    <form
      className={`inline-note-editor in-place${invalid ? ' is-invalid' : ''}`}
      style={{ left: editorLeft, top: editorTop, width: editorWidth, minHeight: Math.round(rect.height) }}
      aria-label="编辑文本节点"
      onPointerDown={(event) => event.stopPropagation()}
      onSubmit={(event) => { event.preventDefault(); save() }}
    >
      {toolbar}
      <div className="inline-note-editor-writing">{area}</div>
      <div className="inline-note-editor-hud">
        <small>{invalid ? '第一行不能为空' : 'Tab 降级 · Shift+Tab 升级 · Ctrl+Enter 保存'}</small>
        <span>
          {onConvertToMindmap && <button type="button" className="inline-note-editor-convert" aria-label="转为大纲导图" title="保存并转为大纲导图（幕布式切换）" disabled={titleEmpty} onClick={() => {
            const area = areaRef.current
            if (area) normalizeBlocks(area)
            const lines = currentValue().split('\n')
            onConvertToMindmap({ title: plainTitleLine(lines[0] ?? ''), body: lines.slice(1).join('\n') })
          }}><Network size={13}/><b>导图</b></button>}
          <button type="button" aria-label="取消编辑" onClick={onCancel}><X size={13}/></button>
          <button type="submit" aria-label="保存文本" disabled={titleEmpty}><Check size={13}/></button>
        </span>
      </div>
    </form>
  </>, document.body)
}

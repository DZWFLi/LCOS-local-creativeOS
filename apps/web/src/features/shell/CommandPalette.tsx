/**
 * CommandPalette MVP（第一梯队 ⑤）：⌘K / Ctrl+K 全局命令面板。
 * 纯键盘驱动：输入过滤（provider 查询）→ ↑↓ 循环移动高亮 → Enter 执行 → Esc 关闭。
 * 结构参考 grok-bot CommandPalette（单输入 + listbox + 高亮行），不抄其 8 Tab /
 * 嵌套步骤 / 行号快捷键；执行动作全部来自 App 注入的 actions 表（provider 纯查询）。
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { groupPaletteSections, mergePaletteItems, type PaletteProvider } from './commandPaletteProviders'
import { PALETTE_KEYS } from './keymap'

export interface CommandPaletteProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly providers: readonly PaletteProvider[]
  /** item.id → 执行回调；面板只查表调用，动作本体全部在 App.tsx。 */
  readonly actions: Readonly<Record<string, () => void>>
}

/** 键位语义（纯函数）：keydown 的 key → 面板行为；其余键返回 null。 */
export type PaletteKeyEffect =
  | { readonly type: 'move'; readonly delta: -1 | 1 }
  | { readonly type: 'execute' }
  | { readonly type: 'close' }

export function readPaletteKey(key: string): PaletteKeyEffect | null {
  if (key === PALETTE_KEYS.moveUp) return { type: 'move', delta: -1 }
  if (key === PALETTE_KEYS.moveDown) return { type: 'move', delta: 1 }
  if (key === PALETTE_KEYS.execute) return { type: 'execute' }
  if (key === PALETTE_KEYS.close) return { type: 'close' }
  return null
}

/** 循环移动高亮：首尾相接（第 0 行上移 → 最后一行；最后一行下移 → 第 0 行）。 */
export function movePaletteHighlight(current: number, rowCount: number, delta: -1 | 1): number {
  if (rowCount <= 0) return 0
  const bounded = Math.min(Math.max(current, 0), rowCount - 1)
  return (bounded + delta + rowCount) % rowCount
}

export function CommandPalette({ open, onClose, providers, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const items = useMemo(() => mergePaletteItems(providers, query), [providers, query])
  const sections = useMemo(() => groupPaletteSections(items), [items])
  // 分节首行的平铺偏移：行 key 与 aria-selected 用平铺索引，与高亮状态同一坐标。
  const sectionRows = useMemo(() => {
    let offset = 0
    return sections.map((section) => {
      const start = offset
      offset += section.items.length
      return { section, start }
    })
  }, [sections])
  const selected = items.length === 0 ? 0 : Math.min(Math.max(highlight, 0), items.length - 1)

  // 每次打开：重置输入与高亮，异步聚焦输入框（纯键盘驱动的入口）。
  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null

  const execute = (index: number) => {
    const item = items[index]
    if (item === undefined) return
    onClose()
    actions[item.id]?.()
  }

  /** 键盘语义挂在 dialog 容器（而非仅 input）：焦点进入 option 按钮后 ↑↓/Esc 仍生效；
   *  Enter 只在非 button 目标上接管（option 按钮用原生激活，避免双重执行）。 */
  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const effect = readPaletteKey(event.key)
    if (effect === null) return
    if (effect.type === 'execute' && event.target instanceof HTMLButtonElement) return
    event.preventDefault()
    if (effect.type === 'close') onClose()
    else if (effect.type === 'execute') execute(selected)
    else setHighlight(movePaletteHighlight(selected, items.length, effect.delta))
  }

  const content = (
    <div className="lcos-command-palette-layer" data-testid="lcos-command-palette-layer">
      <div aria-hidden="true" className="lcos-command-palette-backdrop" onMouseDown={onClose} />
      <section
        aria-label="命令面板"
        aria-modal="true"
        className="lcos-command-palette"
        data-testid="lcos-command-palette"
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <input
          aria-label="搜索命令、节点、文件、会话与技能"
          className="lcos-command-palette-input"
          onChange={(event) => { setQuery(event.currentTarget.value); setHighlight(0) }}
          placeholder="输入命令、节点、文件、会话或技能…"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        {items.length === 0 ? (
          <p className="lcos-command-palette-empty">{query.trim().length > 0 ? '没有匹配的结果' : '没有可用的条目'}</p>
        ) : (
          <div aria-label="结果" className="lcos-command-palette-list" role="listbox">
            {sectionRows.map(({ section, start }) => (
              <div className="lcos-command-palette-group" key={section.group}>
                <h4 className="lcos-command-palette-group-title">{section.group}</h4>
                {section.items.map((item, itemIndex) => {
                  const rowIndex = start + itemIndex
                  return (
                    <button
                      aria-selected={rowIndex === selected}
                      className={`lcos-command-palette-row${rowIndex === selected ? ' is-selected' : ''}`}
                      data-palette-id={item.id}
                      key={item.id}
                      onClick={() => execute(rowIndex)}
                      onMouseMove={() => { if (rowIndex !== selected) setHighlight(rowIndex) }}
                      role="option"
                      type="button"
                    >
                      <span className="lcos-command-palette-row-title">{item.title}</span>
                      {item.hint === undefined ? null : <span className="lcos-command-palette-row-hint">{item.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
        <footer className="lcos-command-palette-footer">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  )

  // 测试 / SSR（无 document）下内联渲染，保证 renderToStaticMarkup 可断言结构；
  // 浏览器下 portal 到 body（全局顶层，不受局部 stacking context 影响）。
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

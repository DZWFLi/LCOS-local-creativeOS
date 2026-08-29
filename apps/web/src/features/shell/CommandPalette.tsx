/**
 * Ctrl/Cmd+K Action Launcher.
 * Keeps the donor provider/async/keyboard mechanics, but searches actions only.
 * Project content belongs to Search (Ctrl/Cmd+F); Focus (F) locates selected objects.
 */

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { isUsable, makeLoading, type AsyncSnapshot } from '../ui/asyncState'
import {
  groupPaletteEntries,
  mergePaletteEntries,
  normalizePaletteProviderInput,
  PALETTE_GROUP_ORDER,
  type PaletteEntry,
  type PaletteProvider,
  type PaletteProviderInput,
  type PaletteSearchOutcome,
} from './paletteProvider'
import { PALETTE_KEYS } from './keymap'

export interface CommandPaletteProps {
  readonly open: boolean
  readonly onClose: () => void
  /** 数据源：新异步 provider（id/label/search，六态快照）或旧同步 provider（group/query）——输入侧就地归一。 */
  readonly providers: readonly PaletteProviderInput[]
  /** item.id → 执行回调；面板只查表调用，动作本体全部在 App.tsx。 */
  readonly actions: Readonly<Record<string, () => void>>
  /** If no action matches a non-empty query, offer one explicit handoff to Project Search. */
  readonly onSearchProject?: (query: string) => void
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

/* ---------------- provider 化数据流的中间形状 ---------------- */

/** 单 provider 一次 search 的发起记录（outcome = 同步快照或 Promise）。 */
interface PaletteSearchEntry {
  readonly provider: PaletteProvider
  readonly outcome: PaletteSearchOutcome
}

/** 异步源已解析的快照：只认挂靠在「当前 searches」上的结果（stale 不回写）。 */
interface ResolvedSnapshots {
  readonly searches: readonly PaletteSearchEntry[]
  readonly snapshots: Readonly<Record<string, AsyncSnapshot<readonly PaletteEntry[]>>>
}

/** 需要渲染状态行的 provider 快照（loading / failed / unavailable；empty / cancelled 不渲染）。 */
interface ProviderStateRow {
  readonly provider: PaletteProvider
  readonly status: 'loading' | 'failed' | 'unavailable'
  readonly error?: string
}

/** 渲染分节：五组 IA 的 ready 条目 + 该组 provider 的状态行（骨架 / 浅错）同节共存。 */
interface RenderSection {
  readonly group: string
  readonly items: readonly PaletteEntry[]
  readonly states: readonly ProviderStateRow[]
}

export function CommandPalette({ open, onClose, providers, actions, onSearchProject }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // —— provider 化数据流（A3）：query → 全 providers 并发 search → 合并各 snapshot ——
  // 兼容面：旧同步 provider（group + query）就地归一成新 provider；混合实例直走 search。
  const paletteProviders = useMemo(() => providers.map(normalizePaletteProviderInput), [providers])

  // render 期并发发起查询：内存态源同步落快照（ready/empty，renderToStaticMarkup 可断言），
  // 异步源落 Promise（先按 loading 渲染）。search 承诺零副作用（见 paletteProvider.ts），
  // render 期调用安全；useMemo 保证同 (providers, query) 不重复发起。
  const searches = useMemo(
    () => paletteProviders.map((provider): PaletteSearchEntry => ({ provider, outcome: provider.search(query) })),
    [paletteProviders, query],
  )

  // 异步源的已解析快照。只认「挂靠在当前 searches 上」的解析结果：query 一变，旧 searches
  // 失配即整体作废（stale response must not clobber fresh state，见 asyncState.ts 契约）。
  const [resolved, setResolved] = useState<ResolvedSnapshots | null>(null)

  // 异步源并发解析（Promise.all）：provider 层持序号把过期结果折叠为 makeCancelled（丢弃），
  // 组件层再以 searches 身份比对兜底——双重防护旧结果不回写 UI。
  useEffect(() => {
    const pending = searches.filter(
      (search): search is PaletteSearchEntry & { readonly outcome: Promise<AsyncSnapshot<readonly PaletteEntry[]>> } =>
        search.outcome instanceof Promise,
    )
    if (pending.length === 0) return
    let live = true
    void Promise.all(
      pending.map(async (search): Promise<readonly [string, AsyncSnapshot<readonly PaletteEntry[]>]> => [
        search.provider.id,
        await search.outcome,
      ]),
    )
      .then((pairs) => {
        if (live) setResolved({ searches, snapshots: Object.fromEntries(pairs) })
      })
      .catch(() => { /* provider 层已把失败折叠为 failed 快照；此处兜底：保持 loading 不回写 */ })
    return () => { live = false }
  }, [searches])

  // 有效快照：同步结果直取；异步结果未回（或已随 query 作废）→ loading。
  const outcomes = useMemo(
    () =>
      searches.map(({ provider, outcome }) => {
        if (!(outcome instanceof Promise)) return { provider, snapshot: outcome }
        const snapshot =
          resolved !== null && resolved.searches === searches ? resolved.snapshots[provider.id] : undefined
        return { provider, snapshot: snapshot ?? makeLoading() }
      }),
    [searches, resolved],
  )

  // 合并：仅 ready 态供数据（isUsable）→ 跨 provider 按 id 去重（首见优先）→ 五组 IA 分节。
  const providerItems = useMemo(
    () => mergePaletteEntries(outcomes.flatMap((outcome) => (isUsable(outcome.snapshot) ? [outcome.snapshot.data] : []))),
    [outcomes],
  )
  const searchHandoff = query.trim().length > 0 && providerItems.length === 0 && onSearchProject !== undefined
    ? [{ id: 'cmd:search-project', title: `在项目里搜索“${query.trim()}”`, hint: '查找文件、对话和项目内容', group: '操作' as const }]
    : []
  const items = useMemo(() => mergePaletteEntries([providerItems, searchHandoff]), [providerItems, searchHandoff])
  const sections = useMemo(() => groupPaletteEntries(items), [items])

  // 六态渲染分流：loading / failed / unavailable → 状态行；empty → 组不显示（现行为）；cancelled → 丢弃。
  const providerStates = useMemo(
    () =>
      outcomes.flatMap((outcome): ProviderStateRow[] => {
        const status = outcome.snapshot.status
        if (status !== 'loading' && status !== 'failed' && status !== 'unavailable') return []
        return [{ provider: outcome.provider, status, error: outcome.snapshot.error }]
      }),
    [outcomes],
  )

  // 渲染分节：五组 IA 顺序内，ready 条目与该组 provider 的状态行同节共存；
  // label 不在五组内的 provider（未来扩展源）状态节追加在末尾。
  const renderSections = useMemo(() => {
    const ordered: RenderSection[] = PALETTE_GROUP_ORDER.map((group) => ({
      group,
      items: sections.find((section) => section.group === group)?.items ?? [],
      states: providerStates.filter((state) => state.provider.label === group),
    }))
    const groupNames: readonly string[] = PALETTE_GROUP_ORDER
    const custom = providerStates.filter((state) => !groupNames.includes(state.provider.label))
    return [
      ...ordered.filter((section) => section.items.length > 0 || section.states.length > 0),
      ...custom.map((state) => ({ group: state.provider.label, items: [], states: [state] })),
    ]
  }, [sections, providerStates])

  // 分节首行的平铺偏移：行 key 与 aria-selected 用平铺索引，与高亮状态同一坐标
  //（状态行非 option，不占导航坐标——↑↓/Enter 只在真实条目上移动/执行）。
  const sectionRows = useMemo(() => {
    let offset = 0
    return renderSections.map((section) => {
      const start = offset
      offset += section.items.length
      return { section, start }
    })
  }, [renderSections])
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
    if (item.id === 'cmd:search-project') { onSearchProject?.(query.trim()); return }
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
        aria-label="操作"
        aria-modal="true"
        className="lcos-command-palette"
        data-testid="lcos-command-palette"
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <input
          aria-label="查找操作"
          className="lcos-command-palette-input"
          onChange={(event) => { setQuery(event.currentTarget.value); setHighlight(0) }}
          placeholder="你想做什么？"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        {renderSections.length === 0 ? (
          <p className="lcos-command-palette-empty">{query.trim().length > 0 ? '没有找到这个操作' : '没有可用的操作'}</p>
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
                {section.states.map((state) => {
                  if (state.status === 'loading') {
                    return (
                      <Fragment key={`${state.provider.id}:loading`}>
                        <div aria-hidden="true" className="lcos-command-palette-row">
                          <span className="lcos-command-palette-row-title">搜索中…</span>
                        </div>
                        <div aria-hidden="true" className="lcos-command-palette-row" />
                      </Fragment>
                    )
                  }
                  const stateTitle = state.status === 'failed' ? '现在没法读取这些操作' : '这些操作现在不可用'
                  return (
                    <div className="lcos-command-palette-row" key={`${state.provider.id}:${state.status}`}>
                      <span className="lcos-command-palette-row-title">{stateTitle}</span>
                      {state.error === undefined ? null : <span className="lcos-command-palette-row-hint">{state.error}</span>}
                    </div>
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

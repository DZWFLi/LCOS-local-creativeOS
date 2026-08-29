import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  createCommandPaletteProviders,
  groupPaletteSections,
  mergePaletteItems,
  scorePaletteItem,
  type PaletteCommandActions,
  type PaletteItem,
  type PaletteProvider,
} from '../src/features/shell/commandPaletteProviders'
import { CommandPalette, movePaletteHighlight, readPaletteKey } from '../src/features/shell/CommandPalette'
import { PALETTE_KEYS } from '../src/features/shell/keymap'

const noop = (): void => {}

function commandFixture(overrides: Partial<PaletteCommandActions> = {}): PaletteCommandActions {
  return {
    switchToMainView: vi.fn(),
    switchToContextView: vi.fn(),
    switchToWorkflowView: vi.fn(),
    createTextNode: vi.fn(),
    expandMindmap: vi.fn(),
    exportLcosproj: vi.fn(),
    switchReceiver: vi.fn(),
    replaySkill: vi.fn(),
    ...overrides,
  }
}

function assemblyFixture(commands: PaletteCommandActions = commandFixture()) {
  const assembly = createCommandPaletteProviders({
    commands,
    conversations: [
      { id: 'cc-1', label: 'GUI 收口', active: true },
      { id: 'cc-2', label: '周报整理', active: false },
    ],
    skills: [
      { artifactId: 'art-1', name: '整理周报', description: '把已有材料整理成周报' },
    ],
  })
  return { assembly, commands }
}

describe('Action Launcher 键位语义', () => {
  it('Ctrl/⌘+K、↑↓、Enter、Esc 保持 keyboard-first', () => {
    expect(PALETTE_KEYS.open).toBe('k')
    expect(readPaletteKey('ArrowUp')).toEqual({ type: 'move', delta: -1 })
    expect(readPaletteKey('ArrowDown')).toEqual({ type: 'move', delta: 1 })
    expect(readPaletteKey('Enter')).toEqual({ type: 'execute' })
    expect(readPaletteKey('Escape')).toEqual({ type: 'close' })
    expect(readPaletteKey('a')).toBeNull()
  })

  it('高亮首尾循环', () => {
    expect(movePaletteHighlight(0, 3, -1)).toBe(2)
    expect(movePaletteHighlight(2, 3, 1)).toBe(0)
    expect(movePaletteHighlight(0, 0, 1)).toBe(0)
  })
})

describe('Action Launcher IA', () => {
  it('只有一个“操作” provider；节点和文件不再成为 Ctrl+K 内容源', () => {
    const { assembly } = assemblyFixture()
    expect(assembly.providers).toHaveLength(1)
    expect(assembly.providers[0]?.group).toBe('操作')
    const items = assembly.providers[0]!.query('')
    expect(items).toHaveLength(9)
    expect(items.every((item) => item.group === '操作')).toBe(true)
    expect(items.some((item) => item.id.startsWith('node:'))).toBe(false)
    expect(items.some((item) => item.id.startsWith('file:'))).toBe(false)
  })

  it('Conversation/Skill 只以动作出现，不泄漏 provider/步骤编排口吻', () => {
    const { assembly } = assemblyFixture()
    const items = assembly.providers[0]!.query('')
    expect(items.find((item) => item.id === 'receiver:cc-1')?.title).toBe('交给「GUI 收口」')
    expect(items.find((item) => item.id === 'receiver:cc-1')?.hint).toBe('现在默认就是这段对话')
    expect(items.find((item) => item.id === 'skill:art-1')?.title).toBe('再次使用「整理周报」')
    expect(items.map((item) => `${item.title} ${item.hint ?? ''}`).join(' ')).not.toMatch(/Provider|receiver|\d+ 步/)
  })

  it('动作关键词仍保留 fuzzy 搜索能力', () => {
    const { assembly } = assemblyFixture()
    const provider = assembly.providers[0]!
    expect(provider.query('工作流').map((item) => item.id)).toContain('cmd:view-workflow')
    expect(provider.query('周报').map((item) => item.id)).toEqual(expect.arrayContaining(['receiver:cc-2', 'skill:art-1']))
  })

  it('expandMindmap=null 时相关动作不出现', () => {
    const { assembly } = assemblyFixture(commandFixture({ expandMindmap: null }))
    expect(assembly.providers[0]!.query('').some((item) => item.id === 'cmd:expand-mindmap')).toBe(false)
    expect(assembly.actions['cmd:expand-mindmap']).toBeUndefined()
  })
})

describe('Action Launcher provider helpers', () => {
  it('评分仍是标题前缀 > 标题包含 > keywords', () => {
    expect(scorePaletteItem({ id: 'a', title: '导出项目', group: '操作' }, '导出')).toBe(3)
    expect(scorePaletteItem({ id: 'a', title: '立即导出项目', group: '操作' }, '导出')).toBe(2)
    expect(scorePaletteItem({ id: 'a', title: '保存项目', group: '操作', keywords: '导出 export' }, '导出')).toBe(1)
  })

  it('合并仍按 id 去重，但只暴露操作分节', () => {
    const first: PaletteProvider = { group: '操作', query: () => [{ id: 'dup', title: '首见', group: '操作' }] }
    const second: PaletteProvider = { group: '操作', query: () => [{ id: 'dup', title: '后见', group: '操作' }, { id: 'other', title: '保留', group: '操作' }] }
    const merged = mergePaletteItems([first, second], '')
    expect(merged.map((item) => item.title)).toEqual(['首见', '保留'])
    expect(groupPaletteSections(merged).map((section) => section.group)).toEqual(['操作'])
  })
})

describe('Action Launcher 执行与结构', () => {
  it('动作 id 路由到注入回调', () => {
    const { assembly, commands } = assemblyFixture()
    assembly.actions['cmd:view-main']!()
    assembly.actions['receiver:cc-2']!()
    assembly.actions['skill:art-1']!()
    expect(commands.switchToMainView).toHaveBeenCalledTimes(1)
    expect(commands.switchReceiver).toHaveBeenCalledWith('cc-2')
    expect(commands.replaySkill).toHaveBeenCalledWith('art-1')
  })

  it('provider 查询零副作用', () => {
    const { assembly, commands } = assemblyFixture()
    assembly.providers[0]!.query('')
    assembly.providers[0]!.query('周报')
    expect(commands.switchToMainView).not.toHaveBeenCalled()
    expect(commands.switchReceiver).not.toHaveBeenCalled()
    expect(commands.replaySkill).not.toHaveBeenCalled()
  })

  it('UI 明确表达“操作”，不再暗示可搜索节点/文件/会话内容', () => {
    const { assembly } = assemblyFixture()
    const html = renderToStaticMarkup(
      <CommandPalette open onClose={noop} providers={assembly.providers} actions={assembly.actions} />,
    )
    expect(html).toContain('aria-label="操作"')
    expect(html).toContain('aria-label="查找操作"')
    expect(html).toContain('placeholder="你想做什么？"')
    expect(html).toContain('>操作</h4>')
    expect(html).not.toContain('搜索命令、节点、文件、会话与技能')
  })

  it('open=false 不渲染', () => {
    const { assembly } = assemblyFixture()
    expect(renderToStaticMarkup(<CommandPalette open={false} onClose={noop} providers={assembly.providers} actions={assembly.actions} />)).toBe('')
  })
})

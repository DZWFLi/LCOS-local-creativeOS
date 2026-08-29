/**
 * Ctrl/Cmd+K Action Launcher assembly.
 *
 * Product rule: this surface searches actions only. Project nodes/files/conversation content
 * belong to Search (Ctrl/Cmd+F). Conversation and Skill entries are allowed here only when
 * they are phrased as concrete actions (e.g. “交给这段对话”, “再次使用这项技能”).
 */

import {
  createPaletteProvider,
  mergePaletteEntries,
  rankPaletteEntries,
  type PaletteEntry,
  type PaletteGroupId,
  type PaletteProvider as AsyncPaletteProvider,
  type SyncPaletteProvider,
} from './paletteProvider'

export { PALETTE_GROUP_ORDER } from './paletteProvider'
export type { PaletteGroupId, PaletteSection } from './paletteProvider'
export { groupPaletteEntries as groupPaletteSections, scorePaletteEntry as scorePaletteItem } from './paletteProvider'

export type PaletteItem = PaletteEntry
export type PaletteProvider = SyncPaletteProvider
export type HybridPaletteProvider = PaletteProvider & AsyncPaletteProvider

export interface PaletteConversationEntry {
  readonly id: string
  readonly label: string
  readonly active: boolean
}

export interface PaletteSkillEntry {
  readonly artifactId: string
  readonly name: string
  readonly description: string
}

export interface PaletteCommandActions {
  readonly switchToMainView: () => void
  readonly switchToContextView: () => void
  readonly switchToWorkflowView: () => void
  readonly createTextNode: () => void
  readonly expandMindmap: (() => void) | null
  readonly exportLcosproj: () => void
  readonly switchReceiver: (conversationId: string) => void
  readonly replaySkill: (artifactId: string) => void
}

export interface CommandPaletteAssembly {
  readonly providers: readonly HybridPaletteProvider[]
  readonly actions: Readonly<Record<string, () => void>>
}

export function mergePaletteItems(providers: readonly PaletteProvider[], term: string): readonly PaletteItem[] {
  return mergePaletteEntries(providers.map((provider) => provider.query(term)))
}

function hybridProvider(input: {
  readonly id: string
  readonly label: PaletteGroupId
  readonly fetch: (term: string) => readonly PaletteItem[]
}): HybridPaletteProvider {
  const provider = createPaletteProvider({ id: input.id, label: input.label, fetch: input.fetch })
  return { ...provider, group: input.label, query: input.fetch }
}

function staticActionItems(commands: PaletteCommandActions): readonly PaletteItem[] {
  return [
    { id: 'cmd:view-main', title: '回到主画布', hint: '查看整个项目', group: '操作', keywords: '主画布 main 项目 总览 回到 切换' },
    { id: 'cmd:view-context', title: '打开上下文', hint: '整理和理解项目材料', group: '操作', keywords: '上下文 context 理解 材料 打开 切换' },
    { id: 'cmd:view-workflow', title: '打开工作流', hint: '查看和推动当前工作', group: '操作', keywords: '工作流 workflow 行动 执行 打开 切换' },
    { id: 'cmd:create-text', title: '新建文本', hint: '在当前画布写点东西', group: '操作', keywords: '新建 文本 note text create 写' },
    ...(commands.expandMindmap === null ? [] : [{
      id: 'cmd:expand-mindmap',
      title: '把选中的文本展开成导图',
      hint: '从当前文本展开结构',
      group: '操作' as const,
      keywords: '导图 大纲 mindmap outline 展开 结构',
    }]),
    { id: 'cmd:export-lcosproj', title: '导出项目', hint: '保存一份可恢复的项目文件', group: '操作', keywords: '导出 工程 备份 export lcosproj 保存 下载' },
  ]
}

export function createCommandPaletteProviders(input: {
  readonly commands: PaletteCommandActions
  readonly conversations: readonly PaletteConversationEntry[]
  readonly skills: readonly PaletteSkillEntry[]
}): CommandPaletteAssembly {
  const actionItems = staticActionItems(input.commands)
  const conversationActions: readonly PaletteItem[] = input.conversations.map((conversation) => ({
    id: `receiver:${conversation.id}`,
    title: `交给「${conversation.label}」`,
    hint: conversation.active ? '现在默认就是这段对话' : '把它设为默认承接对话',
    group: '操作',
    keywords: `${conversation.label} 对话 交给 默认 承接 切换 receiver`,
  }))
  const skillActions: readonly PaletteItem[] = input.skills.map((skill) => ({
    id: `skill:${skill.artifactId}`,
    title: `再次使用「${skill.name}」`,
    hint: skill.description,
    group: '操作',
    keywords: `${skill.name} ${skill.description} 技能 再次 使用 重放 replay skill`,
  }))

  const actionsProvider = hybridProvider({
    id: 'actions',
    label: '操作',
    fetch: (term) => rankPaletteEntries([...actionItems, ...conversationActions, ...skillActions], term),
  })

  const actions: Record<string, () => void> = {
    'cmd:view-main': input.commands.switchToMainView,
    'cmd:view-context': input.commands.switchToContextView,
    'cmd:view-workflow': input.commands.switchToWorkflowView,
    'cmd:create-text': input.commands.createTextNode,
    ...(input.commands.expandMindmap === null ? {} : { 'cmd:expand-mindmap': input.commands.expandMindmap }),
    'cmd:export-lcosproj': input.commands.exportLcosproj,
  }
  for (const conversation of input.conversations) actions[`receiver:${conversation.id}`] = () => input.commands.switchReceiver(conversation.id)
  for (const skill of input.skills) actions[`skill:${skill.artifactId}`] = () => input.commands.replaySkill(skill.artifactId)

  return { providers: [actionsProvider], actions }
}

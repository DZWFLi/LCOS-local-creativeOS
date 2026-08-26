/**
 * CommandPalette provider 装配（Wave A-4 改造：grok-bot A3 架构内化）。
 * 五组数据源（命令/节点/文件/会话/技能）各包成一个 provider 实例：数据获取逻辑保持
 * 原样（内存态投影 → 同步 fetch → ready/empty 快照），只包一层 async + snapshot 返回
 * （工厂见 paletteProvider.ts）。执行动作仍全部由 App.tsx 装配注入（A3「action
 * injection」：actions 表按 entry.id 寻址）；本文件只做数据 → 条目的投影与过滤。
 * 零副作用承诺（A3「query 零副作用」）：fetch / query / search 均不得 mutate 任何
 * 外部状态、不得触发动作回调。
 *
 * 兼容面（既有测试与 App 依赖，签名冻结）：保留同步 PaletteProvider（group + query）
 * 导出与 mergePaletteItems / groupPaletteSections / scorePaletteItem 等既有 API。
 * 五个 provider 实例为「混合实例」：同时实现旧同步面（group + query）与新异步面
 * （id + label + search），旧调用方零迁移；CommandPalette 走新异步面渲染六态。
 * 与 grok-bot 的差异（按 LCOS 收口要求）：不抄 8 Tab（合并为单列表按 group 分节）、
 * 无嵌套步骤、无行号快捷键。
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

/* ---------------- 兼容 re-export（既有公共名 → 架构文件 canonical 实现） ---------------- */

export { PALETTE_GROUP_ORDER } from './paletteProvider'
export type { PaletteGroupId, PaletteSection } from './paletteProvider'
export { groupPaletteEntries as groupPaletteSections, scorePaletteEntry as scorePaletteItem } from './paletteProvider'

/** 面板条目（= A3 架构的 PaletteEntry；保留旧名作兼容导出）。 */
export type PaletteItem = PaletteEntry

/** 旧同步 provider 面（group + query）：既有测试 / 旧装配代码的冻结口径。 */
export type PaletteProvider = SyncPaletteProvider

/** 混合实例：同时实现旧同步面（group + query）与新异步面（id + label + search）。 */
export type HybridPaletteProvider = PaletteProvider & AsyncPaletteProvider

/* ---------------- App 注入的数据源（中性条目，provider 层不依赖 App 类型） ---------------- */

/** 画布节点条目（数据源 = App.tsx 的 nodes 列表投影）。 */
export interface PaletteNodeEntry {
  readonly id: string
  readonly title: string
  readonly fileType?: string
}

/** 已连接会话条目（数据源 = listConnectedConversations 投影）。 */
export interface PaletteConversationEntry {
  readonly id: string
  readonly label: string
  readonly provider: string
  readonly active: boolean
}

/** 技能条目（数据源 = workflowSkills 投影）。 */
export interface PaletteSkillEntry {
  readonly artifactId: string
  readonly name: string
  readonly description: string
  readonly stepCount: number
}

/** 命令源动作回调：全部由 App.tsx 注入现有函数。 */
export interface PaletteCommandActions {
  readonly switchToMainView: () => void
  readonly switchToContextView: () => void
  readonly switchToWorkflowView: () => void
  readonly createTextNode: () => void
  /** 无可用导图入口时传 null，面板不列出该项。 */
  readonly expandMindmap: (() => void) | null
  readonly exportLcosproj: () => void
  readonly switchReceiver: (conversationId: string) => void
  readonly replaySkill: (artifactId: string) => void
}

/** 节点/文件源的导航回调。 */
export interface PaletteNavigationActions {
  readonly locateNode: (nodeId: string) => void
  readonly openFile: (nodeId: string) => void
}

/** 面板装配结果：providers 喂给组件查询（六态快照），actions 按 item.id 执行。 */
export interface CommandPaletteAssembly {
  readonly providers: readonly HybridPaletteProvider[]
  readonly actions: Readonly<Record<string, () => void>>
}

/* ---------------- 同步合并（兼容面，纯函数） ---------------- */

/** 多 provider 合并（同步兼容面）：query 透传 → 按 id 去重（首见优先）→ 按五组 IA 平铺。 */
export function mergePaletteItems(providers: readonly PaletteProvider[], term: string): readonly PaletteItem[] {
  return mergePaletteEntries(providers.map((provider) => provider.query(term)))
}

/* ---------------- 五个 provider 的装配工厂 ---------------- */

/** 混合实例工厂：同一份纯查询 fetch 同时落新旧两套接口（数据获取逻辑保持原样）。 */
function hybridProvider(input: {
  readonly id: string
  readonly label: PaletteGroupId
  readonly fetch: (term: string) => readonly PaletteItem[]
}): HybridPaletteProvider {
  const provider = createPaletteProvider({ id: input.id, label: input.label, fetch: input.fetch })
  return { ...provider, group: input.label, query: input.fetch }
}

/** 静态命令条目（group=命令）；导图动作缺位时整条不列出。 */
function staticCommandItems(commands: PaletteCommandActions): readonly PaletteItem[] {
  return [
    { id: 'cmd:view-main', title: '切换到主画布视图', hint: 'Main · 项目材料与空间', group: '命令', keywords: '主画布 main arrange 视图 view 切换 surface' },
    { id: 'cmd:view-context', title: '切换到上下文视图', hint: 'Context · 共同理解现场', group: '命令', keywords: '上下文 context 理解 视图 view 切换 surface' },
    { id: 'cmd:view-workflow', title: '切换到工作流视图', hint: 'Workflow · 行动骨架', group: '命令', keywords: '工作流 workflow 视图 view 切换 surface' },
    { id: 'cmd:create-text', title: '新建文本节点', hint: '在画布落一张文本卡', group: '命令', keywords: '新建 文本 节点 note text create' },
    ...(commands.expandMindmap === null ? [] : [{
      id: 'cmd:expand-mindmap',
      title: '展开选中节点为导图',
      hint: '选中的文本 → 大纲导图',
      group: '命令' as const,
      keywords: '导图 大纲 mindmap outline 展开',
    }]),
    { id: 'cmd:export-lcosproj', title: '导出 .lcosproj 工程文件', hint: '下载当前项目的工程包', group: '命令', keywords: '导出 工程 备份 export lcosproj 工程文件 download' },
  ]
}

/**
 * 装配五个 provider（actions 命令源 / nodes 节点源 / files 文件源 / sessions 会话源 /
 * skills 技能源）与执行表。命令源仍附带会话/技能条目（执行语义与命令同构：选中即执行；
 * 既有行为与测试口径冻结），sessions/skills 两个独立 provider 的条目在合并层按 id
 * 去重，不重复渲染。
 */
export function createCommandPaletteProviders(input: {
  readonly commands: PaletteCommandActions
  readonly navigation: PaletteNavigationActions
  readonly nodes: readonly PaletteNodeEntry[]
  readonly conversations: readonly PaletteConversationEntry[]
  readonly skills: readonly PaletteSkillEntry[]
}): CommandPaletteAssembly {
  const commandItems = staticCommandItems(input.commands)
  const conversationItems: readonly PaletteItem[] = input.conversations.map((conversation) => ({
    id: `receiver:${conversation.id}`,
    title: `切换承接 · ${conversation.label}`,
    hint: conversation.active ? `${conversation.provider} · 当前承接` : conversation.provider,
    group: '会话',
    keywords: `${conversation.label} ${conversation.provider} receiver 会话 承接 切换`,
  }))
  const skillItems: readonly PaletteItem[] = input.skills.map((skill) => ({
    id: `skill:${skill.artifactId}`,
    title: `重放技能 · ${skill.name}`,
    hint: `${skill.stepCount} 步 · ${skill.description}`,
    group: '技能',
    keywords: `${skill.name} ${skill.description} skill 技能 重放 replay`,
  }))

  // 节点源：画布节点标题模糊匹配；执行 = 定位到节点（App 注入 locateNode）。
  const nodeItems: readonly PaletteItem[] = input.nodes.map((node) => ({
    id: `node:${node.id}`,
    title: node.title,
    hint: node.fileType === undefined ? '定位到节点' : `定位 · ${node.fileType}`,
    group: '节点',
    keywords: `${node.title}${node.fileType === undefined ? '' : ` ${node.fileType}`} node 节点`,
  }))

  // 文件源：同 nodes 数据源，按 fileType 过滤；执行 = 选中 + 打开预览（App 注入 openFile）。
  const fileItems: readonly PaletteItem[] = input.nodes
    .filter((node) => node.fileType !== undefined)
    .map((node) => ({
      id: `file:${node.id}`,
      title: node.title,
      hint: `预览 · ${node.fileType}`,
      group: '文件',
      keywords: `${node.title} ${node.fileType} file 文件 预览`,
    }))

  // 五组数据源 → 五个 provider 实例（A3：fetch 原样，包一层 async + snapshot 返回）。
  const actionsProvider = hybridProvider({
    id: 'actions',
    label: '命令',
    fetch: (term) => rankPaletteEntries([...commandItems, ...conversationItems, ...skillItems], term),
  })
  const nodesProvider = hybridProvider({ id: 'nodes', label: '节点', fetch: (term) => rankPaletteEntries(nodeItems, term) })
  const filesProvider = hybridProvider({ id: 'files', label: '文件', fetch: (term) => rankPaletteEntries(fileItems, term) })
  const sessionsProvider = hybridProvider({ id: 'sessions', label: '会话', fetch: (term) => rankPaletteEntries(conversationItems, term) })
  const skillsProvider = hybridProvider({ id: 'skills', label: '技能', fetch: (term) => rankPaletteEntries(skillItems, term) })

  // 执行表：item.id → 回调。面板组件只查表调用；provider 侧零副作用。
  const actions: Record<string, () => void> = {
    'cmd:view-main': input.commands.switchToMainView,
    'cmd:view-context': input.commands.switchToContextView,
    'cmd:view-workflow': input.commands.switchToWorkflowView,
    'cmd:create-text': input.commands.createTextNode,
    ...(input.commands.expandMindmap === null ? {} : { 'cmd:expand-mindmap': input.commands.expandMindmap }),
    'cmd:export-lcosproj': input.commands.exportLcosproj,
  }
  for (const conversation of input.conversations) {
    actions[`receiver:${conversation.id}`] = () => input.commands.switchReceiver(conversation.id)
  }
  for (const skill of input.skills) {
    actions[`skill:${skill.artifactId}`] = () => input.commands.replaySkill(skill.artifactId)
  }
  for (const node of input.nodes) {
    actions[`node:${node.id}`] = () => input.navigation.locateNode(node.id)
    if (node.fileType !== undefined) actions[`file:${node.id}`] = () => input.navigation.openFile(node.id)
  }

  return { providers: [actionsProvider, nodesProvider, filesProvider, sessionsProvider, skillsProvider], actions }
}

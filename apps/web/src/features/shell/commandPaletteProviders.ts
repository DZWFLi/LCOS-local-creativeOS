/**
 * CommandPalette MVP（第一梯队 ⑤）：⌘K 全局命令面板的 provider 层（纯查询，零副作用）。
 * 结构参考 grok-bot CommandPalette：每源一个 provider、可插拔；执行动作全部由
 * App.tsx 装配注入（actions 表按 item.id 寻址），本文件只做数据 → 条目的投影与过滤。
 * 与 grok-bot 的差异（按 LCOS 收口要求）：不抄 8 Tab（合并为单列表按 group 分节）、
 * 无嵌套步骤、无行号快捷键。
 */

/** 面板条目的分组（分节显示顺序见 PALETTE_GROUP_ORDER）。 */
export type PaletteGroupId = '命令' | '节点' | '文件' | '会话' | '技能'

export interface PaletteItem {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly group: PaletteGroupId
  /** 额外检索词（中英文别名）；标题始终参与匹配。 */
  readonly keywords?: string
}

/** 每源一个 provider：query 只做过滤与排序，不产生任何副作用。 */
export interface PaletteProvider {
  /** provider 的主分组（条目自身的 group 决定落节；receiver/技能条目由命令源附带）。 */
  readonly group: PaletteGroupId
  query(term: string): readonly PaletteItem[]
}

/** 分节显示顺序：命令 → 节点 → 文件 → 会话 → 技能。 */
export const PALETTE_GROUP_ORDER: readonly PaletteGroupId[] = ['命令', '节点', '文件', '会话', '技能']

/** 单 provider 单次查询的条目上限：简单列表（无虚拟窗口）下的保护性封顶。 */
const MAX_PROVIDER_ITEMS = 50

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

/** 面板装配结果：providers 喂给组件查询，actions 按 item.id 执行。 */
export interface CommandPaletteAssembly {
  readonly providers: readonly PaletteProvider[]
  readonly actions: Readonly<Record<string, () => void>>
}

/* ---------------- 匹配与排序（纯函数） ---------------- */

/** 相关度评分：标题前缀 3 > 标题包含 2 > 关键词包含 1；不匹配返回 null。空词返回 0（全量）。 */
export function scorePaletteItem(item: PaletteItem, term: string): number | null {
  const needle = term.trim().toLowerCase()
  if (!needle) return 0
  const title = item.title.toLowerCase()
  if (title.startsWith(needle)) return 3
  if (title.includes(needle)) return 2
  if (item.keywords !== undefined && item.keywords.toLowerCase().includes(needle)) return 1
  return null
}

/** 按评分降序（同分保持原序，稳定）并封顶。 */
function queryScored(items: readonly PaletteItem[], term: string): readonly PaletteItem[] {
  const scored = items
    .map((item, index) => ({ item, index, score: scorePaletteItem(item, term) }))
    .filter((entry): entry is { item: PaletteItem; index: number; score: number } => entry.score !== null)
  scored.sort((left, right) => right.score - left.score || left.index - right.index)
  return scored.slice(0, MAX_PROVIDER_ITEMS).map((entry) => entry.item)
}

/** 多 provider 合并：跨 provider 按 id 去重（首见优先），按 PALETTE_GROUP_ORDER 分桶平铺。 */
export function mergePaletteItems(providers: readonly PaletteProvider[], term: string): readonly PaletteItem[] {
  const seen = new Set<string>()
  const buckets = new Map<PaletteGroupId, PaletteItem[]>()
  for (const provider of providers) {
    for (const item of provider.query(term)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      const bucket = buckets.get(item.group)
      if (bucket === undefined) buckets.set(item.group, [item])
      else bucket.push(item)
    }
  }
  return PALETTE_GROUP_ORDER.flatMap((group) => buckets.get(group) ?? [])
}

export interface PaletteSection {
  readonly group: PaletteGroupId
  readonly items: readonly PaletteItem[]
}

/** 平铺条目 → 非空分节（渲染用；保持 PALETTE_GROUP_ORDER 顺序）。 */
export function groupPaletteSections(items: readonly PaletteItem[]): readonly PaletteSection[] {
  return PALETTE_GROUP_ORDER
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0)
}

/* ---------------- 三个 provider 的装配工厂 ---------------- */

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
 * 装配三个 provider（actions 命令源 / nodes 节点源 / files 文件源）与执行表。
 * receiver 会话与技能条目由命令源附带（group 分别为 会话/技能），因为它们的
 * 执行语义（setActiveReceiver / 一键重放）与命令同构：选中即执行。
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

  const actionsProvider: PaletteProvider = {
    group: '命令',
    query: (term) => queryScored([...commandItems, ...conversationItems, ...skillItems], term),
  }

  // 节点源：画布节点标题模糊匹配；执行 = 定位到节点（App 注入 locateNode）。
  const nodeItems: readonly PaletteItem[] = input.nodes.map((node) => ({
    id: `node:${node.id}`,
    title: node.title,
    hint: node.fileType === undefined ? '定位到节点' : `定位 · ${node.fileType}`,
    group: '节点',
    keywords: `${node.title}${node.fileType === undefined ? '' : ` ${node.fileType}`} node 节点`,
  }))
  const nodesProvider: PaletteProvider = {
    group: '节点',
    query: (term) => queryScored(nodeItems, term),
  }

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
  const filesProvider: PaletteProvider = {
    group: '文件',
    query: (term) => queryScored(fileItems, term),
  }

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

  return { providers: [actionsProvider, nodesProvider, filesProvider], actions }
}

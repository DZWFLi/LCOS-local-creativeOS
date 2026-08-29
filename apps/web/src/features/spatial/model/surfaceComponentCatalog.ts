import type { SurfaceComponentType, SurfaceDropKind, SurfaceKind } from './surfaceElementTypes'

export interface SurfaceComponentCapabilityContract {
  readonly type: SurfaceComponentType
  readonly label: string
  readonly description: string
  readonly surfaces: readonly SurfaceKind[]
  readonly minSize: { readonly w: number; readonly h: number }
  readonly movable: boolean
  readonly resizable: boolean
  readonly requiresSelection?: boolean
  /** Human shelf visibility. Agent and semantic operations may still use hidden contracts. */
  readonly showInShelf?: boolean
  readonly acceptsDrop: readonly SurfaceDropKind[]
  readonly capabilities: {
    readonly bind?: boolean
    readonly lens?: boolean
    readonly collapse?: boolean
    readonly removeProjection?: boolean
  }
  /**
   * presentation: honest, usable component that may be created now.
   * adapter-only: binds an existing durable identity and is never free-created.
   * planned: capability is reserved in the catalog but must not surface as a fake empty component.
   */
  readonly createMode: 'presentation' | 'adapter-only' | 'planned'
}

const commonDrop = ['project-view', 'material-transfer'] as const

export const SURFACE_COMPONENT_CATALOG: Readonly<Record<SurfaceComponentType, SurfaceComponentCapabilityContract>> = {
  fence: {
    type: 'fence', label: '旧围栏', description: '兼容旧项目；新建空间组织请使用 Colony。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 220, h: 140 }, movable: true, resizable: true, showInShelf: false,
    acceptsDrop: commonDrop, capabilities: { removeProjection: true }, createMode: 'adapter-only',
  },
  region: {
    type: 'region', label: '旧区域', description: '兼容旧区域投影；新空间范围由 Colony 表达。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 260, h: 170 }, movable: true, resizable: true, showInShelf: false,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
  portal: {
    type: 'portal', label: '入口', description: '指向另一个稳定工作现场，不复制目标内容。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 196, h: 92 }, movable: true, resizable: false,
    acceptsDrop: [], capabilities: { bind: true, lens: true, removeProjection: true }, createMode: 'adapter-only',
  },
  'source-chain': {
    type: 'source-chain', label: '来源', description: '可移动、可展开的来源脉络；引用真实对象，不复制内容。',
    surfaces: ['context'], minSize: { w: 520, h: 126 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
  'structure-map': {
    type: 'structure-map', label: '结构', description: '当前材料的结构 Lens；内部可重算，外框属于 Surface。',
    surfaces: ['context'], minSize: { w: 360, h: 240 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  evolution: {
    type: 'evolution', label: '版本 / 演进', description: '理解顺序与变化的 Lens，不等于项目时间线。',
    surfaces: ['context'], minSize: { w: 380, h: 190 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  'relationship-field': {
    type: 'relationship-field', label: '关系', description: '局部关系观察 Lens，不把 Graph 升格为 Context 本体。',
    surfaces: ['context'], minSize: { w: 380, h: 250 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  'context-pack': {
    type: 'context-pack', label: '旧上下文包', description: '已退役；本次引用与来源组件接管这类临时范围。',
    surfaces: ['context'], minSize: { w: 320, h: 180 }, movable: true, resizable: true, requiresSelection: true, showInShelf: false,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
  stack: {
    type: 'stack', label: '堆叠', description: '一组对象的堆叠视图；只保存真实引用，不复制内容。',
    surfaces: ['main', 'context'], minSize: { w: 216, h: 150 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  compare: {
    type: 'compare', label: '旧对比', description: '已退役为临时对比动作，不再作为长期空间组件。',
    surfaces: ['main', 'context'], minSize: { w: 340, h: 190 }, movable: true, resizable: true, showInShelf: false,
    acceptsDrop: commonDrop, capabilities: { bind: true, removeProjection: true }, createMode: 'adapter-only',
  },
  'workflow-step': {
    type: 'workflow-step', label: '步骤', description: '现有 WorkflowAction 的空间适配；执行语义仍属于真实 Workflow。',
    surfaces: ['workflow'], minSize: { w: 224, h: 76 }, movable: true, resizable: false,
    acceptsDrop: ['project-view'], capabilities: { bind: true }, createMode: 'adapter-only',
  },
  review: {
    type: 'review', label: 'Review', description: '需要人工判断的检查点和变更现场。',
    surfaces: ['workflow'], minSize: { w: 300, h: 170 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
  checkpoint: {
    type: 'checkpoint', label: 'Checkpoint', description: '工作现场里的可恢复检查点投影。',
    surfaces: ['workflow'], minSize: { w: 260, h: 132 }, movable: true, resizable: true,
    acceptsDrop: [], capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
  'active-path': {
    type: 'active-path', label: '行动路径', description: '当前行动骨架的路径投影；灯条流向即执行顺序。',
    surfaces: ['workflow'], minSize: { w: 320, h: 120 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  workbench: {
    type: 'workbench', label: '工作空间', description: '仅兼容既有独立工作空间，不再允许创建万能工作台外壳。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 420, h: 260 }, movable: true, resizable: true, showInShelf: false,
    acceptsDrop: ['project-view', 'file', 'text', 'material-transfer'], capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'adapter-only',
  },
}

export function surfaceComponentContract(type: SurfaceComponentType): SurfaceComponentCapabilityContract {
  return SURFACE_COMPONENT_CATALOG[type]
}

export function surfaceComponentsFor(surface: SurfaceKind, createableOnly = false): SurfaceComponentCapabilityContract[] {
  return Object.values(SURFACE_COMPONENT_CATALOG)
    .filter((entry) => entry.surfaces.includes(surface) && (!createableOnly || (entry.createMode === 'presentation' && entry.showInShelf !== false)))
}

export function surfaceSupportsComponent(surface: SurfaceKind, type: SurfaceComponentType): boolean {
  return SURFACE_COMPONENT_CATALOG[type].surfaces.includes(surface)
}

import type { SurfaceComponentType, SurfaceDropKind, SurfaceKind } from './surfaceElementTypes'

export interface SurfaceComponentCapabilityContract {
  readonly type: SurfaceComponentType
  readonly label: string
  readonly description: string
  readonly surfaces: readonly SurfaceKind[]
  readonly minSize: { readonly w: number; readonly h: number }
  readonly movable: boolean
  readonly resizable: boolean
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
    type: 'fence', label: '围栏', description: '人工组织边界，不拥有内部对象。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 220, h: 140 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { removeProjection: true }, createMode: 'presentation',
  },
  region: {
    type: 'region', label: '语境区', description: '表达共同语境或状态场，不是透明围栏换皮。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 260, h: 170 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  portal: {
    type: 'portal', label: '入口', description: '指向另一个稳定工作现场，不复制目标内容。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 196, h: 92 }, movable: true, resizable: false,
    acceptsDrop: [], capabilities: { bind: true, lens: true, removeProjection: true }, createMode: 'planned',
  },
  'structure-map': {
    type: 'structure-map', label: '结构', description: '当前材料的结构 Lens；内部可重算，外框属于 Surface。',
    surfaces: ['context'], minSize: { w: 360, h: 240 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  evolution: {
    type: 'evolution', label: '演进', description: '理解顺序与变化的 Lens，不等于项目时间线。',
    surfaces: ['context'], minSize: { w: 380, h: 190 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  'relationship-field': {
    type: 'relationship-field', label: '关系场', description: '局部关系观察 Lens，不把 Graph 升格为 Context 本体。',
    surfaces: ['context'], minSize: { w: 380, h: 250 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, lens: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  'context-pack': {
    type: 'context-pack', label: 'Context Pack', description: '把当前选择准备成可读范围，不复制 Project Truth。',
    surfaces: ['context', 'workflow'], minSize: { w: 320, h: 180 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'presentation',
  },
  'workflow-step': {
    type: 'workflow-step', label: '步骤', description: '现有 WorkflowAction 的空间适配；执行语义仍属于真实 Workflow。',
    surfaces: ['workflow'], minSize: { w: 224, h: 76 }, movable: true, resizable: false,
    acceptsDrop: ['project-view'], capabilities: { bind: true }, createMode: 'adapter-only',
  },
  review: {
    type: 'review', label: 'Review', description: '需要人工判断的检查点和变更现场。',
    surfaces: ['workflow'], minSize: { w: 300, h: 170 }, movable: true, resizable: true,
    acceptsDrop: commonDrop, capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'planned',
  },
  checkpoint: {
    type: 'checkpoint', label: 'Checkpoint', description: '工作现场里的可恢复检查点投影。',
    surfaces: ['workflow'], minSize: { w: 260, h: 132 }, movable: true, resizable: true,
    acceptsDrop: [], capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'planned',
  },
  workbench: {
    type: 'workbench', label: 'Workbench', description: 'Surface 只拥有外框，内部工具继续拥有自己的 runtime/domain。',
    surfaces: ['main', 'context', 'workflow'], minSize: { w: 420, h: 260 }, movable: true, resizable: true,
    acceptsDrop: ['project-view', 'file', 'text', 'material-transfer'], capabilities: { bind: true, collapse: true, removeProjection: true }, createMode: 'planned',
  },
}

export function surfaceComponentContract(type: SurfaceComponentType): SurfaceComponentCapabilityContract {
  return SURFACE_COMPONENT_CATALOG[type]
}

export function surfaceComponentsFor(surface: SurfaceKind, createableOnly = false): SurfaceComponentCapabilityContract[] {
  return Object.values(SURFACE_COMPONENT_CATALOG)
    .filter((entry) => entry.surfaces.includes(surface) && (!createableOnly || entry.createMode === 'presentation'))
}

export function surfaceSupportsComponent(surface: SurfaceKind, type: SurfaceComponentType): boolean {
  return SURFACE_COMPONENT_CATALOG[type].surfaces.includes(surface)
}

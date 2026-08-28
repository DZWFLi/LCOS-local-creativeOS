/**
 * F6 Assembly read model contracts（后端同步施工单 P0-B，20260828）。
 *
 * 红线（施工单 §3/§9）：ref 只引用 canonical identity，不复制正文 / membership /
 * relation truth；Material View 与 Relation View 必须读同一份 Project Truth——
 * 这里全部是 read projection，没有第二套 assembly_entities 数据表。
 */

/**
 * Assembly Source Bay 的统一来源引用（P0-B1）。
 * kind 覆盖 Source Bay 四来源（Project/Capture/Sources/Skills）的 canonical 实体：
 * - artifactView / resource / conversation：既有 canonical 实体
 * - capture：Capture staging item（system-level，不属于任何 project）
 * - skill：Skill catalog 条目（system/user/merged 三态 + version）
 * - context / workflow / scene / collection：scope 类 target 兼容引用（只读投影）
 */
export type AssemblySourceRefV1 =
  | { readonly kind: 'artifactView'; readonly id: string }
  | { readonly kind: 'capture'; readonly id: string }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'conversation'; readonly id: string }
  | { readonly kind: 'context'; readonly id: string }
  | { readonly kind: 'workflow'; readonly id: string }
  | { readonly kind: 'scene'; readonly id: string }
  | { readonly kind: 'collection'; readonly id: string }
  | { readonly kind: 'skill'; readonly id: string; readonly source: 'system' | 'user' | 'merged'; readonly version?: string }

/** Assembly Target Scene 的统一目标引用（P0-B3）：入口来自 Project root / Conversation / Context / Workflow / Scene。 */
export type AssemblyTargetRefV1 =
  | { readonly kind: 'project'; readonly id: string }
  | { readonly kind: 'workspace'; readonly id: string }
  | { readonly kind: 'conversation'; readonly id: string }
  | { readonly kind: 'context'; readonly id: string }
  | { readonly kind: 'workflow'; readonly id: string }
  | { readonly kind: 'scene'; readonly id: string }

/** Warehouse 条目实体类型（read model 行的分类，非新 truth）。 */
export type WarehouseEntityKindV1 = 'artifact' | 'note' | 'conversation' | 'resource'

/** Warehouse read model 单行（P0-B2）：Material View 分页/搜索/筛选的最小稳定形状。 */
export interface WarehouseItemV1 {
  readonly schemaVersion: 1
  readonly entityRef: { readonly type: WarehouseEntityKindV1; readonly id: string; readonly viewId?: string }
  readonly kind: WarehouseEntityKindV1
  readonly title: string
  readonly updatedAt?: string
  /** 预览引用（走既有 preview 通道；无则省略）。 */
  readonly previewRef?: string
  /** provenance 摘要（出生来源一行话；GUI 直建 = 省略）。 */
  readonly provenance?: { readonly origin: 'run-return' | 'import' | 'capture' | 'unknown'; readonly birthRunId?: string }
  /** usage/位置计数（workspace memberships 投影）。 */
  readonly usageCount: number
  /** 是否被请求指定的 target 使用（read projection）。 */
  readonly usedHere?: boolean
  /** relation 邻居提示（Relation View 按需；Material View 可省略）。 */
  readonly relationHint?: { readonly neighborCount: number; readonly topKinds: readonly string[] }
}

/** Warehouse 查询参数（P0-B2）：recent/type/source/search/usedHere 四轴 + 分页。 */
export interface WarehouseQueryV1 {
  readonly search?: string
  readonly kinds?: readonly WarehouseEntityKindV1[]
  readonly provenanceOrigin?: 'run-return' | 'import' | 'capture' | 'unknown'
  readonly usedHereTarget?: { readonly kind: 'workspace' | 'scope' | 'conversation'; readonly id: string }
  readonly limit?: number
  readonly cursor?: string
}

export interface WarehouseSnapshotV1 {
  readonly schemaVersion: 1
  readonly projectId: string
  readonly items: readonly WarehouseItemV1[]
  readonly nextCursor?: string
  readonly totalApprox: number
}

/**
 * Semantic Drop 的统一 apply 通道（P0-B4）：sourceRef(s) + targetRef → Core 解析成
 * 既有 canonical mutation（Context/Presentation membership、relation、capture
 * materialize 等）。本 contract 只描述请求/结果形状；实际写仍走各 canonical 服务，
 * 绝不产生第二套 membership。
 */
export interface AssemblyApplyRequestV1 {
  readonly schemaVersion: 1
  readonly projectId: string
  readonly sourceRefs: readonly AssemblySourceRefV1[]
  readonly targetRef: AssemblyTargetRefV1
}

export interface AssemblyApplyItemResultV1 {
  readonly sourceRef: AssemblySourceRefV1
  readonly status: 'applied' | 'skipped' | 'failed'
  /** 实际写入的 canonical 通道（前端可见的"写了哪条 truth"）。 */
  readonly channel: 'workspace-membership' | 'relation' | 'capture-materialize' | 'already-member' | 'unsupported' | 'error'
  readonly message?: string
}

export interface AssemblyApplyResultV1 {
  readonly schemaVersion: 1
  readonly projectId: string
  readonly results: readonly AssemblyApplyItemResultV1[]
  /** fail-close：任一 failed 且无 applied 时整体视为失败；partial 时前端如实展示。 */
  readonly allApplied: boolean
  readonly changeSetId?: string
}

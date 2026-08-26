/**
 * SpaceVfs V0 — 任务四 P1：虚拟 /space/ 命名空间（借鉴 huabu ACP fs 沙箱，MIT）。
 * Agent 以稳定的人类可读路径（/space/nodes/<safeLabel>.md）寻址项目节点。
 * 边界纪律（huabu 同构）：命名空间只读——读取记 full-read lease，
 * 写入一律走 CAS 守卫的 curation/text 通道，本命名空间不提供写。
 */

export interface SpaceListNodeV0 {
  /** 完整虚拟路径（含 /space/ 前缀），Agent 的稳定寻址句柄。 */
  readonly path: string
  readonly artifactId: string
  readonly title: string
  readonly revisionId: string
  /** 版本 token（contentHash）：供「读后是否被改」比对。 */
  readonly contentHash: string
  /** L1 扫描头（折叠空白截 120 字，node-ref 同构参数）；无文本内容时省略。 */
  readonly preview?: string
}

export interface SpaceListResultV0 {
  readonly items: readonly SpaceListNodeV0[]
  readonly generatedAt: string
}

export interface SpaceReadResultV0 {
  readonly path: string
  readonly artifactId: string
  /** 主 view（若存在）：供后续 curation/text 定向写入。 */
  readonly viewId?: string
  readonly revisionId: string
  readonly contentHash: string
  readonly content: string
  readonly truncated: boolean
}

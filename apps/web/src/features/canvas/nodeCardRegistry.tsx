import type { ComponentType } from 'react'

import type { CanvasNode } from '../../model'
// 仅类型导入（编译期擦除，运行时不构成环）：渲染器 props 契约以 CanvasNodeVisual 的分发 props 为准。
import type { Props as CanvasNodeVisualProps } from './CanvasNodeVisual'

/**
 * 卡片 Registry 薄层平移（施工单 §4.7 第一步，第一梯队 ③）
 *
 * 目标：把 CanvasNodeVisual.tsx 里的节点类型分支逐步平移成 `key → renderer` 注册表，
 * 新增卡片类型只需注册、不需改分发逻辑（ToolResultCard / RunOutlinePanel 的卡后续也挂这里）。
 *
 * 风险控制（施工单原话：薄层平移不分大步）：
 * - 20260826 做实：context 族四类卡（workflow/workspace/context/collection）已全量入表，
 *   宿主分发查表即走；file 族仍由 ContentObject 内部分发，后续按 file:<type> 迁移；
 * - 查表未命中时 resolveNodeCard 返回 undefined，调用方 fallback 到 CollectionObject
 *   （未知 entityKind 的行为兜底，非错误路径）。
 *
 * 注册方向：由宿主（CanvasNodeVisual）在模块底部自注册，本文件不反向 import 渲染器，
 * 运行时依赖单向（CanvasNodeVisual → nodeCardRegistry），无循环。
 */

/** 卡片渲染器：接收 CanvasNodeVisual 的完整分发 props（与既有各 *Object 组件同契约）。 */
export type NodeCardRenderer = ComponentType<CanvasNodeVisualProps>

/**
 * 判别组合键：entityKind（collection/context/workflow/workspace/conversation）优先，
 * 无 entityKind 时退到 fileType（小写归一），都没有则落 default 桶。
 * 后续 file 类卡片按 `file:<type>` 注册即可，不需要改键规则。
 */
export function nodeCardKey(node: CanvasNode): string {
  if (node.entityKind) return `entity:${node.entityKind}`
  if (node.fileType) return `file:${node.fileType.toLowerCase()}`
  return 'default'
}

/** 注册表本体：key 为 nodeCardKey 派生的组合键。context 族已全量预置，file 族逐步扩充。 */
export const NODE_CARD_REGISTRY: Record<string, NodeCardRenderer> = {}

/** 注册一张卡（同名键后写覆盖先写，方便测试与后续宿主按需重挂）。 */
export function registerNodeCard(key: string, renderer: NodeCardRenderer): void {
  NODE_CARD_REGISTRY[key] = renderer
}

/**
 * 查表：命中返回渲染器；未命中返回 undefined，调用方须 fallback 到既有 switch 分支
 * （fallback 语义是本层的行为零变化保证，不是错误路径）。
 */
export function resolveNodeCard(node: CanvasNode): NodeCardRenderer | undefined {
  return NODE_CARD_REGISTRY[nodeCardKey(node)]
}

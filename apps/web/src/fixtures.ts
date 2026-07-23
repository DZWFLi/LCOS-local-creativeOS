import type { CanvasEdge, CanvasNode, CanvasScope, ProjectPackage, Workspace } from './model'

const createdAt = '2026-07-21T00:00:00.000Z'
const ROOT_SCOPE = 'scope-root'
const REFERENCE_SCOPE = 'scope-reference'

export const fixtureProjects: ProjectPackage[] = [
  { id: 'project-portasplit', label: 'PortaSplit', localPath: 'C:/Creative/Projects/PortaSplit', updatedAt: '今天 10:24', pendingCount: 1 },
  { id: 'project-huaxin', label: '华新出海 VI', localPath: 'C:/Creative/Projects/Huaxin-VI', updatedAt: '昨天 18:10', pendingCount: 0 },
]

export const fixtureScopes: CanvasScope[] = [
  { id: ROOT_SCOPE, label: '项目主画布', kind: 'root', parentScopeId: null, camera: { x: 92, y: 42, zoom: .94 } },
  { id: REFERENCE_SCOPE, label: '参考与锁定元素', kind: 'context', parentScopeId: ROOT_SCOPE, containerNodeId: 'reference', camera: { x: 210, y: 112, zoom: 1.02 } },
]

export const fixtureWorkspaces: Workspace[] = [
  { id: 'understand', label: '客户原始需求', intent: 'understand', scopeId: ROOT_SCOPE, camera: { x: 214, y: 62, zoom: 1.08 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['brief', 'feedback', 'proposal'], contextPolicy: 'workspace-related', createdAt, updatedAt: createdAt },
  { id: 'explore', label: 'Thinker 创意探索', intent: 'explore', scopeId: ROOT_SCOPE, camera: { x: 58, y: 48, zoom: .96 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['reference', 'proposal', 'generated'], contextPolicy: 'workspace-related', createdAt, updatedAt: createdAt },
  { id: 'build', label: '15 秒脚本与分镜', intent: 'build', scopeId: ROOT_SCOPE, camera: { x: -105, y: -25, zoom: 1 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['proposal', 'run-042', 'generated'], contextPolicy: 'workspace-related', createdAt, updatedAt: createdAt },
  { id: 'decide', label: '第二轮客户反馈', intent: 'decide', scopeId: ROOT_SCOPE, camera: { x: -235, y: -115, zoom: 1.04 }, visibleLayers: ['core', 'process'], focusedNodeIds: ['feedback', 'generated', 'checkpoint'], contextPolicy: 'workspace-related', createdAt, updatedAt: createdAt },
]

export const fixtureNodes: CanvasNode[] = [
  { id: 'brief', artifactId: 'artifact-brief', kind: 'source', title: '品牌简报.pptx', subtitle: '飞书快照 · 12 页', x: 40, y: 118, width: 264, height: 190, displayMode: 'standard', pageCount: 12, scopeId: ROOT_SCOPE, editable: false, contextOnly: true, workspaceIds: ['understand','explore'] },
  { id: 'feedback', artifactId: 'artifact-feedback', kind: 'source', title: '客户反馈.md', subtitle: '07/17 · 已同步', x: 48, y: 404, width: 264, height: 190, displayMode: 'standard', scopeId: ROOT_SCOPE, editable: false, contextOnly: true, workspaceIds: ['understand','decide'] },
  { id: 'reference', artifactId: 'artifact-reference-collection', kind: 'context', title: '参考与锁定元素', subtitle: '3 张参考图 · 1 条锁定规则', x: 372, y: 72, width: 236, height: 144, displayMode: 'standard', scopeId: ROOT_SCOPE, opensScopeId: REFERENCE_SCOPE, editable: false, contextOnly: true, workspaceIds: ['understand','explore'] },
  { id: 'proposal', artifactId: 'artifact-proposal', revisionId: 'revision-proposal-v3', followsCurrentRevision: true, kind: 'working', title: 'Thinker_Concept_V3.pptx', subtitle: 'V3 · 第 6 页有备注', x: 432, y: 286, width: 320, height: 246, displayMode: 'expanded', current: true, pageCount: 18, scopeId: ROOT_SCOPE, editable: true, workspaceIds: ['understand','explore','build','decide'] },
  { id: 'run-042', kind: 'process', title: 'RUN-042 · 修改第 5 页利益点', subtitle: '已完成 · 1 个文件已修改', x: 474, y: 578, width: 238, height: 82, displayMode: 'standard', scopeId: ROOT_SCOPE, runStatus: 'completed', workspaceIds: ['understand','build'] },
  { id: 'generated', artifactId: 'artifact-proposal', revisionId: 'revision-proposal-v4-draft', followsCurrentRevision: false, kind: 'generated', title: 'Thinker_Concept_V4_AI.pptx', subtitle: '结果待回收 · 等待确认', x: 858, y: 278, width: 264, height: 190, displayMode: 'standard', draft: true, pageCount: 18, scopeId: ROOT_SCOPE, editable: true, parentRunId: 'RUN-042', revisionOf: 'proposal', workspaceIds: ['understand','build','decide'] },
  { id: 'checkpoint', kind: 'decision', title: '方向确认点', subtitle: '保留品牌蓝 · 不改封面', x: 862, y: 526, width: 252, height: 114, displayMode: 'standard', scopeId: ROOT_SCOPE, workspaceIds: ['understand','decide'] },
  { id: 'activity', kind: 'process', title: '早期执行', subtitle: '已收拢到活动记录', x: 742, y: 690, width: 190, height: 66, displayMode: 'compact', scopeId: ROOT_SCOPE, runStatus: 'completed', workspaceIds: ['understand'] },

  { id: 'ref-view-1', artifactId: 'artifact-ref-1', kind: 'source', title: '参考图_客厅构图.jpg', subtitle: '本地图片 · 已链接', x: 80, y: 130, width: 264, height: 190, displayMode: 'standard', scopeId: REFERENCE_SCOPE, editable: false, contextOnly: true },
  { id: 'ref-view-2', artifactId: 'artifact-ref-2', kind: 'source', title: '参考图_雕像比例.jpg', subtitle: '本地图片 · 已链接', x: 390, y: 130, width: 264, height: 190, displayMode: 'standard', scopeId: REFERENCE_SCOPE, editable: false, contextOnly: true },
  { id: 'ref-view-3', artifactId: 'artifact-ref-3', kind: 'source', title: '参考图_产品距离.jpg', subtitle: '本地图片 · 已链接', x: 700, y: 130, width: 264, height: 190, displayMode: 'standard', scopeId: REFERENCE_SCOPE, editable: false, contextOnly: true },
  { id: 'locked-elements', kind: 'decision', title: 'Locked Elements', subtitle: '0–6 秒拉镜 · 三句字幕', x: 390, y: 390, width: 292, height: 142, displayMode: 'expanded', scopeId: REFERENCE_SCOPE },
]

export const fixtureEdges: CanvasEdge[] = [
  { id: 'brief-proposal', from: 'brief', to: 'proposal', kind: 'reference' },
  { id: 'feedback-proposal', from: 'feedback', to: 'proposal', kind: 'feedback' },
  { id: 'reference-proposal', from: 'reference', to: 'proposal', kind: 'reference' },
  { id: 'proposal-run', from: 'proposal', to: 'run-042', kind: 'modify' },
  { id: 'run-output', from: 'run-042', to: 'generated', kind: 'generate' },
  { id: 'proposal-generated', from: 'proposal', to: 'generated', kind: 'modify' },
  { id: 'generated-checkpoint', from: 'generated', to: 'checkpoint', kind: 'reference' },
  { id: 'ref-1-lock', from: 'ref-view-1', to: 'locked-elements', kind: 'reference' },
  { id: 'ref-2-lock', from: 'ref-view-2', to: 'locked-elements', kind: 'reference' },
  { id: 'ref-3-lock', from: 'ref-view-3', to: 'locked-elements', kind: 'reference' },
]

export function makePerformanceFixture(count: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const kinds: CanvasNode['kind'][] = ['source', 'working', 'generated', 'context', 'process', 'decision']
  const nodes = Array.from({ length: count }, (_, index) => {
    const kind = kinds[index % kinds.length]
    const col = index % 10
    const row = Math.floor(index / 10)
    return { id: `perf-${index}`, kind, title: `${kindMeta(kind)} ${String(index + 1).padStart(3, '0')}`, subtitle: '性能测试对象', x: col * 190 + 40, y: row * 145 + 80, width: kind === 'process' ? 180 : 210, height: kind === 'process' ? 72 : 118, scopeId: ROOT_SCOPE, current: kind === 'working' && index === 1, draft: kind === 'generated' && index === 2, error: index === 5, disabled: index === 6 } satisfies CanvasNode
  })
  const edges = nodes.slice(1).map((node, index) => ({ id: `perf-edge-${index}`, from: nodes[index].id, to: node.id, kind: index % 4 === 0 ? 'reference' : 'modify' } satisfies CanvasEdge))
  return { nodes, edges }
}

function kindMeta(kind: CanvasNode['kind']) { return kind === 'process' ? '执行' : kind[0].toUpperCase() + kind.slice(1) }

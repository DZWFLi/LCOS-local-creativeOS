# N2 — Huabu 外部输入/拖放 helper 审计（R2）

> Pinned SHA：`microsoft/Huabu @ 2d3618b559576cbdd0fe2a58a7b200a84a6f4d09`
> Local reference：`E:\Codex 项目\huabu-reference\Huabu-current`（shallow, depth 1）
> 依据：`docs/provenance/HUABU_DIRECT_REUSE_POLICY_20260812.md`

## 结论

**DIRECT PORT：0 项。ADAPT 参考：2 项。REJECT：3 项。**

LCOS 的 Canvas 输入栈（SpatialCanvas + ProjectCanvas + canvasClipboard + trackSegments +
presentationHierarchy）已覆盖 Huabu 这些 helper 的等效能力；本轮**不复制任何 Huabu 代码**。

## 审计表

| Upstream path | SHA | Function/Range | Decision | LCOS target | Dependencies | Attribution |
|---|---|---|---|---|---|---|
| `apps/web/src/components/Panels/Canvas/canvasInputPolicy.ts` | 2d3618b | isPanelTarget / closestNodeElement / isEmptyPaneTarget / tool resolution | REJECT | SpatialCanvas 自研命中 | React Flow DOM selectors（`.react-flow__*`），LCOS 不自带 | —（仅审阅） |
| `apps/web/src/components/Panels/CanvasLayerPanel/dropResolver.ts` | 2d3618b | computeCollision / resolveDrop（before/into/after zone 比例 + frame 出入 + 环拒绝） | ADAPT（参考） | Mind Map before/inside/after（presentationHierarchy.moveHierarchySubtreeAfter）与 Signal Track 插入段（trackSegments.insertTrackSegment）已有等价实现；zone 比例细节可作为未来微调参考 | framework-agnostic，但绑定 Huabu frame 树 | MIT notice 保留于 policy 文档 |
| `apps/web/src/handler/canvasCommand/resolvers/resolvePasteClipboard.ts` | 2d3618b | id remap / 统一偏移 / frame hit-test / edge remap / selectOnCreate | REJECT | LCOS `canvasClipboard.pasteCanvasNodes` 已实现 id remap + 重叠避让 + 选中新建（等价）；Huabu label dedupe 语义不适用（LCOS 标题模型不同） | Huabu node/edge 模型 + frame | —（仅审阅） |
| `apps/web/src/components/Panels/Canvas/StructuredDropOverlay.tsx` | 2d3618b | 结构化 drop 指示（tracks/rows bands + drop mark） | REJECT | 绑定 ReactFlow flowToScreenPosition + Frame 轨道模型；LCOS 已有 drop cue/ghost 机制 | ReactFlow + Frame 业务模型 | —（仅审阅） |

## 不复制项（brief 禁止）

- Huabu Canvas root / Space 创建 / 存储 / Agent-Chat shell / Frame 本体：全部 REJECT。
- 任何 DIRECT PORT 均未发生，因此本审计无新增 MIT notice 文件（policy 已预留记录位）。

## 与 LCOS 现状的差距（非复制，待实现）

- N5-N8（桌面 Quick Capture / Assistant / Browser wake / Native OLE）Huabu 也没有等效实现，
  属 LCOS Runtime Host 独立工程，见 `NON_GUI_R2_PHASE1_AUDIT_20260812.md`。

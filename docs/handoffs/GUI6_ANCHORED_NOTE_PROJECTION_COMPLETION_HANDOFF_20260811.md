# GUI-II-6 Handoff｜Anchored Note 投影 + 渲染器切换验收

## Status
COMPLETE

## Before

- Core `notes` 实体（project / scope / artifact / artifact_view / page 五类锚点）已有 CRUD 与归属守卫，但前端 `mapGraphToState` 完全丢弃 `graph.notes`，画布上看不到任何 Core Note。
- GUI Gate 4.5「Anchored Note 定位」为 NOT DONE：没有 anchorRefs 概念、没有相机定位、没有脉冲高亮。
- 渲染器切换（Free / Outline / MindMap / Graph）此前只确认「能开」，未验证 membership/hierarchy/pinned 在切换后不丢。
- WorkflowSurface 已无 Stage/Next Step/Skill start 残留（本阶段只做再确认）。

## Huabu sources read

未直接读 Huabu 源码；本切片复用 LCOS 既有 Core NoteAnchor 与相机体系，仅借鉴「点击备注 → 定位锚点对象」的交互语义（GUI-4 文档定义）。

## Pattern adopted/adapted/rejected

- ADAPT：Core Note 作为只读投影节点（`kind: 'note'`），`anchors` 字段与 domain `NoteAnchor` 同构。
- ADAPT：备注定位 = 相机 fit 到锚点目标 + 1.8s 脉冲高亮 + 选中目标。
- KEEP LCOS：备注不写回 Artifact（`diffStateToOps` 已排除 note kind，绝不反向持久化）。
- REJECT：不把 Note 变成 Comment Domain / 不引入新实体。

## LCOS files changed

- `apps/web/src/model.ts`：`CanvasNode.noteBody` + `anchors`（`CanvasNoteAnchor`）。
- `apps/web/src/runtime/runtimeBridge.ts`：`mapGraphToState` 投影 `graph.notes`：
  - 锚点解析（artifact_view / artifact / page / scope），优先放在锚点目标下方（碰撞检测），碰撞或不可解析时放到内容右侧纵向堆叠（不再与网格重叠）；
  - 投影一条 `scope: 'presentation'` 的 system 边（备注 → 锚点目标），只读展示。
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`：NoteObject 渲染正文摘要 +「定位」按钮。
- `apps/web/src/features/canvas/ProjectCanvas.tsx`：`onLocateNode` + `locatePulseId` 透传，节点 `locate-pulse` class。
- `apps/web/src/App.tsx`：`locateNote`（解析锚点 → 相机 fit → 选中 → 脉冲计时）。
- `apps/web/src/product-interface.css`：定位按钮与脉冲动画。
- `apps/web/tests/runtimeBridge.test.ts`：3 个新用例（artifact_view 锚点投影、project 锚点兜底位置、note 永不序列化为 artifact）。

## State ownership impact

- Note 节点是纯投影：位置由锚点目标推导，用户移动备注节点不会写 Core（`diffStateToOps` 过滤 note kind，删除扫掠同样排除）。
- `pres-golden-arrange` 等 Presentation 位置仍是 committed truth；备注定位只改 camera + selection，不改 Presentation。

## Real browser acceptance

`node .codex-runtime/gui6-verify.mjs` 22/22 PASS：

- 样例项目两条 Core Note（project 锚点 + artifact_view 锚点）投影为画布节点，定位按钮存在；
- 点击定位 → 相机移动到 `view-feedback`（before/after box 位移证据）+ `locate-pulse` 生效并在 1.8s 后清除；
- reload 后两条备注仍在（Core 是唯一事实源，刷新即恢复）；
- 上下文 lens 打开且无强制 Source Picker；大纲 / 思维导图 / 关系三种投影切换成功；
- 回到整理视图 membership 不变（2906 节点集合 before==after）；
- Workflow 表面无 Skill start / Stage / Next Step 文案；
- 单选后近场 composer 出现，Context 自动装配（peek 102 chips 可人工修正），全程无选择来源弹窗。

## Screenshots

`.codex-runtime/gui6-01-note-projected.png` … `gui6-10-selection-context.png`（10 张）

## 1366 impact

无新增固定宽度控件；备注节点宽度 232 世界单位，随画布缩放，1366 下无溢出（GUI-7 硬门再验）。

## Tests

- `npx vitest run apps/web/tests/runtimeBridge.test.ts`：13/13（含 3 个新增）
- `npm run check:fast`：lint → typecheck → web 296/296 → core 362/362 → arch 104/104 → build 全绿

## Explicitly not copied

- 未复制 Huabu Note/Comment 实现；未改 Core 数据模型；未新增坐标字段到 notes 表。

## Remaining
NONE（本切片范围）

## Commit
`dfd816f`（GUI-6 主体）；本轮追加的位置碰撞/间距修正并入 GUI-7 提交。

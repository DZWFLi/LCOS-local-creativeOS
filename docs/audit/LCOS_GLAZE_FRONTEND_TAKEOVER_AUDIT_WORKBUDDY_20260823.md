# LCOS 0.1 Glaze 前端接管审计报告（WorkBuddy 首轮）

> 交接单：`LCOS_BUDDY_GLAZE_FRONTEND_TAKEOVER_20260823.md`（Codex → WorkBuddy）
> 审计日期：2026-08-23　执行人：WorkBuddy（T）
> 状态：**首轮只读审计（完成）**；未通过 Dz/Codex 确认前不改代码、不 Push
> 证据规范：所有断言带 `文件:行号`，仓库根 = `E:\Codex 项目\OS开发\rc-0.1-windows\LCOS_FULLSTACK_0.1_GUI_CACHE_WINDOWS_RC_20260818`，前端 = `apps/web/src/features/`

---

## 0. 仓库现场核对（§2 校验，全部通过）

```text
分支：feat/spatial-component-foundation
HEAD：99b6cea docs: hand off Glyth and context foundation   ← 与接管单一致
领先 origin 43 个提交（本地已收口，未推送）
工作区：无已跟踪改动，git diff --check 干净
未跟踪历史文件（属既有现场，不动不提交）：
  LCOS_spatial_interaction_layer_finalization_v04.patch
  LCOS_spatial_interaction_layer_finalization_v04_BUDDY.md
  LCOS_spatial_surface_foundation_integrity_followup_v2.patch
  一个历史乱码目录
```

前端源码主目录：`spatial/`（空间底座）、`surfaces/`（三现场视图）、`canvas/`（项目主画布）、`presentation/`、`workbench/`、`state/`（持久化镜像）。

---

## 1. 偏差总览（§6.2 逐条核实）

| # | 接管单判断 | 核实 | 关键证据 |
|---|---|---|---|
| 1 | 统一 SurfaceFrame 绑架形态 | ✅ 证实 | SurfaceComponentLayer.tsx:58 无条件包裹；见 2.1 |
| 2 | Workbench 只能拖标题标签 | ✅ 证实 | SurfaceFrame.tsx:86 仅 chrome 可 begin('move')；见 2.2 |
| 3 | Glaze 被缩成少量组件入口 | ✅ 证实 | Main 现场 Shelf 仅「区域+Workbench」；见 2.3 |
| 4 | Matrix Activity 被弱化/遗漏 | ✅ 证实 | MatrixActivity.tsx:5-8 仅 active+density 布尔；见 3.5 |
| 5 | Light Segment 没成空间骨架 | ✅ 证实 | LightSegment.tsx 纯 CSS 短线，无进度/checkpoint；见 3.7 |
| 6 | Glyth 只是技术上会动 | ✅ 证实 | 无 gaze/blink、无真轮廓 morph、固定 0.42s；见 3.1-3.3 |
| 7 | Context/Workflow 未真正由积木长出 | ⚠️ 部分证实 | 已有空间底座+积木，但旧整页 renderer 仍并列存在；见 2.6 |
| 8 | Agent Composer 没有可用 Glaze 语言 | ⚠️ 部分证实 | Preview/Keep/Revert 真实存在，但只有 5 种可建积木；见 2.5 |

---

## 2. 架构层审计

### 2.1 SurfaceFrame = 唯一物理形态（P0，实锤）

`SurfaceComponentLayer.tsx:58-71` 把**每种** element 无条件包进 `SurfaceFrame`，再注入各类型 renderer 作为 children。`SurfaceFrame.tsx` 的结构固定为：

- 标题栏 chrome（:86）：`label` + pin(`●/○`) + collapse(`−/＋`) + remove(`×`) 按钮
- 内容区（:94）
- 右下角缩放柄（:95，`definition.resizable` 时出现）

结论：**组件内容永远无法决定自身物理形态**——Fence 是框、Region 是框、Workbench 也是框，差异只在内层 children 和 label。数据层连"形态"字段都没有（见 2.4）。

### 2.2 拖动入口 = 仅标题栏（P1）

`SurfaceFrame.tsx:86`：`onPointerDown={(event) => begin('move', event)}` 只挂在 `.lcos-surface-component-chrome` 上；`:95` resize 只挂在右下角柄上。**组件 body 不能直接拖**（body 的 pointerdown 只做 select，:84）。Workbench 组件（WorkflowComponentRenderers.tsx:41-46）内部有 `WebWorkbench` 内容区，同样只有 chrome 可拖——接管单 §6.2 #2 完全成立。

附带正面发现：`SurfaceComponentLayer.tsx:27-51` 有**移动时对齐参考线**（threshold 6px，吸附到其他组件中心/边）——物理辅助已有雏形，可保留升级。

### 2.3 Shelf 实际可建积木（P1，数量少）

`SurfaceComponentShelf.tsx:29` 用 `surfaceComponentsFor(surface, true)`（= createMode==='presentation' 且 showInShelf!==false）：

- **Main**：region、workbench（fence 被 showInShelf:false 隐藏；portal 是 adapter-only）
- **Context**：region、structure-map、evolution、relationship-field、context-pack、workbench
- **Workflow**：region、workbench

对比接管单 §5.5 能力目录：Structure/Evolution/Relationship 在 Context 有，但 **Main 只有 2 个**；workflow-step/review/checkpoint 全是 `adapter-only`（不可自由创建，需绑定真实对象）；Stack/Slot/ChangeSet/Artifact/Compare/Source Stack 等**完全不在 Catalog**（surfaceComponentCatalog.ts:31-92 共 12 种）。Shelf→拖拽→Drop→create 管线本身完整（beginDrag/create/worldPointAt，:76-112），缺的是"砖头种类"。

### 2.4 数据模型不支持自由形态（P0，结构性）

`packages/contracts/src/presentations.ts:165-173`：

```ts
interface SurfaceElementV0 {
  id; projectId; surface; type;
  bounds: { x, y, w, h };            // 只支持矩形
  binding?;                           // 仅 identity 引用（正确）
  presentation?: { pinned?; collapsed?; zIndex?; variant? };  // variant 是字符串
}
```

- **无 shape/form 字段**：非矩形、旋转、拼接、自由轮廓在数据层不存在
- `variant: string` 目前被当"语义标签"用（organize 的 hint、workbenchKind、agent-tool:xxx，surfaceIntent.ts:62-67）——可以承载形态选择但当前没被用作形态
- 正面：`binding` 只存 identity 不存实体副本（契约注释 :118-120），**没有复制 Entity**，符合硬约束

### 2.5 AgentSurfaceComposer（⚠️ 部分成立）

- 三现场都接了真实管线：main（ProjectCanvas.tsx:780）、context（ContextSpaceSurface.tsx:176）、workflow（WorkflowSurface.tsx:499）
- 链路完整：`AgentSurfaceComposer`（选 intent）→ `resolveSurfaceIntent`（surfaceIntent.ts:47，intent→op）→ `SurfaceComponentProposalLayer`（预览）→ onKeep 应用 / onRevert 清空（ContextSpaceSurface.tsx:171）
- **但**：`surfaceIntent.ts:32-39` 的 intent→组件映射只有 5 种（structure-map/evolution/review/workbench/region），14 种 intent 大部分映射到同一个 workbench/region；Composer 的 choices 面板（AgentSurfaceComposer.tsx:7-20）在 Main 只有 2 项、Workflow 只有 1 项。**Agent 能"组织"，但组织不出有轻重、结构、逻辑和活性的界面**——因为 Catalog 就这点砖。

### 2.6 Context / Workflow 视图关系（⚠️ 部分成立）

- 新的空间底座已落地：ContextSpaceSurface.tsx:196 / WorkflowSurface.tsx:567 都渲染 `SurfaceComponentLayer`（真积木）；main 走 ProjectCanvas surfaceMode='project'
- **但**旧的整页 renderer 仍并列：`ContextLensSwitch`（ContextSpaceSurface.tsx:182）在 context-space 与 ContextGraphSurface/ContextFlowSurface/ContextTreeSurface 间切换——这些旧视图**不是**可移动组件/Lens 组件，仍是整页预置渲染器
- 结论：Context/Workflow 正在"由积木长出"的途中，但旧 renderer 未降级为可移动 Lens，两套并存造成心智分叉

### 2.7 持久化（✅ 健康）

`state/presentationDraftState.ts:168-192` `usePresentationSurfaceElements`：内存 + `mirror()` 走 Core Presentation bridge，落 PresentationStateV0.surfaceElements / surfaceBootstrapVersion。三现场各自的 key 隔离（`keyOf(projectId, scopeId, renderer)`）。**不动 Project Truth、只存展示几何 + identity binding**——符合硬约束。

### 2.8 Semantic Drop（✅ 部分存在）

`spatial/semanticDrop.ts`：多触发（右键拖 / Alt+主键拖 / `data-semantic-drop-handle`），目标 = `[data-project-view-drop-target]`，"Source objects never move"，只投影同一实体到另一现场。另有 `semanticRightDrop.ts` 变体。**投影/绑定链路真实存在**，与接管单假设的"Entity Drop → Projection/Binding"一致。

### 2.9 交互机器（✅ 有基础）

`spatialInteractionMachine.ts`：纯函数指针会话（pan/marquee/node-drag，:4-48），可测。`spatialCamera.ts` / `spatialLod.ts` / `spatialHitTest.ts` 配套。

### 2.10 三现场共享底座

Main（ProjectCanvas 内嵌 spatial surface 模式）/ Context（ContextSpaceSurface）/ Workflow（WorkflowSurface）都走 `SurfaceComponentLayer + SpatialCanvas 系`，共享同一套积木、Catalog、Ops、物理——**"同一套积木不做三套软件"的架构骨架已成立**；不共享 camera/selection/presentation 状态（各自 state key 隔离）。

---

## 3. 视觉层审计（摘要，详见上轮报告）

| 项 | 结论 |
|---|---|
| LcosGlyth 元素 | 方核✅ 竖线眼✅ 四段开壳✅ 轮廓 morph⚠️(仅矩形插值) 眼神运动❌(完全缺失) |
| 状态机 | stable/focus/working/waiting/blocked/protected/candidate；**缺 confirm/absorb/output**，conflict 并入 blocked |
| 时钟 | 采样器 clock-free ✅（sampleGlyth 纯函数可测）；运行共享单 rAF 节流 30fps ✅；无 frozenAt 组件级冻结 |
| 与 Bloub 差距 | 最大：gaze/blink 无、轮廓不能 morph；方法论：POSES 全手写魔法数、无测量校准；可测性：无黄金帧断言 |
| 挂载 | 画布节点角标 16px/0.46 透明度/**无条件挂载**（ProjectCanvas.tsx:1162）——最弱且带性能隐患；面板级 22-24px 正常；**连线端、启动画面无 Glyth** |
| MatrixActivity | Props 仅 `{active, density}`，active=working 布尔，单色紫，CSS 固定波纹——**本质是指示灯**，六语义全无 |
| LightSegment | 纯 CSS 发光短线，props 仅 axis/active/length——**无进度/checkpoint/路径能力** |
| spatialSignal | Presentation-only 解析器（:21-24），分层健康，唯一决策点 ✅ |
| Reduced Motion | 视觉层统一（hook+停表+CSS 类）✅；视觉层外 30+ 处独立 media query 散落 ❌ |
| 性能风险 | ①节点角标无条件挂载+每帧 querySelector×3(未缓存)+setAttribute ②drop-shadow 滤镜每实例每帧 ③全 DOM 无 WebGL |
| 测试 | glyth-motion 3 用例（区间断言，无黄金帧）；Matrix/LightSegment/useReducedSpatialMotion **零测试** |

---

## 4. 交互流程（§7.2，真实链路）

```text
① Shelf → Drag/Ghost → Drop → Create → Persistence
   SurfaceComponentShelf.beginDrag/create (Shelf.tsx:76-112)
   → applySurfaceOp create-component (surfaceOps.ts:28-35,60)
   → onElementsChange → usePresentationSurfaceElements.mirror (presentationDraftState.ts:181-190)
   验证：surfaceComponentsFor + requiresSelection 门控 (Shelf.tsx:29)

② Component pointer → Move/Resize → SurfaceOp → Persistence
   SurfaceFrame.begin (SurfaceFrame.tsx:34-77) → onBoundsCommit
   → SurfaceComponentLayer.commitBounds → applySurfaceOps [move|resize] (surfaceOps.ts:39-49)
   → 同一 mirror 持久化；pinned 不可 move/resize (surfaceOps.ts:41,47)
   附带：对齐参考线 preview (SurfaceComponentLayer.tsx:27-47)

③ Entity Drop → Projection/Binding
   semanticDrop.beginSemanticDrop (semanticDrop.ts) — 右键/Alt/手柄触发
   → 投影到 [data-project-view-drop-target]，source 不动
   → SurfaceBinding 仅存 identity (presentations.ts:145-156)

④ Agent Intent → Catalog → Ops → Preview/Keep/Revert
   AgentSurfaceComposer (三现场) → resolveSurfaceIntent (surfaceIntent.ts:47-80)
   → SurfaceComponentProposalLayer 预览 → onKeep 应用 / onRevert 清空
   （ProjectCanvas.tsx:780,985 / ContextSpaceSurface.tsx:171,176,197 / WorkflowSurface.tsx:499,568）

⑤ Visual state → Light/Matrix/Glyth
   spatialSignal.resolveSpatialSignal (spatialSignal.ts:25-43) — 唯一决策点
   → glyph / matrixActive / segmentActive 三布尔分发到视觉原语
```

**链路完整性评估**：①②④⑤全部真实可用；③只有投影入口，绑定后的"从绑定关系反向构建组件"（如 source-chain/review 从 binding 自动长出）仍需在 renderers 里验证。缺的是**宽度**（砖的种类/形态）不是**管道**。

---

## 5. 偏差矩阵（§7.3）

| 设计要求 | 代码 owner | 实际表现 | 等级 | 根因 | 建议 |
|---|---|---|---|---|---|
| 组件自定物理形态 | SurfaceFrame.tsx / SurfaceComponentLayer.tsx | 全矩形 chrome 壳 | **P0** | 数据模型无 shape 字段 + Layer 无条件包壳 | 改造：shape 契约 + 壳可选 |
| body 直接操纵 | SurfaceFrame.tsx:86 | 仅 chrome 可拖 | **P1** | 拖动入口写死在 chrome | 改造：按组件契约声明可拖区域 |
| 完整积木目录 | surfaceComponentCatalog.ts | 12 种，Main 仅 2 可建 | **P1** | 上一阶段只实现了少量类型 | 扩充：Stack/Slot/ChangeSet/Artifact/Compare 等 |
| Matrix Activity 语言 | MatrixActivity.tsx | 单比特指示灯 | **P1** | 只接了 working 布尔 | 改造：六语义 + 密度/色相/方向 |
| Light Segment 骨架 | LightSegment.tsx | 装饰短线 | **P1** | props 只有 axis/active/length | 改造：进度/checkpoint/路径表达 |
| Glyth 生命感 | LcosGlyth.tsx / glythMotion.ts | 会呼吸的标点 | **P1** | 无 gaze/blink/morph；无测量校准 | 改造：Bloub 式引擎迁移（Stage B） |
| 旧整页 renderer | Context*Surface.tsx | 与空间底座并列 | **P2** | 历史遗留未降级 | 保留观察：降为 Lens 或删除 |
| Agent 语言宽度 | surfaceIntent.ts / Composer | 5 组件可组织 | **P1** | Catalog 窄 | 随 Stage D/E 扩充 |
| Presentation 状态 | presentations.ts:158-163 | pinned/collapsed/zIndex/variant | **P0** | 早期契约未预留形态 | 扩展：shape/pivot/layout 字段 |
| Reduced Motion 统一 | 视觉层内 vs 30+ 散点 | 视觉层统一、其余散落 | P2 | 历史特性各自实现 | 收口到 Visual Primitive 层 |
| 节点角标性能 | ProjectCanvas.tsx:1162 | 无条件挂载+滤镜 | **P1** | 未门控 | 改造：shouldShowGlyth + 缓存 + 去掉滤镜 |
| 测试深度 | tests/glyth-motion.test.ts | 区间断言 | P2 | 起步期 | 补黄金帧/组件 frozenAt |

---

## 6. 特别审计问题（§7.4 十问简答）

1. **SurfaceFrame 是否被错误用作永久矩形壳？** 是。Layer:58 无条件包裹，12 种全中。
2. **Workbench 为何只有 title 可拖？** chrome 独占 begin('move')（SurfaceFrame.tsx:86），内容区无拖拽声明。
3. **哪些组件可取消永久标题栏？** fence/region（纯边界类，可无 chrome 直接操纵）、light segment 类装饰；workbench/portal/review 需要入口但可改为轻量角标而非整条标题栏。
4. **MatrixActivity 真实能力？** 占位级：active+density，单色，固定波纹。仅 Region/Panel 两处挂载。
5. **LightSegment 能否承担骨架/路径/Drop 反馈？** 不能。需扩展进度/分段/多段路径 API。
6. **LcosGlyth 与 Bloub 差距？** gaze/blink 无、轮廓不能 morph、无测量校准、无黄金帧测试；采样器纯函数+共享时钟是好底子。
7. **Catalog/Shelf 缺哪些真实组件？** Stack/Slot/ChangeSet/Artifact/Compare/Source Stack/Active Path；Main 现场可建仅 2 种。
8. **旧整页 renderer 是否降级？** 尚未。ContextGraph/Tree/Flow 仍以 Lens 并列存在。
9. **AgentSurfaceComposer 只能拼固定框？** 管线是真实的（Preview/Keep/Revert 全有），但可选积木少，本质是"窄"不是"假"。
10. **Presentation state 是否足够？** 不足。无 shape/pivot/自由轮廓/内部布局字段，不支持拼接与自由形态。

---

## 7. 重大变更影响说明（§7.5，按 Stage A 首期）

1. **变更原因**：数据模型无形态维度 + 统一矩形壳，导致组件语义无法决定自身物理形态（P0）。
2. **变更前流程**：Shelf→create→SurfaceFrame(chrome+content+resize)→renderer 注入 children。
3. **变更后流程**：Shelf→create→形态解析（shape 契约）→可选壳/无壳直接渲染→renderer 拥有自身形态。
4. **用户操作变化**：可拖 body 直接操纵；边界类组件无标题栏；Workbench 内部局部可拖。
5. **数据流变化**：SurfaceElementV0 增加 `shape`（如 `{kind:'rect'|'free'|'panel'|'line', pivot?, cornerRadius?, segments?}`），`presentation.variant` 保持语义；旧数据无 shape → 默认 rect，**向后兼容**。
6. **影响模块**：contracts/presentations.ts、surfaceElementTypes、surfaceGeometry、surfaceOps（校验加 shape）、SurfaceFrame、SurfaceComponentLayer、全部 renderer 的壳假设、SurfaceComponentShelf 预览图标。
7. **文件与 Schema 迁移**：`packages/contracts/src/presentations.ts`（+shape 字段，V0 内扩展不破坏）；持久化已有数据零迁移（默认 rect）。
8. **开发成本**：中（契约+壳重构+回归，涉及 ~10 文件 + 测试）。
9. **风险**：所有 renderer 依赖 chrome 的 pin/collapse/remove 能力——需设计"无壳组件的操作入口"替代方案（轻量角标/选中态浮层），否则功能回退。
10. **验收条件**：至少 fence/region 无标题栏可直接拖；workbench 保留标题但内容区可局部操纵；旧组件数据渲染不变；既有测试全绿 + 新增 shape 契约测试。
11. **回滚方案**：Stage 单 commit，`git revert` 该 commit 即回 99b6cea 语义；shape 可选字段不破坏旧数据。

---

## 8. 建议施工分期（§7.6，含合并与依赖）

```text
Stage A  Glaze Visual Primitive Contract        ← 一切的地基（P0 解）
         shape 契约 + 壳可选 + body 操纵入口
         文件：contracts/presentations.ts、surfaceElementTypes.ts、surfaceGeometry.ts、
              surfaceOps.ts、SurfaceFrame.tsx、SurfaceComponentLayer.tsx、
              SurfaceComponentShelf.tsx、renderers 壳假设、tests
         依赖：无。回滚点：99b6cea。

Stage B  Glyth / Bloub 动画引擎迁移
         gaze/blink 系统 + 轮廓 morph 采样 + 黄金帧测试 + 测量校准
         文件：glythMotion.ts、LcosGlyth.tsx、新增 eyes/profile 模块、tests
         依赖：A（视觉契约提供 shape 输入）。可独立 commit。

Stage C  直接操纵与组件 Physics（解除统一标题框）
         body 拖拽、无壳组件操作浮层、拼接/吸附升级
         文件：SurfaceFrame.tsx、SurfaceComponentLayer.tsx、spatialInteractionMachine.ts、
              spatialHitTest.ts、新 Op：split/join
         依赖：A。

Stage D  Component Catalog / Shelf 积木化
         Stack/Slot/ChangeSet/Artifact/Compare/Source Stack + Main 现场扩充 + Ghost 预览
         文件：surfaceComponentCatalog.ts、registry、Context/WorkflowComponentRenderers.tsx、
              Shelf.tsx、surfaceIntent.ts（intent→组件映射扩充）
         依赖：A、C（新组件用新形态）。

Stage E  Context 理解组件与 Workflow 行动组件成熟化
         旧整页 renderer 降为可移动 Lens；relationship/evolution 升级；Checkpoint 接 LightSegment 进度
         文件：surfaces/ 旧 renderer、ContextLensSwitch、LightSegment.tsx、MatrixActivity.tsx
         依赖：B（视觉语言）、D。

Stage F  Workbench 重设计 + Agent Surface Composer
         Workbench = 局部工作桌面（内部可拖、工具 slot 接真实 runtime）；Composer 选择面扩宽
         文件：WebWorkbench.tsx、WorkflowComponentRenderers.tsx（WorkbenchFrame）、
              AgentSurfaceComposer.tsx、surfaceIntent.ts
         依赖：C、D、E。

Stage G  真实验收
         真实项目 + 真实浏览器 + Desktop 手操验收（不得用静态测试代替）
         依赖：A-F。
```

**合并建议**：A 必须单独；B 可并入 A 的第二个 commit（同属"视觉契约"，但建议分开便于回滚）；C 与 D 可并行开发（C 是物理、D 是内容）；F 的"工具 slot 接真实 runtime"依赖外部（Agent Tool Runtime 尚未接通，WebWorkbench.tsx:22 自述"等待真实 Agent Tool Runtime"）——F 前半（重设计）可先做，后半（接通）标记外部依赖。

---

## 9. 首轮验收 10 问自评（§9）

1. **Glaze 到底是什么？** 可组合空间工作语言 = 积木(Catalog) + 物理(Physics) + 视觉材料(Visual) + Agent Composer；当前代码已有管道，缺宽度与形态自由度。
2. **Glyth 与 Glaze 的关系？** Glyth 是 Glaze 视觉材料四层之一（拟生语义出现物/living punctuation），不是 Glaze 本体；当前实现是"会呼吸的标点"，缺眼神与真 morph。
3. **Matrix vs LightSegment 分工？** Matrix=活性/状态点阵（ROG/RGB：密度/色相/波纹/方向），LightSegment=结构/边界/路径/进度（Nothing 灯条）；当前两者都是单比特指示灯，能力未兑现。
4. **为什么 Workbench 难用？** 只有 chrome 可拖（SurfaceFrame.tsx:86），内容区是一张静态页面列表+占位工具按钮（WebWorkbench.tsx:15-23），不是局部工作桌面。
5. **为什么组件不像积木？** 数据模型只有矩形 bounds（presentations.ts:165-173）+ 无条件 SurfaceFrame 壳（Layer:58），任何组件都被压成"带标题栏的卡片"。
6. **哪些可保留？** Catalog/Ops 校验层（fail-closed）、镜像持久化、semantic drop、intent→op 管线、共享 rAF 时钟、reduced-motion 视觉层、对齐参考线、spatialSignal 分层——全是好底子。
7. **Context 与 Workflow 如何同积木不同性格？** 架构已支持（同底座+不同 Catalog 子集+不同默认布局），但当前性格差异靠 minSize/组件子集勉强体现，需靠 Stage E 的 Lens 化与默认布局差异做实。
8. **Agent 如何用同一套 Catalog/Physics？** 已走 resolveSurfaceIntent→Ops→Preview/Keep/Revert（真实管线）；扩充 Catalog 后 Agent 才有足够砖。
9. **如何避免牺牲 Project Truth/性能/人工位置？** 现状已符合：binding 只存 identity（无实体副本）、surfaceElements 只存展示几何、人工位置即 bounds 本体；性能风险点在角标无条件挂载+滤镜（Stage B/C 修）。
10. **第一阶段改哪些文件、如何回滚？** 见 §7（Stage A 清单）+ §8；单 commit + revert 回 99b6cea。

---

## 10. 最终清单

**已完成**
- 仓库现场核对（git status/branch/log/diff --check，与接管单一致）
- 架构地图：spatial 底座 / components / model / visual / surfaces / state 全覆盖
- 交互流程五条链路逐一指认真实函数（§4）
- 偏差矩阵 12 项（§5）、特别审计十问（§6）
- 视觉层 Bloub 对比审计（§3）
- 重大变更影响说明（§7）+ Stage A-G 分期（§8）

**未完成**
- 逐文件通读全部 renderer 内部实现（Fence/Region/Portal/SourceChain 等细节渲染逻辑）；本次以层/契约/消费链为主
- WorkflowSurface 内部步骤/Review/Checkpoint 绑定链路细节
- 启动画面（boot loading）Glyth 缺失的确认（grep 未见引用，未逐行验证 App.tsx 全流程）

**未验证**
- Desktop 端实际手操验收（构建产物 out/ 存在但未跑；Electron 43 本机崩溃问题仍在 Codex 侧）
- 持久化 mirror 的 Core Presentation bridge 端到端回读（本地状态机逻辑已读，未跑真项目）
- 高节点数下性能压测

**发现的文档冲突**
- 施工稿 `LCOS_0.1_GUI_详细施工稿_v1_20260823.md` 中"旧稿 Matrix 活性点……全部废弃——v08 没有 Matrix 层"**无效**：上游 v04 与用户原话已冻结 Matrix Activity 为 Glaze 核心视觉材料（接管单 §3 已声明）。本报告按冻结执行，Matrix 保留并升级（Stage E）。

**建议第一个代码 Stage**
- **Stage A：Glaze Visual Primitive Contract**（shape 契约 + 壳可选 + body 操纵入口）——P0 根因所在，且是 B/C/D/E/F 的共同前置。

**预计修改文件（Stage A）**
```text
packages/contracts/src/presentations.ts          # SurfaceElementV0 + shape 字段
apps/web/src/features/spatial/model/surfaceElementTypes.ts
apps/web/src/features/spatial/model/surfaceGeometry.ts     # shape 几何工具
apps/web/src/features/spatial/model/surfaceOps.ts          # shape 校验
apps/web/src/features/spatial/components/SurfaceFrame.tsx  # 壳可选化 + body 拖拽入口
apps/web/src/features/spatial/components/SurfaceComponentLayer.tsx
apps/web/src/features/spatial/components/SurfaceComponentShelf.tsx  # 预览图标形态
apps/web/src/features/spatial/components/FenceComponent.tsx / RegionComponent.tsx  # 试点无壳
apps/web/tests/ 若干新增契约测试
```

**风险**
- 无壳组件的 pin/collapse/remove 功能入口需替代方案（选中态浮层），否则功能回退
- 12 个 renderer 若隐式依赖 chrome 结构，重构面比预期大（需逐 renderer 过一遍）
- 本会话模型不稳定（OX-alpha 429 频发），大改代码阶段建议切 DeepSeek V4 Flash 执行
- 免费周过后 OX-alpha 可能收费/下架，勿把交付依赖建立在它上面

**回滚点**
- 当前 HEAD `99b6cea`（无提交前的最干净语义锚点）
- 每个 Stage 独立 commit → 单 commit `git revert` 即可回滚，不 reset --hard、不 checkout -- .
- 本报告文件 `docs/audit/LCOS_GLAZE_FRONTEND_TAKEOVER_AUDIT_WORKBUDDY_20260823.md` 为新增未跟踪文件，不影响回滚

---

*报告完成。等待 Dz/Codex 确认后再进入 Stage A 施工。*

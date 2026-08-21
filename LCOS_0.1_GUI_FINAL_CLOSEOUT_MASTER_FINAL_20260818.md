# LCOS 0.1 GUI 最终收口唯一施工稿
## FINAL · PASS9 GUI R1–R11 · 2026-08-18

> **状态：GUI 方案冻结 / 代码已实现至当前真实能力边界 / 完整 Workspace 测试待 Windows/PASS9 依赖环境复跑。**
>
> 本文覆盖此前 R4、R5 及其他 GUI 补丁稿，作为 0.1 GUI 唯一施工与验收依据。

---

# 0. 最终冻结

LCOS 0.1 GUI 本轮不是重新设计产品，而是把已经成立的 UX 补到足够完整、稳定、可辨识的 GUI。

最终内部口令：

> **拆门，不拆房间；Node 负责内容，16×16 负责动作；Main 摆项目，Context 组理解，Workflow 搭行动。**

同时冻结：

- Entity First，但 **Entity First ≠ Node First**。
- Surface Second，但 **Surface Second ≠ Surface Same**。
- Executor Replaceable；Harness / Session 是项目的访客，不是项目状态的所有者。
- One Project Truth；Canvas / Context / Workflow 都是 Project Truth 的 Surface / Projection。
- 同一个 Project Entity 跨 Surface 保持同一身份，不复制业务对象。
- Drop = “在这里使用”；不再让用户通过表单、模式选择、二次分类重复表达已经用空间动作表达过的意图。
- Search 解决“不知道对象在哪/叫什么”；Focus 解决“已知对象在哪里出现”。
- Raw Context 可直接给 Agent；语义结构只能帮助理解，不能成为进入 Context 的门。

---

# 1. 视觉总原则：补完成度，不做改版

本轮保留 PASS9 已有 LCOS 视觉母体：

- 当前浅色、低 chrome、porcelain-like surface；
- 现有 Shell / Dock 尺度与总体布局；
- 当前字体、间距、边框和浮层基调；
- SpatialCanvas 作为共享空间基础；
- 已有 Reader / Workbench / Search / Focus 基础能力。

本轮不允许出现：

```text
Main 像 Spatial.
Context 像 Heptabase
Workflow 像 Linear
```

那不是完成度，是三款软件拼尸。

外部参考只负责补特定能力：

## Spatial.
负责：**材料和集合怎么“有身体”**。

借：
- 内容决定对象形态；
- Stack / folder 的收纳、展开、收起；
- 图片像图片、纸张像纸张、board 像 board；
- 不依赖统一白卡 + 文件 icon 区分对象。

不借：
- 品牌配色；
- 整体 Shell；
- 把所有 LCOS Surface 做成 Spatial clone。

## Huabu
负责：**Human + Agent 如何在同一空间中共同工作，而且过程可见**。

借：
- Selection-first；
- Agent 直接作用当前 Surface；
- 节点平滑移动；
- Region / Relation 渐进形成；
- Pending Review；
- Keep / Revert；
- stale/conflict fail-closed。

不借：
- Huabu 视觉系统；
- 把 Agent 变成新的项目实体中心；
- 把整个产品改造成纯 Agent Canvas。

## JarvisHub
负责：**Canvas-native Agent 如何把候选、Revision、Feedback、Dependency、Action 留在工作现场中**。

借：
- Agent 输出应写回可寻址工作状态；
- 中间状态、依赖、候选、反馈应该可见；
- Canvas 是 Agent 可观察、可操作的真实工作介质。

不借：
- Canvas-as-Truth；
- Harness-contained ownership。

LCOS 的进一步突破保持：

> **Project = World；Canvas / Context / Workflow = Surface；Session / Harness = replaceable executor。**

---

# 2. 三个工作现场

## Main
回答：

> 我有哪些东西？我想怎么摆？

冻结：
- 永久自由；
- 不存在 Arrange 模式；
- 用户拖动位置本身是工作记忆；
- deterministic align/distribute/snap 只是轻量几何工具；
- Agent organize 主要改变 Presentation；
- 不因距离自动生成 semantic relation。

Main 的 Agent “整理” = **spatial organization**。

---

## Context
回答：

> 这一次哪些东西需要一起理解？我们现在形成了什么理解？

冻结：
- Context 不是第二个 Main；
- 允许空间，但空间是理解的介质，不是 Context Truth；
- Fragment / relation / constraint / conclusion / conflict / region 比 Main 更重要；
- Drop 进去即纳入共同理解，不要求先创建模式或填写 Context 表单。

Context 的 Agent “整理” = **semantic organization + supporting spatial presentation**。

---

## Workflow
回答：

> 接下来准备怎么做？

冻结：
- Step / Action ≠ Material；
- Step 是行动骨架；
- Material 是原 Project Entity 的引用 / attachment；
- 默认只搭建，不执行；
- 不进入 n8n/BPMN 工程配置心智。

---

# 3. Main 上的系统投影对象家族

Main 上的系统对象不能再共享一种普通节点皮肤。

最终对象身体：

```text
Material   = 真实内容身体
Collection = 收纳身体
Context    = 理解身体
Workflow   = 行动身体
Workspace  = 现场身体
```

## 3.1 Collection · Spatial Stack / Folder

收起：
- 轻薄 folder body；
- 后方露出 2–3 张真实成员预览；
- hover 克制微展开。

展开：
- folder 本体留在原处作为锚点；
- 成员使用原 Project Views；
- obstacle-aware 排布；
- 不创建 child canvas。

收起：
- 成员视觉折回 folder；
- transient animation 不写 Presentation 假坐标。

Collection 是“收纳”，不是 semantic Region。

## 3.2 Context Projection · Researched Dossier

不是普通卡，也不是换一个 Context icon。

身体：
- dossier / research folder；
- 后方露真实材料页；
- 正面露材料 preview + relation trace；
- 一眼看出“这些材料被共同理解过”。

交互：
- 单击：Select；右侧出现 Context Quick Lens Launcher；
- 双击 / Enter：直接进入默认 Understanding Space；
- Quick Lens：`现场 / 结构 / 演进`。

## 3.3 Workflow Projection · Action Folio

不是材料串联图。

身体：
- 有明确方向的 action folio；
- 正面表现行动骨架；
- 下缘露真实材料 attachments；
- 在真正 Action contract 出现前，不拿材料标题伪装 Step。

## 3.4 Workspace / Scene Projection · Board Snapshot

身体：
- 像保存下来的桌面 / board thumbnail；
- 使用真实 member x/y/width/height 归一化生成 mini spatial layout；
- 不强调语义关系，也不强调流程顺序。

---

# 4. Context 最终结构

Context 是同一个 Truth 的多种 Projection，不是三个产品模式。

```text
Context Graph        项目级 Context 总览
    ↓
Understanding Space  默认理解现场
├─ Structure         结构 Lens
└─ Evolution         演进 Lens
```

## 4.1 Context Graph

项目级，回答：
- 有哪些 Context；
- 哪些 Context 共享材料；
- 哪些承接 / 分叉 / 形成决策。

不展示所有内部材料细节。

## 4.2 Understanding Space

打开 Context 默认进入。

可出现：
- Project Entity；
- Source Fragment；
- 摘录；
- Relation；
- Constraint；
- Conclusion；
- Conflict；
- Semantic Region。

默认比 Main 更紧凑、更关系导向、更强调 Fragment 和来源。

## 4.3 Structure Lens

继承原 Mind Map 能力。

回答：
> 当前理解形成了什么结构？

- hierarchy；
- parent/child；
- reparent；
- collapsed state 只改 Presentation。

## 4.4 Evolution Lens

继承原 Signal Track 能力。

回答：
> 这份理解如何演进到现在？

可表达：
- material arrival；
- conclusion confirmed；
- judgment superseded；
- decision point；
- snapshot progression。

## 4.5 Context Region

Region 不是新业务分类。

它来自同一 Presentation hierarchy / understanding relation，作为理解辅助：
- 极轻边界；
- 极浅背景；
- label 很轻；
- Agent 构建时渐进出现；
- 不变成卡片式 Section Header。

---

# 5. Workflow 最终结构

本轮已新增窄而真实的 Presentation-only Action contract：

```text
WorkflowActionV0
- id
- label
- description?
- attachedViewIds[]
- x / y

WorkflowActionEdgeV0
- fromActionId
- toActionId
- label?
```

这是 Workflow Presentation 的行动骨架，不是新的 Project Truth。

## 5.1 Action

只有 Action 拥有 Workflow 主端口。

Action 可包含：
- label；
- short intent；
- attachedViewIds；
- x/y；
- 16×16 runtime state。

## 5.2 Material

Material：
- 保持原 Project Entity / View 身份；
- 不拥有主流程 input/output port；
- 作为 Action attachment；
- 可 Reader；
- 可 Focus 回 Main / Context；
- 删除 Action 不删除 Material。

## 5.3 Action Edge

主骨架只允许：

```text
Action → Action
```

可用轻 label 表达：
- condition；
- branch；
- handoff。

不引入 BPMN shape zoo。

## 5.4 Context → Workflow

冻结链路：

```text
Context 中选材料
→ 做成工作流
→ 只问“你希望从这些材料搭到哪里？”
→ Agent 建 Action / Step
→ 同一批 Project Entity 挂到 Action
→ Pending Review
→ 默认不执行
```

---

# 6. Material Morphology

内容身体负责“它是什么”。

不再使用 16×16 文件身份图标。

## Image
- 图像本身就是主体；
- 弱边界；
- 标题轻。

## PDF / PPT / Document
- 真实页 / slide 优先；
- fallback 是 paper anatomy，不是大 PDF icon；
- fold / page body / tiny type metadata。

## Text / Markdown
- reading / collapsed 两种密度；
- Context 中短 Fragment 更易读；
- Workflow attachment 默认 compact。

## Web / Link
- 来源、domain、preview 优先。

## Media
- poster / waveform / duration 表达身体。

统一 density：

```text
mini
compact
standard
reading
```

Surface 只决定默认密度，不另造节点体系。

---

# 7. 16×16 Dynamic Language V1

16×16 是 LCOS 系统动作 / 状态语言，不是文件格式 icon。

统一状态：

```text
stable
focus
sending
receiving
working
pending
kept
reverting
conflict
failed
```

同一个 seed，通过局部开合 / 位移 / 重排表达状态。

## Motion 纪律

- focus：单次 pulse；
- sending：短方向位移；
- receiving：结构打开后闭合；
- working：局部重新排列，不做 spinner；
- pending：轻 open-loop / breathing；
- keep：一次闭合；
- revert：反向收回；
- conflict：两侧克制错位；
- failed：一次异常 motion 后稳定断裂。

支持 `prefers-reduced-motion`。

禁止：
- 整卡变黄；
- 大 AI badge；
- 全画布闪烁；
- 无限旋转 loading。

---

# 8. Agent Visible Change / Huabu Review

本轮把 Reorganize 从“ghost + apply”继续收成真实 Presentation ChangeSet。

## 8.1 真实 positionPatch

`ReorganizeProposalV0` 现在支持真实 `positionPatch`。

apply：
- 只修改 Presentation member；
- finite coordinates；
- pinned / positionLocked 跳过；
- positions 写入同一个 ChangeSet；
- rollback 可恢复。

## 8.2 修复旧整理 bug

旧 UI 把 Selection 误塞进 `mergeCandidates`，Core apply 会移除 merge source Views。

已取消：

> 普通“整理”绝不能通过 merge 让选中材料消失。

## 8.3 stale fail-closed

Proposal 创建后的 base Presentation 如果已经改变：

```text
apply -> fail closed
```

旧 Agent 变更不能覆盖用户更新后的工作。

## 8.4 Whole ChangeSet Review

当前真实支持：

```text
Keep All  -> Core accept: applied → accepted
Revert All -> Core rollback
```

accepted 后不能再 rollback。

Proposal status 读取时从 DB status 覆盖 proposal JSON，确保 persisted accepted/rejected 状态正确。

## 8.5 不假装支持的能力

当前 0.1 **没有伪造**：
- item-level Keep/Revert；
- item-level stale conflict review；
- 假 View Before；
- NLP instruction 自动生成 hierarchy/relation/emphasis patch。

GUI 中只展示真实能力。

---

# 9. Reader

不重做整体视觉，只统一入口。

冻结：
- 双击 / Enter 可读 Material -> 同一个临时 Immersive Reader；
- Link 仍可直接外部打开；
- Workbench 回到 Version / Source / System details；
- Reader 不成为永久右栏；
- Esc 返回原空间；
- Fragment 保留 source / revision / anchor。

---

# 10. Dock / Navigation

保留现有 Dock shell 和尺度，不做大改版。

用户顶层工作心智收成：

```text
主画布
上下文
工作流
```

废止用户层“整理”顶层模式。

兼容性：
- Main 内部 persisted surface id 可继续使用旧 `'arrange'`；
- 用户层显示“主画布”；
- legacy work/deliver id 可 normalize 到 Workflow。

Current Scene / Workspace 继续是 Main 内场景，不成为第四个顶层产品空间。

---

# 11. Search / Focus / Semantic Drop

## Search
- 一个全局入口；
- 不暴露 FTS / vector / DB 模式。

## Focus
- 已知对象定位器；
- 不带搜索输入框；
- 返回 Main / Collection / Context / Workflow / Workspace locations。

## Semantic Drop
- Drop target 本身表达“在哪里使用”；
- 不再先 drop 再弹类别选择；
- Main / Context / Workflow 共享同一手势语言。

---

# 12. Empty State

Empty state 不再承担产品说明书责任。

当前语义：

Context Graph：
> 把相关 Context 或材料放到这里。双击 Context 进入。

Context Space：
> 可以直接阅读、摘取、组织，放进来的材料就在这里一起被理解。

Evolution：
> 材料会沿理解顺序展开，也可以直接拖动调整演进位置。

Workflow：
> 把材料带进来，再建立第一步。默认只搭建，不执行。

---

# 13. R1–R11 实施切片

## R1 · Collection morphology
Spatial-style folder/stack，展开/收起不创建 child canvas。

## R2 · Context default surface
拆掉强制 Signal/Mind Map 二选一入口，恢复默认 Context work surface。

## R5 · Main Projection Morphology
Context / Workflow / Workspace 三类 Main 投影获得不同身体；Context Quick Lens Launcher 接真实 Surface。

## R6 · Context Understanding Regions
Understanding Space 使用同一 Presentation hierarchy 派生轻 Region；Relation 视觉分层。

## R7 · Workflow Action / Material Separation
新增 Presentation-only WorkflowAction / Edge；Action-first，Material attachment；export/import 保留骨架。

## R8 · Spatial-style Material Morphology
移除文件身份 DotGlyph；paper/text/media 身体补齐。

## R9 · 16×16 Dynamic Language
只表达 action/state；system identity 与 runtime signal 分离。

## R10 · Huabu ChangeSet
真实 positionPatch、stale fail-closed、persistent whole ChangeSet Keep/Revert。

## R11 · Reader / Dock / Product Copy
统一 Reader 入口；顶层 Main/Context/Workflow；清掉旧模式文案。

---

# 14. 主要代码 Owner

本轮最终变更覆盖 42 个文件，主要 owner：

## Contracts
- `packages/contracts/src/presentations.ts`
- `packages/contracts/src/reorganize.ts`

## Local Core
- `apps/local-core/src/presentation-application-service.ts`
- `apps/local-core/src/reorganize-service.ts`
- `apps/local-core/src/server.ts`
- `apps/local-core/src/workflow-export-service.ts`

## Web UI
- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/design/DotGlyph.tsx`
- `apps/web/src/features/reorganize/ReorganizePanel.tsx`
- `apps/web/src/features/shell/SurfaceDock.tsx`
- `apps/web/src/features/surfaces/ContextSpaceSurface.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/features/surfaces/contextUnderstandingRegions.ts`
- `apps/web/src/state/presentationWorkflowActionState.ts`
- `apps/web/src/interaction-system.css`

## Tests / Static Gates
- `apps/web/tests/guiR8R11CloseoutContract.test.ts`
- `apps/web/tests/guiR5ProjectionMorphology.test.ts`
- `apps/web/tests/gui5ReorganizeContract.test.ts`
- `scripts/validate-gui-01-final-static.mjs`
- legacy A/B static gates updated to current frozen product contract。

---

# 15. 0.1 GUI Final DoD

## Main
- [x] 永久自由；
- [x] 不存在顶层 Arrange mode；
- [x] Collection 有 Spatial-style stack/folder 身体；
- [x] Context / Workflow / Workspace Main projection 可一眼区分；
- [x] Material real face / paper morphology；
- [x] Agent position change 是真实 ChangeSet；
- [x] Pending / Keep / Revert 使用真实 runtime signal。

## Context
- [x] Context Graph 保留；
- [x] 默认 Understanding Space；
- [x] Structure Lens 保留；
- [x] Evolution Lens 保留；
- [x] 三者基于同一 Context Truth；
- [x] Main projection 有 Quick Lens；
- [x] Region / Relation 进入默认 Space；
- [x] Fragment/source 身份继续保留；
- [x] 不再强制 Signal Track / Mind Map 二选一。

## Workflow
- [x] Action 与 Material contract 分离；
- [x] 只有 Action 拥有 Workflow 主端口；
- [x] Material 通过 `attachedViewIds` 引用；
- [x] 删除 Action 不删 Material；
- [x] Action→Action 是主骨架；
- [x] export/import 保留 Actions/Edges；
- [x] 默认只搭建，不执行；
- [x] legacy process 明确不是 Step。

## Material
- [x] 文件类型不依赖 16×16；
- [x] document/text fallback 具有实体身体；
- [x] 真实 preview 优先；
- [x] system object 与 material morphology 分离。

## 16×16
- [x] stable/focus/sending/receiving/working/pending/kept/reverting/conflict/failed；
- [x] identity 与 signal 分离；
- [x] reduced-motion；
- [x] 不依赖大 badge / 整卡状态色。

## Review
- [x] positionPatch 是真实 Core ChangeSet；
- [x] stale base version fail-closed；
- [x] whole Keep All 真实 accept；
- [x] whole Revert All 真实 rollback；
- [x] accepted 状态持久化读取；
- [x] 未 READY 的 item-level review 不在 GUI 假装存在。

## Other
- [x] Reader 统一入口；
- [x] Dock 顶层 Main / Context / Workflow；
- [x] Search / Focus 不混；
- [x] Semantic Drop 保持；
- [x] Empty state 清除旧模式说明；
- [x] 整体视觉风格不大改。

---

# 16. 最终 Gate 状态

最终 HEAD：

```text
71419e5
R8-R11 close out LCOS 0.1 GUI semantics and review
```

R5 baseline：

```text
62b1333
PASS9 R1 R2 R5 baseline
```

静态 Gate 全绿：

```text
A4       13/13
A5       13/13
A6       10/10
B1       11/11
B3       14/14
B3R4     10/10
B3R5     10/10
B3R6     14/14
B4       19/19
B5       14/14
B6       16/16
GUI 0.1 Final 23/23
```

其他实际通过：
- 27/27 changed TS/TSX transpile syntax smoke；
- relative import resolution；
- main CSS brace balance；
- `git diff --check`。

完整 workspace test/typecheck 当前仍需真实 PASS9 依赖环境复跑：
- 本容器执行 `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund`；
- 180s timeout；
- 未生成完整 `node_modules`；
- 因此本稿绝不声明 Vitest / full typecheck / browser Human Golden 已通过。

详见独立 Gate Report。

---

# 17. Remaining Capability Debt · 明确不是“假完成”

这些不允许在 GUI 中假装已经有：

## 17.1 Semantic Agent Reorganize Composer

当前：
- Core 已支持 positions / hierarchy / relation / emphasis patch；
- 当前 GUI 的自由文本 instruction **没有**真实 Agent/Skill route 把自然语言编译为 semantic patches；
- 当前安全整理实际由 deterministic `positionPatch` 完成。

后续接真实 Agent/Skill 时：
- Agent 产 semantic proposal；
- Core 验证 / apply；
- GUI 继续复用当前 ChangeSet Review。

绝不在 Local Core 里用字符串规则“解析自然语言”。

## 17.2 Item-level Review

当前真实能力是 whole ChangeSet：

```text
Keep All / Revert All
```

item-level Keep/Revert、真正的 View Before、逐项 conflict checking 等待 Core item-level ChangeSet 能力。

## 17.3 Restart 后 Pending Review UI Rehydration

Proposal status 已持久化；accepted/rejected/applied 状态本身不会丢。

但当前 GUI 尚未在 Desktop restart 后主动查询并恢复“未确认 applied proposal”的 review overlay。

这属于后续 runtime/desktop continuity 补强，不通过假本地 UI state 解决。

---

# 18. 与后续两条收口线的边界

## PASS8 / Windows Desktop

GUI 本轮完成不伪造 Windows real-machine QA。

后续仍需：
- deterministic gate 最后一处环境/fixture 修正；
- Desktop real-machine QA；
- Capture real-machine screenshots；
- Windows make / installer。

## Context Cache-Friendly

GUI 不新增任何 Cache 用户概念。

后续 Runtime 只做：
- deterministic Context serializer；
- stablePrefix / dynamicTail；
- stable hash；
- telemetry；
- contract tests。

Presentation move / node position / viewport 必须继续不影响 Context stable-prefix hash。

---

# 19. 0.1 GUI 冻结后的纪律

从这份稿开始，0.1 GUI 不再横向开启新世界观设计。

允许：

```text
真实测试失败后的修 bug
Windows Desktop 适配
浏览器 Human Golden 微调
accessibility
spacing / typography / motion 小幅 polish
真实能力接线
```

不允许：

```text
为了“更漂亮”重做 Shell
重新统一 Main / Context / Workflow
重新引入 Arrange mode
重新把 Context 做成强制模式选择
重新把 Material 串成 Workflow
重新用 16×16 当文件 icon
为了 Demo 假造 Agent / Review 能力
```

---

# 20. 最终产品表达

LCOS 0.1 最终应该让用户感到：

### Main
真实项目材料被摊在桌面上，我可以按自己的记忆摆放。

### Context
同一批材料正在形成一个可读的共同理解现场。

### Workflow
共同理解已经长成下一步行动骨架，但还没有擅自替我执行。

### Agent
不是旁边聊天框里的建议者，而是能作用于当前工作现场、变化可见、结果可 Review 的可替换执行者。

### Project
不是某次 Session 的附件，而是跨 Surface / Session / Harness 持续存在的真实世界。

---

> **FINAL FREEZE：拆门，不拆房间；内容有身体，动作有语言，项目比 Session 活得久。**

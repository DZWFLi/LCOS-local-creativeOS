# LCOS v0.15 · FINAL FROZEN CONSTRUCTION SOP
## 施工 / Patch / Diff / 文档 / 索引 / 阅读矩阵 / Handoff / 验收

日期：2026-08-31  
状态：**FROZEN / MANDATORY / REPOSITORY-LEVEL SOP**

> 本文件从此定义 LCOS v0.15 的施工方法。
>
> 后续任何 GPT / Codex / TRAE / 本地 Agent / 人工开发，不得仅凭上一份 Handoff 继续施工。
>
> **上下文恢复本身就是施工的一部分。**

---

# 0. 最短版本

每一刀都必须走完：

```text
Restore Context
→ Read Required Sources
→ Source-Diff Gate
→ Audit Current Production Owner
→ Define One Product Proposition
→ Patch
→ Static / Unit / Manual Product Smoke
→ Visual/Donor Check when GUI touched
→ Generate Diff + Closeout
→ Update Context Indexes
→ Update Authority Pointer if needed
→ Handoff
→ STOP
```

任何一步缺失：

> 不进入下一施工包。

---

# 1. Truth Priority

## 产品 Truth

```text
最新明确用户 L0 裁决
>
最新 v0.15 Freeze
>
原始高置信产品根稿
>
Reality Feedback / Donor evidence
>
Audit / Handoff
>
历史 PASS / Phase 文档
```

## 实现 Truth

```text
当前真实 HEAD / worktree / production path / tests
>
最新真实 diff
>
closeout claim
>
旧 handoff
```

产品 Truth 与实现 Truth 不得互相冒充。

---

# 2. 双 Gap 永久模型

每次施工都必须同时检查：

## PLAN_FIDELITY_GAP
原文已经说了，后续施工计划漏掉 / 压缩 / 未写 Acceptance。

## REALITY_GAP
原计划即使完成，用户实机仍发现新的可用性 / 视觉 / 交互问题。

并另外允许：

```text
MATCH
EXPLICIT_OVERRIDE
IMPLEMENTATION_GAP
WRONG_OWNER
```

施工前必须分类。

---

# 3. 阅读等级

## T0 · READ FULL EVERY SESSION
**每一次新 Session / 上下文压缩 / Agent 接管，都必须全文读。不得摘要代替。**

1. `AGENTS.md` 当前仓版本
2. `LCOS_v015_MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
3. `LCOS_v015_SOP_FINAL_FROZEN_施工_Patch_Diff_文档_索引_阅读矩阵_20260831.md`
4. `LCOS_v015_CONSTRUCTION_CONTEXT_INDEX_20260831.md`
5. 当前阶段最新 Construction Plan
6. 当前 HEAD 最近一份 Closeout / Handoff
7. 当前真实 `git status / branch / HEAD`

如果产品语义相关，还必须全文读：
8. 当前触及域在 Context Index 指向的 **Original Freeze**
9. 当前触及域在 Reality/Donor Index 指向的 **Latest Feedback**

---

## T1 · READ FULL BY STAGE
触及对应阶段时，以下文件必须**全文阅读**。

不是“搜索关键词”，不是“看摘要”。

详见第 5 节。

---

## T2 · SKIM / LOOKUP
允许粗读或按需定位：

- 旧 Build Info
- 已被新权威文档完整 supersede 的阶段报告
- 历史测试日志
- 不影响当前 Product Truth 的旧 donor 研究
- 历史 PASS8/PASS9 / Phase2.5 证据

用途：
- provenance
- archaeology
- compatibility
- regression origin

不得反向覆盖 T0/T1。

---

## T3 · HISTORY ONLY
明确被新裁决覆盖的旧方案。

必须在 Context Index 标记：

```text
status: HISTORY_ONLY
superseded_by: ...
```

默认禁止拿来指导当前 GUI。

---

# 4. 每 Session 上下文恢复清单

开工前必须记录：

```text
Repo:
Branch:
HEAD:
Worktree clean/dirty:
Current overall phase:
Previous completed patch:
Current intended patch:
Known debts:
Tests previously run:
Tests blocked:
Current production owner:
```

如果任何一项未知：

> 先查，不编码。

---

# 5. 四阶段全文阅读矩阵

## PHASE A · Shared Spatial Kernel / Production Owner Cleanup

### 必须全文读

1. `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
2. `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
3. `LCOS_v015_三Surface交互同构硬规则_20260831.md`
4. `LCOS_v015_GUI_ProductionPath_RendererOwner_Overlay回归审计_20260830.md`
5. `LCOS_v015_GUI_全量同类问题排查与修改责任矩阵_20260831.md`
6. `LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`
7. `LCOS_v015_Lovart_Composer_ReferencePick_补充拆解_20260831.md`
8. `LCOS_v015_CodexDesktop_局部锚点_PersistentPanel_交互拆解_20260831.md`
9. `LCOS_v015_TodoPanel_MotionToken_源码参数映射_20260831.md`

### 施工域

- Selection
- Multi-selection
- Reference
- Orbit
- Right-click
- Relation
- Pin
- Composer
- Hit target
- Resize
- Overlay
- Camera
- Interaction LOD
- Render/request stability

---

## PHASE B · Object Species / Text / File / Link / HTML / Glyth / Project

### 必须全文读

1. `LCOS_三大视图组件体系筛选表_v01_20260821.md`
2. `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`
3. `LCOS_v015_GUI_ProductionPath_RendererOwner_Overlay回归审计_20260830.md`
4. `LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`
5. `LCOS_v015_Navigation_Pin_Orbit_Receiver_ProjectIdentity_补充收敛表_20260831.md`
6. 当前 File / Link / HTML / Text 对应实现审计与最新 Freeze

### 施工域

- Generic CanvasCard retirement
- Text geometry LOD
- same-face editing
- File OS-like morphology
- Link Compact/Rich/Live
- HTML Web Artifact Host
- Glyth real visual bounds
- ProjectGlazeMark

---

## PHASE C · Context / Workflow / Assembly / Skill

### 必须全文读

1. `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
2. `LCOS_三大视图组件体系筛选表_v01_20260821.md`
3. `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`
4. `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md`
5. `LCOS_v015_Context_Workflow_Component_CameraFocus_审判与收敛_20260831.md`
6. `LCOS_v015_三Surface交互同构硬规则_20260831.md`
7. `LCOS_v015_原文回源审判索引_当前GUI问题对照最初裁决_20260831.md`
8. `LCOS_v015_原文到后续施工计划_差分审计_20260831.md`
9. `LCOS_v015_VIDEO_DONOR_原稿总索引与施工映射_20260831.md`
10. V01/V03/V05 donor 原稿，按 Video Index 全文读

### 施工域

- Structure
- Evolution
- Relationship
- Source
- Scope
- Action Path
- Component Focus/Edit
- Assembly
- Skill Builder
- Root/Subskill
- old owner retirement

---

## PHASE D · Dynamic Glyph / Pin / Material / Motion

### 必须全文读

1. `LCOS_v015_前端最终收敛四阶段_DynamicGlyph_PinVisualSystem_20260831.md`
2. `LCOS_v015_VIDEO_DONOR_原稿总索引与施工映射_20260831.md`
3. `LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`
4. `LCOS_v015_Lovart_Composer_ReferencePick_补充拆解_20260831.md`（若动 Composer）
5. `LCOS_v015_CodexDesktop_局部锚点_PersistentPanel_交互拆解_20260831.md`
6. `LCOS_v015_TodoPanel_MotionToken_源码参数映射_20260831.md`

### 施工域

- HUD size
- screen-space glyph
- Pin colors/shapes
- material hierarchy
- transition tokens
- camera motion
- result materialization
- hover / popover
- contextual controls

---

# 6. Source-Diff Gate

任何 patch 前必须写：

```markdown
## Source-Diff Gate

Original user / freeze:
- ...

Latest explicit override:
- ...

Latest reality feedback:
- ...

Relevant donor source:
- ...

Current construction clause:
- ...

Current production owner:
- ...

Old/competing owner:
- ...

Classification:
- MATCH / PLAN_GAP / REALITY_GAP /
  EXPLICIT_OVERRIDE / IMPLEMENTATION_GAP / WRONG_OWNER
```

不明确：

> STOP。

---

# 7. Patch 粒度

永久规则：

> **One micro-patch = One Product Proposition**

正确：

```text
P-A01 Selection no longer opens Composer
P-A02 Selection IDs no longer merge into Reference IDs
P-A03 Orbit lifecycle no pointerleave close
```

错误：

```text
“顺手把 Interaction 都修一下”
```

只有一个共同原子命题、同一 owner、同一 acceptance 时才允许合包。

---

# 8. Patch 命名

格式：

```text
LCOS_v015_<Phase>_<Seq>_<ShortProposition>_<YYYYMMDD>.patch
```

例：

```text
LCOS_v015_A_01_SelectionNoAutoComposer_20260831.patch
```

Closeout：

```text
LCOS_v015_A_01_SelectionNoAutoComposer_CLOSEOUT_20260831.md
```

Test log：

```text
LCOS_v015_A_01_TESTLOG_20260831.txt
```

---

# 9. 每个 Patch 必须交付什么

最小交付：

1. `.patch`
2. `*_CLOSEOUT.md`
3. test command + result
4. changed-file list
5. manual smoke result（GUI touched 必须有）
6. screenshots / visual notes（视觉 touched 必须有）
7. debt / blocked status

较大施工包另外交付：

8. source snapshot `.zip`
9. `.sha256`
10. `BUILD_INFO.md`
11. patch series manifest

---

# 10. Patch 生成规则

Patch 必须从**明确基线**生成。

Closeout 必须写：

```text
Patch base:
Patch head:
Source tree:
Expected apply target:
```

禁止：

- 从不明 worktree 导 diff；
- 混入其他未说明修改；
- 用旧 patch 猜当前基线；
- patch 里夹带无关格式化。

---

# 11. Diff 审核

每刀结束必须至少检查：

```text
git diff --stat
git diff --check
git diff <touched files>
```

再检查：

```text
有没有 duplicate owner
有没有 stale fallback
有没有旧入口继续 production
有没有 TODO/later/mock
有没有语义注释已经过时
```

---

# 12. Owner Retirement 是 Done 的一部分

“新路径可用”不等于完成。

Done 必须同时证明：

```text
new canonical owner active
+
old competing owner retired / history-only
```

典型：

- Orbit 上线 → Selection Strip 退役
- canonical text edit 接通 → fork-confirm 不再 ordinary flow
- Project same-tab → old new-tab default owner退
- Skill Builder → old recipe/list default entry退

---

# 13. 测试层级

## L1 Static
- syntax
- typecheck
- grep/gate
- diff check

## L2 Unit / Contract
- local unit
- fake provider
- component logic

## L3 Manual Product Smoke
GUI touched 必须。

## L4 Browser E2E
基础产品 smoke PASS 后才跑。

## L5 Real Provider / Bridge
语义链。

## L6 Desktop / Native
Explorer OLE / DPI / multi-monitor / extension / tray。

## L7 Installer / Release

不得跨级冒充。

---

# 14. Manual Product Smoke 门禁

当前阶段优先于 Full E2E。

三个 Surface 必须逐一人工试：

```text
Click
Shift multi-select
Marquee
Ctrl/Cmd Reference
Orbit
Right-click
Pin
Relation
Move
Resize
Composer
Semantic Drop
Focus
```

然后对应 Component / Skill / Assembly。

一眼可见错误：

> 先修，不跑大 E2E 美化错误。

---

# 15. GUI / Visual Donor Gate

触及 GUI interaction / motion / camera / overlay / Pin / Composer / Component：

必须写：

```markdown
## Donor Conformance

Relevant donor:
Parsed source file:
Borrowed behavior:
Exact parameter/token borrowed:
LCOS truth preserved:
Explicitly not copied:
```

Donor 只负责 craft。

产品 taxonomy 仍由 LCOS Freeze 决定。

---

# 16. TodoPanel Code Donor Gate

当前代码 donor：

`lehhair/OpenCodeUI`

证据提交：

- todo panel swap without layout jank
- hide floating actions during todo panel swap

其 exact motion 参数已经转写到：

`LCOS_v015_TodoPanel_MotionToken_源码参数映射_20260831.md`

后续使用：

> 只消费 LCOS motion tokens，不在各组件重新手写一套“差不多的” duration/ease。

---

# 17. 文档更新规则

每刀施工结束不是只写 Handoff。

按事件更新：

## 产品 L0 新裁决
更新：
- Mandatory Preconstruction Context
- Construction Context Index
- 对应 Freeze/Addendum

## 发现 PLAN GAP
更新：
- 原文→施工计划差分审计
- Construction Context Index

## 发现 REALITY GAP
更新：
- Mandatory Context
- 对应 Reality Feedback / audit

## 新 Video / Code Donor
更新：
- Video Donor Index 或 Code Donor section
- 当前阶段阅读矩阵
- Mandatory Context（若变成一级 donor）

## owner 变化
更新：
- Responsibility Matrix / Production Path Audit
- Closeout

## E2E source set 变化
更新：
- FullE2E source index

---

# 18. Index 更新不是可选

每次 Closeout 必须回答：

```text
Context Index changed? YES/NO
Mandatory Context changed? YES/NO
Plan Diff Index changed? YES/NO
Video/Code Donor Index changed? YES/NO
Responsibility Matrix changed? YES/NO
FullE2E Index changed? YES/NO
```

如果 NO：

> 写原因。

这样不会再发生“有一份好文档，但下一轮 Agent 根本不知道它存在”。

---

# 19. Supersede 规则

任何新文档如果声称：

- FINAL
- MASTER
- 唯一权威
- 取代
- 收口

必须附：

```markdown
## Superseded Requirement Mapping

Old requirement:
New location:
Status: kept / changed / retired
Reason:
```

没有 mapping：

> 不得宣称完整吸收旧计划。

这是 8/27 上下文压缩事故以后永久增加的门禁。

---

# 20. 不覆盖历史原稿

原始 Freeze / 用户原稿：

> 不覆写。

新的裁决用 dated Addendum / new authority doc。

Context Index 记录：

```text
authority
superseded_by
history_only
```

这样既不会失忆，也不会被旧文档反向劫持。

---

# 21. Closeout 强制模板

```markdown
# PATCH CLOSEOUT

Repo / Branch / Base / Head:

## Product Proposition
...

## Source-Diff Gate
...

## Full-read sources
- ...

## Current owner
...

## Old owner retired
...

## Files changed
...

## Acceptance
- [ ] ...

## Tests
Static:
Unit:
Manual smoke:
Visual:
Browser E2E:

## Donor Conformance
...

## Blocked
NONE / BLOCKED_ENV / PENDING_NATIVE_QA

## Debt
...

## Index updates
...

## Next action
...

## STOP
Do not start next patch before review.
```

---

# 22. BLOCKED 状态

只允许真实状态：

```text
PASS
FAIL
BLOCKED_ENV
PENDING_NATIVE_QA
NOT_RUN
```

禁止：

```text
“基本 PASS”
“理论上 PASS”
“应该没问题”
```

软件已经够会讲故事了，不需要测试报告也参加创作。

---

# 23. Session Handoff

必须包含：

```text
Repo
Branch
HEAD
Worktree
Current phase
Done patches
Current open patch
Tests run
Tests pending
Debts
Indexes updated
Exact next action
```

并明确：

> 下一 Session 仍必须重读 T0，不允许只读 Handoff。

---

# 24. Context Compression 后

压缩后第一件事：

```text
Read T0 again
```

不是继续敲代码。

如果触及某阶段：

```text
Read its T1 full sources again
```

摘要只能帮助定位，不能替代原文。

---

# 25. Full E2E 何时开始

必须满足：

```text
Original-source conformance PASS
Reality feedback conformance PASS
Human Product Smoke PASS
Correct production owner PASS
Old owner retirement PASS
```

才进入 Full E2E。

---

# 26. 当前四阶段

```text
A Shared Spatial Kernel + Owner Cleanup
↓
B Object Species / Text/File/Link/Glyth
↓
C Context/Workflow/Assembly/Skill
↓
D HUD/Pin/Glyph/Material/Motion
↓
Human Smoke
↓
Browser E2E
↓
Desktop/Native
↓
Release
```

阶段内部仍然是 micro-patches。

---

# 27. 永久禁止

- 只读上一 Handoff；
- 只读摘要不读 T1 原稿；
- contract exists = product done；
- renderer exists = GUI done；
- static gate = E2E；
- old/new owner 并存；
- screenshot 一个修一个但不查同类 owner；
- 为了 Catalog 完整造组件；
- 为了 Entity 存在造 Node；
- 为了能力存在造 Panel；
- 施工完不更新索引；
- FINAL 文档不做 supersede mapping；
- 用户最新实机反馈不进入强制上下文。

---

# 28. 最终句

> **LCOS v0.15 后续施工不再依赖“Agent 记得多少”。**

它依赖：

```text
固定阅读矩阵
+ 原文追溯
+ 最新现实反馈
+ 单命题 Patch
+ Owner Retirement
+ Human Smoke
+ 强制索引更新
```

这才叫 SOP，而不是希望下一位 Agent 恰好记性不错。

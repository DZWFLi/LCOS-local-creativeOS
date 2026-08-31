# LCOS v0.15 · A11 Universal Object / Selection Right-click Ownership Closeout

日期：2026-08-31
Phase：A · Shared Spatial Kernel / Production Owner Cleanup
Product Proposition：**普通 Project Object / 当前 Selection 的低频管理动作由三 Surface 共用的 Right-click owner 承接；普通右键不得再被 Semantic Drop 抢走。**

---

## 1. Baseline

本 sandbox 施工仓是显式重建线：

```text
7e634c8 baseline: RC 44ab06b + S9S10 + frozen context
e768a1c docs: integrate frozen construction SOP
932c1c1 apply A00-A10 convergence
```

A11 开工前 worktree：存在本轮未提交 A11 草稿，仅 `CanvasSceneHost.tsx / SurfaceContextMenu.tsx`；先重新对照 source 后继续收口。

注意：这不是用户本地历史 HEAD 的 SHA 复刻；patch 的 apply base 以本重建线的 `932c1c1` 内容状态为准。

---

## 2. Full-read / authority sources

按 Phase A T0/T1 Gate 回读：

- `AGENTS.md`
- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md`
- `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
- `docs/v015/convergence/THREE_SURFACE_INTERACTION_RULE_20260831.md`
- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/VIDEO_LOVART_TRAE_TAPNOW_ANALYSIS_20260830.md`
- `docs/v015/convergence/VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`
- `docs/v015/convergence/VIDEO_CODEX_DESKTOP_ANALYSIS_20260831.md`
- `docs/v015/convergence/TODOPANEL_MOTION_TOKEN_20260831.md`
- A10 Closeout + current source.

本 patch 没有修改产品 taxonomy。

---

## 3. Source-Diff Gate

### Original User / Freeze

8/21 原始 GUI / Spatial 主稿：

- Main / Context / Workflow 是三个一级独立工作现场；
- 共用 SpatialCanvas / Selection / Pan / Zoom / Drag / Drop 等 interaction foundation；
- Surface projection 不拥有 Project Entity truth；
- `remove-projection != delete-project-entity`；
- 每个施工包必须独立完成 Done / Acceptance 再进入下一包。

8/16 原施工纪律：

- 禁止“接口存在 = 产品完成”；
- GUI touched 必须有 Manual Smoke；
- Golden Project 真人 Gate 明确包含“右键菜单三 Surface 归位”。

### Latest Explicit Override / Reality Feedback

当前 v0.15 冻结：

```text
Object Orbit
= single object high-frequency 3–5 actions

Right-click
= universal low-frequency management

Selection
= transient interaction state, not Project Object
```

Right-click 只显示真实 capability；没有 canonical owner 的 Assembly / Relation / Source 不得提前画出来。

### Current Code Owner Before A11

- `SurfaceContextMenu` 只负责 blank-surface menu；
- Main `CanvasCard` 对 node `contextmenu` 做 `stopPropagation()`；
- Context / Workflow ordinary `SurfaceObject` 没有 shared object-management context menu；
- Main 与 shared non-main Semantic Drop 在**secondary pointerdown** 就安装全局 `contextmenu` guard，因此普通右键即使未移动也被拦截；
- A10 group action notch 是显式 Selection Field owner，但不等于真实 right-click；
- `ProjectCanvas` Props / call-site 已有 `onFocusNode`，但函数 destructuring 漏掉该变量。

### Classification

```text
IMPLEMENTATION_GAP
+
WRONG_OWNER
```

Semantic Drop 抢普通右键是 implementation collision，不是新产品语义。

A09 的 `onFocusNode` 漏 destructuring 是**历史 source/static gate 未覆盖的 implementation defect**，不能改写 A09 完成标准假装它从未存在。

---

## 4. What changed

### 4.1 Shared object / Selection contextmenu owner

`CanvasSceneHost` 现在对三 Surface 的普通 Project object 使用同一入口：

```text
contextmenu target
→ closest([data-node-id])
→ resolve current Selection
→ close top Orbit if present
→ shared object management menu
```

行为：

```text
右键一个未选对象
→ 该对象成为 sole Selection
→ 打开对象菜单

右键当前 multi-selection 中任一成员
→ 保持整组 Selection
→ 打开 Selection 管理菜单
```

没有新建 Selection Entity / Node。

### 4.2 Capability-driven actions

只在真实 owner 存在时显示：

- Open / Enter：仅 single object 且有真实 deeper destination；Conversation 使用现有进入现场动作；
- Focus / 在哪：Main 单/多 + Context/Workflow 单/多复用现有 Project Focus；
- Pin / Unpin：复用 canonical Spatial Marker provider；
- Add / Remove Reference：复用 SharedComposerCommandState explicit Reference Set，Conversation 不伪装成 ordinary Reference；
- Duplicate View：仅 Main 已有 canonical duplicate owner 时出现；
- Remove Projection：Main 使用既有 remove-view owner；Context / Workflow 新接现有 exact Presentation member/entity-ref removal helper。

明确没有：

```text
Assembly
Relation
Reveal Source
More filler
```

这些仍未完成 canonical owner wiring，必须 fail-close。

### 4.3 `remove-projection != delete-project-entity`

Context / Workflow 删除动作同时处理：

- exact member View ids；
- exact Presentation Entity refs；

调用现有：

- `removeExactPresentationMembers()`
- `removeExactPresentationEntityRefs()`

只修改当前 Surface Presentation membership；Project Entity 保持不变。

### 4.4 Semantic Drop no longer steals ordinary right-click

此前：

```text
secondary pointerdown
→ install contextmenu guard immediately
→ no movement
→ pointerup
→ browser contextmenu still suppressed
```

现在：

```text
secondary pointerdown
→ Semantic Drop candidate only
→ no preventDefault for contextmenu
→ no pointer capture / no menu guard yet

movement > 4px
→ becomes real Semantic Drop
→ pointer capture
→ install menu guard
→ right-drag behavior unchanged

pointerup without movement
→ ordinary right-click contextmenu reaches shared management owner
```

拖动结束后 guard 保留约 300ms，只压制 Chrome/Edge 在 pointerup 后派发的 post-drag contextmenu。

因此：

```text
right-click != right-drag
```

正式恢复。

### 4.5 A09 implementation correction

A11 开工回查真实 source 时发现：

```text
Props: onFocusNode exists
App: onFocusNode passed
ProjectCanvas body: onFocusNode used
ProjectCanvas destructuring: missing
```

A09 因完整 Typecheck 当时为 `BLOCKED_ENV`，静态 gate 没有抓住这个 undeclared identifier。

A11 已补回 destructuring，并把该事实记录到当前 closeout / audit / index。

这不是修改 A09 的历史验收口径；而是明确：

> A09 的 source/static assertions 当时通过，但 runtime/type semantic completeness 没有被证明。

---

## 5. Surface parity

### Main

A11 范围：**PASS by source/static**

- ordinary object / group right-click shared owner；
- Focus / Pin / Reference / Duplicate / Remove Projection 按 capability；
- normal right-click 与 Semantic Drop 分离。

### Context

A11 范围：**PASS by source/static**

- project material `[data-node-id]` 进入同一 shared owner；
- multi Focus 接现有 Project Focus；
- Remove Projection 接 canonical Presentation member/entity-ref removal。

### Workflow

A11 范围：**PASS by source/static**

- project material `[data-node-id]` 进入同一 shared owner；
- multi Focus / Remove Projection 同上。

### Explicitly NOT claimed

Workflow Step / Surface Component / relation edge 等**非普通 Project material species** 的 domain-specific right-click 还没有全部收成同一 capability adapter。

所以本 patch 不能写：

> “all species three-Surface right-click parity complete.”

只能写：

> **ordinary Project Object + current Project Object Selection right-click owner is shared across Main / Context / Workflow.**

---

## 6. Donor conformance

Relevant donors：

- Trae：menu 从实际 trigger/source 附近出现，small blast radius；
- Codex Desktop：local action stays local；persistent manager 不冒充 local menu；
- TodoPanel：已冻结 transient hierarchy/motion token，但 A11 不借机重做 Phase D 动效。

Borrowed：

- contextual menu has visible source；
- one dominant transient layer；
- existing Orbit yields before menu；
- no global modal / panel takeover。

Explicitly NOT copied：

- donor taxonomy；
- donor IA；
- donor Todo/Repo semantics。

---

## 7. Files changed

Production：

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/shell/CanvasSceneHost.tsx`
- `apps/web/src/features/shell/SurfaceContextMenu.tsx`
- `apps/web/src/features/spatial/semanticDrop.ts`
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`
- `apps/web/src/product-interface.css`

Tests/Gates：

- `scripts/validate-v015-a11-right-click-owner.mjs`
- `tests/e2e/right-click-ownership.spec.ts`

Docs：

- 本 Closeout
- Construction Context Index
- Responsibility Matrix
- Production Owner Audit
- Frontend Convergence Plan

---

## 8. Acceptance

- [x] Simple right-click on ordinary Project object has a shared management owner.
- [x] Main / Context / Workflow project materials use the same `CanvasSceneHost` owner.
- [x] Right-clicking a member of an existing multi-selection preserves that Selection.
- [x] Right-clicking an unselected object makes it sole Selection.
- [x] Open Orbit yields before context menu becomes dominant transient UI.
- [x] Ordinary right-click is no longer swallowed by Semantic Drop.
- [x] Right-drag >4px remains Semantic Drop and suppresses its post-drag native menu.
- [x] Reference remains explicit; Conversation is not turned into an ordinary Reference.
- [x] Pin uses canonical Spatial Marker truth.
- [x] Context / Workflow Remove Projection preserves Project Entity truth.
- [x] Assembly / Relation unavailable owner remains hidden.
- [x] A09 `onFocusNode` missing destructuring corrected and recorded rather than hidden.
- [x] Browser regression source added.
- [ ] Browser runtime actually executed in this sandbox.
- [ ] Human visual/manual smoke actually executed in this sandbox.

因此 runtime verdict 不得写 PASS。

---

## 9. Tests actually run

### Source/static

```text
A03 Orbit Anchor Stability                 3/3 PASS
A04 Selection Composer Ownership           4/4 PASS
A05 Selection Reference Separation         8/8 PASS
A06 ExecutionItem Fail-Close               8/8 PASS
A07 Project Navigation Ownership           5/5 PASS
A08 Canonical Text Edit                    9/9 PASS
A09 Universal ObjectOrbit                 10/10 PASS
A10 Selection Group Owner                  8/8 PASS
A11 Universal Right-click Ownership       10/10 PASS
R2-D Interaction Grammar                  20/20 PASS
R1-C Unified Command State                12/12 PASS
Spatial Navigation F6A2                   14/14 PASS
R2-C Spatial Navigation Family            16/16 PASS
```

Syntax-only transpile via installed global TypeScript compiler API：

```text
App.tsx                    PASS
ProjectCanvas.tsx          PASS
CanvasSceneHost.tsx        PASS
SurfaceContextMenu.tsx     PASS
semanticDrop.ts            PASS
ProjectionSurfaces.tsx     PASS
```

Diff whitespace check：

```bash
git -c core.whitespace=cr-at-eol diff --check
```

CRLF production files use `cr-at-eol` so EOL carriage returns are not falsely reported as trailing whitespace.

### Full Web Typecheck

```bash
tsc --noEmit -p apps/web/tsconfig.json --pretty false
```

Result：

```text
BLOCKED_ENV
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

### Browser / Vitest / Manual

当前 reconstructed RC 没有 workspace `node_modules` / Playwright runtime dependencies。

```text
Browser E2E          BLOCKED_ENV
Manual Product Smoke BLOCKED_ENV
```

`tests/e2e/right-click-ownership.spec.ts` 已加入但没有冒充执行 PASS。

---

## 10. PLAN GAP / REALITY GAP

### PLAN GAP

本 A11 没发现新的产品 Plan Gap。

原始 8/16 / 8/21 已经要求 shared interaction + 三 Surface right-click 归位；后来只是实现没做完。

### REALITY GAP

没有新增 L0 产品语义。

本轮发现的是两个 Implementation Gap：

1. right-drag Semantic Drop 抢走 simple right-click；
2. A09 `onFocusNode` destructuring 遗漏。

二者都由既有冻结规则直接裁决。

---

## 11. Index updates

```text
Mandatory Context changed?       NO
Reason: no new L0 product rule.

Construction Context Index?      YES
Plan Diff Index?                 NO
Video/Code Donor Index?          NO
Responsibility Matrix?           YES
Production Owner Audit?          YES
Frontend Convergence Plan?       YES
FullE2E Index?                   NO
```

---

## 12. Debt / next boundary

Still not done in A11：

- Surface Component / Workflow Step / Relation Edge domain-specific right-click adapter；
- Relation intent must still move to Select → Orbit → Relation → source port lifecycle；
- Assembly object-local entry；
- Overlay top-owner full convergence；
- species-specific resize / hit target / camera framing / LOD remaining Phase A work；
- browser/manual verification when runtime dependencies are available。

Next admissible micro-patch must be chosen only after rereading A-phase source/index; do not turn A11 into a claim that all contextual actions are complete.

---

## Verdict

```text
Implementation/source-static: PASS
Full typecheck:               BLOCKED_ENV
Browser E2E:                  BLOCKED_ENV
Manual Product Smoke:         BLOCKED_ENV
```

A11 proposition is closed at source/static level; **product runtime acceptance remains pending environment**.

STOP.

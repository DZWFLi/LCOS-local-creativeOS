# LCOS v0.15 · A09 Universal ObjectOrbit Coverage Closeout

日期：2026-08-31  
性质：Phase A · Shared Spatial Kernel / Production Owner Cleanup  
命题：**普通 Project object 的单对象高频动作必须由跨 Main / Context / Workflow 共用的 ObjectOrbit 行为壳承接；Selection Strip 不再拥有单对象默认动作。**

---

## Baseline

- Repo: `/mnt/data/lcos_full_src`
- Branch: `gpt/v015-a06-execution-fail-close`
- Patch base: `0e660cd` (`fix(gui): wire canonical text artifact editing`)
- Patch head: this A09 commit (`git rev-parse HEAD` after apply)
- Dirty files before A09: none
- Dirty files after implementation: only A09 production / regression / context-index files listed below

---

## Product Proposition

```text
Click one ordinary Project object
→ Selection remains Selection
→ object-local Universal ObjectOrbit appears
→ only real capabilities become satellites
```

本 patch 只建立 single-object Universal Orbit coverage。

它**不**把 multi-selection 塞进 single-object Orbit，也**不**伪造尚未接线的 Relation / Assembly / More。

---

## Source-Diff Gate

### Original User / Freeze

- 2026-08-21 Spatial Surface 主稿冻结 Main / Context / Workflow 为三个一级自由工作现场，但共用同一 Spatial Surface Engine 与 Selection / Pan / Zoom / Drag / Drop 等物理底座。
- Surface projection 不拥有 Project Entity truth；交互行为应复用 shared primitive，而不是三个 Surface 各建一套动作 UI。

### Latest Explicit Override / Reality Feedback

- Click = Selection + Selection Field + Object Orbit；普通 Click 不得自动打开 Composer。
- Orbit = object-local 高频动作层，3–5 个 satellite，capability-driven。
- unsupported action 必须隐藏，不能用 read-only / disabled 假按钮冒充能力。
- Main / Context / Workflow 必须共享同一 Universal Orbit 交互语法。
- Selection Strip 是旧过渡 owner；但不能在普通 Artifact Orbit coverage 建立前先删，避免能力真空。
- one dominant transient UI：显式 Composer 打开时 Orbit 应让位。

### Relevant Donor Evidence

- TapNow：content = body，controls = satellites；对象不因 selected 改物种。
- Lovart：contextual controls 贴近对象，不覆盖内容；progressive disclosure。
- TodoPanel code donor 的 local swap token属于后续 Motion 接线，本 A09 不修改 ObjectOrbit motion implementation。

### Current Production Owner before A09

- `ObjectOrbit.tsx` 行为壳已经存在，并经 A02/A03 修复 click-open lifecycle 与 anchor ownership。
- Main 只有 Conversation Glyth 真正消费 Orbit。
- Context / Workflow 的 `SurfaceObject` 无普通对象 Orbit。
- `ProjectCanvas` 的 Selection Strip 仍是普通单对象 `在哪 / 整理这些 / More` 的默认动作 owner。

### Classification

```text
IMPLEMENTATION_GAP
+
WRONG_OWNER
```

---

## Authoritative Path after A09

### Main ordinary object

```text
CanvasCard click
→ canonical Selection
→ ProjectObjectOrbit
→ shared ObjectOrbit
```

Conversation 继续使用其专门 capability projection，但行为壳仍是 `ObjectOrbit`。

### Context / Workflow material object

```text
SurfaceObject click
→ canonical shared Selection
→ ProjectObjectOrbit
→ shared ObjectOrbit
```

同一组件覆盖两个 Surface，不建立 `ContextObjectOrbit / WorkflowObjectOrbit` 第二套行为。

### Capability projection

当前已真实接线：

```text
Open
→ only when the object has a real deeper destination

Locate / 在哪
→ only when Project Focus callback exists

Pin / Unpin
→ only when canonical ProjectSpatialMarker runtime exists
```

当前明确 fail-close：

```text
Relation
Assembly
More
```

它们将在各自 canonical owner 接通后再进入 Orbit；A09 不用占位 satellite 假装完成。

---

## Owner Retirement

### Retired now

Single-object Selection Strip default ownership：

```text
selectedIds.length === 1
→ no Selection Strip
```

普通单对象动作改由 object-local Orbit 承接。

### Intentionally still alive

```text
selectedIds.length > 1
→ temporary group-action Selection Strip
```

原因：当前 multi strip 仍承载真实 group actions：

- Focus / 在哪
- Agent Arrange
- Colony
- Align
- Distribute
- Copy
- Duplicate View
- Remove View

这些动作必须先迁移到正确的 multi-selection contextual owner，再完全删 strip。A09 不制造功能真空。

---

## Files Changed

### Production

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/surfaces/ContextSpaceSurface.tsx`
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`
- `apps/web/src/features/surfaces/SurfaceObject.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/features/ui/ProjectObjectOrbit.tsx`

### Regression / Gate

- `tests/e2e/orbit-lifecycle.spec.ts`
- `scripts/validate-v015-a09-universal-object-orbit.mjs`

### Context / Owner Index

- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- 本 Closeout

---

## Implementation Details

### 1. ProjectObjectOrbit is a projection, not new truth

新增 `ProjectObjectOrbit` 只负责把 `CanvasNode` 当前可用 capability 投影成 `ObjectOrbitAction[]`。

Pin 直接复用：

```text
ProjectSpatialMarkerContext
→ markerForNavigationTarget
→ createMarker / deleteMarker
```

没有新建 Pin store。

### 2. Open fails closed

Collection 的 double-click 在当前产品语义中是 deliberate no-op，因此 Orbit 不显示假 `Open`。

Conversation 也不经过 generic ProjectObjectOrbit。

普通 Artifact 只有在存在：

- Workspace / Context / Workflow deeper target；
- editable text；
- bound Artifact；
- 已支持 preview-shaped material；

时才投影 `Open`。

### 3. Multi-selection cannot leave detached single Orbit

Main 与 shared `SurfaceObject` 都把 single-object Orbit lifetime 绑定到：

```text
selectedIds.length === 1
```

Shift additive / preserved multi-selection 会关闭或不创建 single Orbit。

### 4. Explicit Composer wins transient ownership

Main selection Composer 明确显示时：

```text
Conversation Orbit → close
Project Object Orbit → close
Composer → remains
```

避免 Orbit + Composer 同时竞争。

---

## Acceptance

- [x] Main ordinary Project objects 有真实 object-local Orbit。
- [x] Context ordinary material objects 使用同一 ProjectObjectOrbit。
- [x] Workflow ordinary material objects 使用同一 ProjectObjectOrbit。
- [x] Conversation 保持专门 capability projection，不被 generic Orbit 重复包裹。
- [x] Open 是 capability-driven；Collection / Conversation no-op 不显示假 Open。
- [x] Locate 从 Project Focus owner 接入。
- [x] Pin 复用 canonical Spatial Marker truth；不建第二套 store。
- [x] Marker runtime 缺失时 Pin 隐藏，而不是 disabled/readOnly 假能力。
- [x] Relation / Assembly / More 未接 owner 时隐藏。
- [x] 单对象 Selection Strip 不再 render。
- [x] 多选时 single-object Orbit 不残留。
- [x] Explicit Composer 打开时 Orbit 让位。
- [x] Browser regression 已写入。
- [x] Static owner gate PASS。
- [ ] Browser E2E 真跑：`BLOCKED_ENV`，当前 repo 无本地 Playwright executable；`npx` 尝试无法在 120s 内启动。
- [ ] Manual Product Smoke：`BLOCKED_ENV`。

---

## Tests Actually Run

### A09 static gate

```text
node scripts/validate-v015-a09-universal-object-orbit.mjs
→ 10/10 PASS
```

### Existing Phase A regression gates

```text
A03 Orbit Anchor Stability               3/3 PASS
A04 Selection Composer Ownership         4/4 PASS
A05 Selection Reference Separation       8/8 PASS
A06 ExecutionItem Fail-Close             8/8 PASS
A07 Project Navigation Ownership         5/5 PASS
A08 Canonical Text Edit                   9/9 PASS
Spatial Navigation F6A2                 14/14 PASS
R2-D Interaction Grammar                20/20 PASS
R1-C Unified Command State              12/12 PASS
git diff --check                              PASS
```

### Web Typecheck

```text
npm run typecheck --workspace @local-creative-os/web
→ BLOCKED_ENV
```

Actual failure：

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

### Browser E2E attempt

```text
npx playwright test tests/e2e/orbit-lifecycle.spec.ts --reporter=list
→ could not start within 120s in current dependency-less environment
```

Direct binary census：

```text
node_modules/.bin/playwright → MISSING
node_modules/.bin/vitest     → MISSING
```

因此不声称 Browser / Manual runtime PASS。

---

## Manual Product Smoke Required Later

在 dependency-enabled Web runtime：

1. Main 点普通 Text / Image / File → Orbit 出现在对象旁；Selection Strip 不出现。
2. Orbit 可 `打开 / 在哪 / Pin`，只显示真实 capability。
3. 点 Collection → 不出现无效 `打开` satellite。
4. Shift 加选第二对象 → single Orbit 收口，多选状态保持。
5. Context 点普通 material → 同样 Orbit。
6. Workflow 点普通 material → 同样 Orbit。
7. 打开 Composer → 当前 Orbit 立即让位。
8. Esc / outside / action 仍遵循 A02 lifecycle。
9. Pin 后 reload → canonical marker 仍存在；Unpin 删除同一 marker truth。

---

## Donor Conformance

Relevant donor：

- TapNow
- Lovart

Borrowed behavior：

```text
content remains body
controls become local satellites
progressive disclosure
single dominant transient interaction
```

LCOS truth preserved：

- Object identity 仍来自 Project truth。
- Pin 使用 LCOS Spatial Marker。
- Focus 使用 LCOS Project Focus。
- 没有复制 donor taxonomy / IA。

Explicitly not copied：

- donor 的数据模型；
- donor 的菜单 taxonomy；
- donor 的视觉皮肤。

---

## Index Updates

- Context Index changed? **YES** — A09 closeout + next A10 proposition。
- Mandatory Context changed? **NO** — 没有新的 L0 产品裁决。
- Plan Diff Index changed? **NO** — 没发现新的 Plan Fidelity Gap。
- Video/Code Donor Index changed? **NO** — donor 未变化。
- Responsibility Matrix changed? **YES** — A09 single-object strip retirement / ordinary Orbit coverage。
- Production Owner Audit changed? **YES** — Universal Orbit owner addendum。
- FullE2E Index changed? **NO** — 只新增 targeted browser regression，不改变 FullE2E source set。

---

## Debt / Explicitly Not Done

A09 不完成：

- multi-selection group action owner；
- Selection Strip 完全删除；
- universal object right-click；
- Relation Orbit initiation；
- Assembly Orbit entry；
- Orbit More；
- ObjectOrbit spring → frozen 180/260 motion token migration；
- Phase B species visual bounds / geometry。

这些不能被 Closeout 偷写成 Done。

---

## Next Admissible Proposition

**A10 · Multi-selection Group Action Ownership + Selection Strip Retirement**

先审计并迁移：

```text
Focus
Arrange
Colony
Align / Distribute
Copy
Duplicate View
Remove View
```

到正确的 multi-selection contextual owner，再删除最后的 Selection Strip。

禁止把 multi-selection 生硬塞进 single-object Orbit。

---

## Verdict

```text
Implementation / Static Acceptance = PASS
Browser / Manual Product Smoke      = BLOCKED_ENV
```

## STOP

A09 到此停止；未经下一步施工指令不自动进入 A10。

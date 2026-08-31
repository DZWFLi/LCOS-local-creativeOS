# LCOS v0.15 · 前端最终收敛四大阶段 + Dynamic Glyph / Pin Visual System

日期：2026-08-31  
状态：产品定义冻结后的 Frontend Convergence Plan

---

# 0. 阶段判断

当前不再进入“增量产品施工”。

剩余工作主要是：

1. 正确能力成为唯一 production owner；
2. 三 Surface 共用交互真正接通；
3. 组件 / Artifact 恢复正确 morphology；
4. HUD / Pin / Glyph / Motion 统一视觉语言；
5. 最后做 Human Smoke → E2E → Release。

原则：

> 不再发明新体系。  
> 不再因为发现 UI 缺口就新增 Panel / Node / Mode。  
> 优先接通、退旧、还原、统一。

---

# 1. Phase A · Shared Spatial Kernel / Production Owner Cleanup

这是第一刀，必须先做。

统一 Main / Context / Workflow：

- Selection
- Shift Multi-select
- Marquee/Lasso
- Ctrl/Cmd Reference
- Universal Object Orbit
- Right-click
- Relation
- Pin
- Composer
- Semantic Drop
- Hit Testing
- Resize
- Camera Focus
- Overlay Placement
- Interaction LOD

同时退旧：

- Selection Strip — **DONE A10**
- second-click auto Composer
- Selection → Reference merge
- pointerleave Orbit close
- generic relation launch point — **A12 Main ordinary-object owner retired; Context/Workflow/Workspace parity still open**
- old fork-before-edit
- stale modal owners
- old Project new-tab default
- status-derived Execution actions

目标：

> 用户进入三个 Surface，手不需要重新学习。

---

# 2. Phase B · Object Species / Text / File / Glyth / Link / Project Identity

退掉 Generic CanvasCard / generic white SurfaceFrame 的视觉 ownership。

## Text
- Geometry LOD
- Active Reading
- Same-face Edit
- Immersive Detail
- canonical edit wiring

## File
- OS-like icon + filename
- capability-based Orbit
- unknown file 也可存在

## Link
- Compact / Rich / Live
- `.link.md` hidden
- sourceKind owns identity

## HTML
- Web Artifact Preview Host

## Glyth
- real body bounds
- no huge invisible card
- stable Orbit

## Project
- ProjectGlazeMark
- manual world-size
- same LCOS organic material family

目标：

> 每个对象先像自己，不再先像“一个 LCOS 卡片”。

---

# 3. Phase C · Context / Workflow / Assembly / Skill Restoration

这是把原稿真正恢复到 production。

## Context
- Structure = structure island / branch map
- Evolution = timeline strip / track
- Relationship = local relation field
- Source = provenance rail
- Focus = same-canvas camera framing
- 不再 generic component card

## Workflow
- Scope = Component / Field
- Path = real relation/path truth
- Review / Checkpoint 用 native truth
- 不做 operation-room chrome
- 三 Surface shared interaction 完整可用

## Assembly
- 所有 Surface / Object 可直接进入
- target 自动带入
- spatial warehouse
- Reference 与 Assembly 严格分工

## Skill Builder
- Text Outline
- Mind Map
- Root/Subskill
- Direct Manipulation
- Reorder / Rename / Color / Replace
- old recipe/list owner 退役

目标：

> 代码层已经有的 Truth，终于以原本产品语言出现。

---

# 4. Phase D · HUD / Pin / Glyph / Material / Motion System

最后统一视觉“手感”。

这层不改变产品结构。

核心 donor：

- TapNow Pin / color point
- Lovart contextual controls
- Trae micro interaction
- Codex Desktop local anchor / progressive disclosure

---

# 5. Dynamic Glyph 的三层尺寸体系

必须彻底区分：

## A. World Object Body

例如：
- Image
- Text
- Project Glaze
- Glyth
- Context Component

尺寸：

> world-space。

可以随 camera zoom 视觉缩放。

可以由用户 resize。

---

## B. HUD Controls

例如：
- Orbit satellite
- resize handle
- relation port
- more
- close
- edit
- pin action

尺寸：

> screen-space。

不随 camera zoom 缩没。

建议：

```text
Primary control visual: 28–32px
Primary hit target:    36–40px

Secondary visual:      22–26px
Secondary hit target:  32–36px

Icon inside control:   15–18px

Resize handle visual:  4–7px
Resize hit target:     12–16px
```

---

## C. Pin / Marker Glyph

Pin 是 Wayfinding Glyph。

它是 hybrid：

> anchored in world，rendered in screen-space。

建议：

```text
Rest core:       12–16px
Rest hit target: 28–32px

Hover core:      16–20px
Active core:     18–22px

Cluster:         24–30px
Cluster hit:     34–40px
```

远 zoom 不允许继续缩。

---

# 6. 缩放算法

不要让控制直接继承 Canvas transform。

推荐所有 HUD / Pin 通过 screen-space overlay layer 绘制。

概念：

```text
world position
→ camera projection
→ screen x/y
→ HUD renderer
```

如果暂时必须在 world DOM 中：

```text
counterScale = 1 / cameraZoom
```

但必须 clamp：

```text
0.85 <= visual emphasis <= 1.15
```

避免 zoom 极端时反向放得荒唐。

真正长期正确方案仍是：

> Object body world-space / interaction HUD screen-space 分层。

---

# 7. Pin Shape System

Pin 的颜色和形状是：

> 用户自己的 wayfinding identity。

不要用来替代文件类型。

文件仍使用 OS-like icon。

建议只保留 6 个非常简单的 SVG primitive：

1. Circle
2. Rounded Square
3. Diamond
4. Triangle
5. Ellipse
6. Parallelogram

可选第 7 个：
- Hexagon

不要继续扩 20 种。

---

# 8. Color System

颜色首先服务：

- Pin group
- Project / Glaze identity
- Selection / active identity accent
- Relation group / semantic highlight

不要所有 button 都染色。

建议 6 个主 identity color token：

- Green
- Blue
- Violet
- Amber
- Coral/Rose
- Cyan

以及：
- Neutral / graphite

每个颜色提供：

```text
core
hover
selected rim
muted background
```

用户可以命名：

```text
蓝色 → “客户反馈”
紫色 → “视觉参考”
绿色 → “已确认”
```

Pin HUD 显示的是：
- shape
- color
- user label

不是内部 UUID。

---

# 9. Color + Shape 的原则

颜色不能单独承担意义。

因为：
- 色觉差异
- 相近颜色
- 屏幕差异

所以 Pin identity：

```text
Color
+
Shape
+
User label
```

例如：

```text
Blue Circle      = 客户反馈
Violet Diamond   = 视觉参考
Green Triangle   = 已确认
```

Top Pin HUD 可以只显示 glyph。

Hover 才显示：

```text
视觉参考 · 4
```

---

# 10. Pin Material

Pin 不应该是厚重 glass button。

最合适：

> solid colored core + restrained luminous rim。

Rest：

```text
solid core
1px soft rim
very subtle single highlight
```

Hover：

```text
scale 1.08
rim brighter
small crisp shadow
```

Selected：

```text
single pulse / settle
```

禁止：
- 永久 breathing
- 大面积 blur halo
- thick glass shell
- plastic candy gloss

这样会比现在偏虚的浅紫/浅灰更“站得住”。

---

# 11. LCOS Material Hierarchy

不要让所有东西都 Liquid Glass。

## Shell / ordinary UI
- porcelain / quiet glass
- low chroma
- thin border
- restrained blur

## Artifact
- content first
- native file/image/text morphology

## Glaze / Glyth
- organic material
- soft volume
- controlled translucency
- identity tint

## Pin / Marker
- crisp solid core
- clearer chroma
- screen-space

## Relation
- thin light / fiber line
- color only when semantic/active

## Selection
- local luminous field
- not a card border

---

# 12. Motion Tokens

## Hover
80–120ms

- opacity
- 1–2px shift
- scale 1.03–1.06

## Orbit / Pin popover
120–180ms

- scale .96/.98 → 1
- opacity
- small radial movement

## Camera locate/read/edit
240–340ms

- easeOutCubic / restrained spring
- no overshoot unless tiny

## Pin arrival
one short pulse:
180–260ms

## Relation draw
direct pointer-follow
release settle:
140–220ms

## Result materialization
empty footprint first
→ skeleton
→ content crossfade

---

# 13. Top Pin HUD

位置：

> screen top-center。

只要有 Pin 就存在。

Rest：

```text
  ●   ◆   ▲
```

Hover：

```text
[视觉参考 · 4]
```

Click：

```text
视觉参考
- Hero Image
- 脚本 v3
- 客户反馈
- Conversation A
```

选择：

```text
camera travel
→ target framed
→ arrival beacon
```

Top HUD 不跟 camera zoom。

---

# 14. Pin 与 Navigation 分工

Navigation：

> 大方向 / region / Surface / workspace。

Pin：

> 精确已知对象。

Search：

> 不知道对象叫什么/在哪。

Focus：

> 已知对象在哪里出现。

四者不互相冒充。

---

# 15. Visual Acceptance

每个 Glyph / HUD 必须在以下 zoom 测：

```text
25%
35%
60%
100%
150%
```

检查：

- visual identity still visible
- hit target still usable
- label does not become noise
- selected state not explode
- no overlap with Orbit / relation / toolbar

再在：
- 1080p
- 1440p
- 4K
- Windows 125% / 150% DPI

验。

---

# 16. 最终施工顺序

```text
Phase A
Shared Kernel + Owner Cleanup
↓
Phase B
Species + Text/File/Glyth/Link
↓
Phase C
Context/Workflow/Assembly/Skill
↓
Phase D
Pin/Glyph/Material/Motion
↓
Manual Product Smoke
↓
Browser E2E
↓
Desktop/Native
↓
Release
```

---

# 17. 一句话

这一阶段真正需要的是：

> **把已经决定正确的 LCOS 做出来，而不是继续决定 LCOS 应该是什么。**

Dynamic Glyph 也一样：

> 世界里的对象可以远近变化，但人的手指和眼睛不会跟 camera zoom 一起变小。


---

# 18. 各阶段 Video Donor 强制回读

总索引：

`LCOS_v015_VIDEO_DONOR_原稿总索引与施工映射_20260831.md`

## Phase A
回读：
- Trae
- TapNow
- Lovart Composer / Reference Pick
- Codex Desktop

## Phase B
回读：
- Lovart
- TapNow

## Phase C
回读：
- TapNow
- Lovart
- Codex Desktop

注意：
Context / Workflow / Assembly / Skill 的产品语义仍以 LCOS 原始冻结稿为 authority；
视频只用于 interaction / presentation craft。

## Phase D
回读：
- TapNow Pin
- Lovart local controls / loading
- Trae micro interaction
- Codex Desktop local anchor / persistent panel separation

任何 Phase D 视觉修改必须标注对应 donor 原稿，不允许只写“参考 TapNow / Lovart”而不指向解析文件。

---

# 21. Phase A closeout status · A11 Right-click ownership

A11 closed the ordinary Project Object / current Project Object Selection management owner:

```text
Main / Context / Workflow project material
→ right-click
→ shared CanvasSceneHost owner
→ capability-driven local menu
```

Done at source/static level:

- Open/Focus/Pin/Reference capability projection;
- Main Duplicate View;
- Context/Workflow exact Remove Projection without Entity deletion;
- multi Selection preservation;
- Orbit yields before management menu;
- simple right-click separated from right-drag Semantic Drop;
- A09 missing `onFocusNode` destructuring corrected and recorded.

Not claimed:

- every component/step/edge species right-click parity;
- Assembly/Relation object-local entries;
- full overlay architecture convergence;
- runtime/browser/manual PASS while environment is missing dependencies.


---

# 22. Phase A closeout status · A12 Relation intent ownership

A12 closes only the Main ordinary-object relation launch owner:

```text
Select
→ ProjectObjectOrbit
→ Relation
→ Orbit yields
→ temporary source port
→ pointer-follow line
→ target commit / blank create-and-connect
```

Retired on ordinary Main nodes:

- permanent/hover `lcos-relation-notch` launch ownership;
- stale R2-D acceptance that required that notch.

Not claimed:

- Context Relation gesture parity;
- Workflow Relation gesture parity;
- Workspace relation owner;
- Conversation Glyth Relation endpoint semantics;
- final receptor hit-slop / visual QA;
- runtime/browser/manual PASS while dependencies are absent.

Therefore Phase A `Relation` remains **OPEN**, despite A12 being source/static closed as one micro-patch.


---

# 23. Phase A completed micro-patch · A13 Cross-surface Relation Gesture Adapter

A13 closes the A12 cross-surface ordinary Project-material physical-gesture gap without flattening Surface semantics:

```text
Main / Context / Workflow ordinary eligible Project material
→ ProjectObjectOrbit
→ Relation
→ Orbit yields
→ shared transient physical gesture
→ Surface-owned canonical persistence
```

Canonical owner split:

- physical source/pointer/receptor state → shared `projectMaterialRelationGesture` adapter;
- Main persistence → existing `ProjectCanvas` edge/connect truth;
- Context persistence → canonical domain Relation callback;
- Workflow Project-material persistence → canonical domain Relation callback;
- Workflow Step→Step action path → remains separate `workflowActionState.edges` truth.

Fail-close remains intentional for:

- Conversation Glyth;
- `scope:*` aggregate projection;
- `workspace:*` aggregate projection.

Source/static evidence:

```text
A13: 12/12 PASS
all runnable validate-v015-* gates: 41 PASS / 0 FAIL / 2 S9/S10 external skips
```

The 8/21 v0.3 raw source is now explicitly adjudicated under SOP-R1 as `RAW_SOURCE_LOST / RECONSTRUCTED_AUTHORITY PASS`, based on surviving upstream/peer originals, later explicit Freeze/L0, delta audit, current source/test evidence, and the 2026-08-31 user adjudication. It is no longer an A13 blocker.

Post-A13 semantic typecheck / runtime / browser / manual proof is still not available in the extracted archive environment and remains follow-up evidence for the real local merge.

Therefore:

```text
A13 source/static closeout: PASS
A13 merge authorization: YES
A13 runtime/manual evidence: BLOCKED_ENV / PENDING LOCAL MERGE
Phase A Relation: OPEN (Workspace / Conversation / hit-halo/runtime debts remain)
Phase A overall: OPEN
Phase B admission: NO
```

---

# 24. Phase A micro-patch · A14 Workspace Relation Intent Ownership

Fresh parity census after the real local A13 merge chooses Workspace source ownership as the next proposition because it is the remaining explicit Relation `WRONG_OWNER`.

A14 target:

```text
Workspace activate/header click
→ local Orbit
→ Relation
→ temporary source port
→ existing Main Relation commit
```

Retire:
- `workspace-relation-notch-*`;
- `.lcos-relation-notch` hover source CSS.

Preserve:
- canonical `workspace:<workspaceId>` aggregate endpoint;
- Main relation persistence;
- Workspace move/resize/activation;
- A13 Context/Workflow view-material adapter;
- Conversation Context Mapping as a separate Semantic Drop/Glyth language.

Still open after A14:
- Conversation ordinary Relation canonical endpoint semantics;
- Context/Workflow aggregate `scope:*` / `workspace:*` relation endpoint adapter;
- final receptor screen-space hit-slop / 12–18px edge-halo motor-tolerance acceptance;
- real Browser E2E and three-Surface/Workspace Human Product Smoke.

Therefore A14 does not authorize Phase B.

---

# 25. Phase A stacked micro-patch · A15 Relation Receptor Screen-space Halo

The user explicitly requested continuation before returning a real local A14 merged HEAD. This section therefore records a **stacked source/static continuation**, not fabricated runtime proof.

Authoritative real local RC remains `6312ace`; source stack is `6312ace → A14 → A15`.

Fresh stacked census reclassifies the remaining items:

- Conversation ordinary Relation = `SEMANTIC_OWNER_UNPROVEN`, remain fail-close;
- Context/Workflow aggregate `scope:*` / `workspace:*` = endpoint-adapter debt, not next owner cleanup;
- receptor motor tolerance = explicit L0 acceptance gap, therefore A15.

A15 target:

```text
explicit Relation receptor body
+ invisible 16px screen-space radial halo
→ receptive target
→ existing canonical commit
```

The halo does not alter visual bounds / Selection bounds / layout geometry. Context and Workflow also yield Marquee/material Drag pointer ownership while Relation is active so a halo click can actually commit.

A15 does not widen Conversation or aggregate endpoint semantics.

After A15 source/static, Phase A remains OPEN for semantic endpoint debt plus real local Browser/Human proof. Phase B remains NOT ADMITTED.


---

# 26. Phase A stacked micro-patch · A16 Canonical Relation Endpoint Adapter

The user explicitly requested continuation before returning a real local A14+A15 merged HEAD. Provenance therefore remains:

```text
real RC 6312ace
→ A14
→ A15
→ A16 source/static
```

Fresh source census finds that the old Context/Workflow direct Relation save path still assumes:

```text
physical node id == canonical view id
```

That is false for already-proven Project object species:

- anchored Core Note → `note`;
- Collection/Context/Workflow container View with `opensScopeId` → `scope`;
- explicit `scope:*` projection → `scope`;
- explicit `workspace:*` projection → `workspace`.

A16 adds a shared canonical endpoint resolver and keeps Conversation ordinary Relation fail-close.

Target:

```text
A13 physical gesture
→ A15 receptor tolerance
→ A16 physical-id → canonical endpoint resolution
→ existing Surface-provenance saveRelation
```

No generic `connect()` is introduced. Main relation persistence, A14 Workspace source owner, Conversation Context Mapping, and Workflow Step/action linking remain separate truths.

After A16 source/static, Phase A remains OPEN for Conversation semantic adjudication plus real local Browser/Human proof. Phase B remains NOT ADMITTED.

---

# 27. Phase A micro-patch · A17 Conversation Semantic Relation

Real local baseline: `0691812`.

Fresh post-A16 census resolves the last known Conversation ordinary-Relation semantic ambiguity:

```text
Conversation Project Semantic Relation
→ canonical Domain endpoint = artifact:<conversationArtifactId>

Conversation Context Mapping
→ Semantic Drop / conversation_context
→ separate truth
```

A17 therefore:

- adds `artifact` to the visible-node canonical Relation endpoint resolver;
- admits Conversation only when the real CanvasNode has canonical `conversationArtifactId`;
- keeps missing-conversationArtifactId Conversation fail-close;
- replaces the obsolete read-only Glyth Orbit status satellite with explicit Relation;
- gives Main conversationArtifact-backed Glyth an explicit 16px screen-space Relation receptor;
- reuses existing Main relation session and A13/A16 Context/Workflow persistence owners;
- does not introduce generic `connect()` or merge Conversation Context Mapping.

After A17 source/static, Phase A remains OPEN pending real browser/human/save→reload evidence and a fresh runtime census. Phase B remains NOT ADMITTED.


---

# 28. Phase A candidate · A18 Dialog Dominant Owner Arbitration

Fresh census after A17 finds no new Relation semantic debt. The next explicit owner defect is `DialogsHost` multi-owner rendering: multiple non-null dialog states can render together and `extraDialogs` is opaque to arbitration.

A18 candidate introduces one pure dominant-dialog owner (`editor < surface < child < blocking`), converts complex App dialogs into explicit candidates, and renders only the current dominant dialog while preserving hidden parent application state.

A18 does **not** implement SpatialOverlayPlacement or complete all portal/overlayStack convergence.

The uploaded real A17 merged archive `ec01327` could not be mounted in the current sandbox, so A18 is source/static PASS on `0691812 + exact A17 patch` reconstruction but is **not formally merge-authorized** until exact current-source or local apply validation returns. Phase A remains OPEN; Phase B remains NOT ADMITTED.


---

# 29. Phase A candidate · A19 Selection Composer Transient Ownership

Real local authority reported by user: `5901c02` (A18 locally merged; A18 validator/typecheck/web/local-core all PASS).

Fresh post-A18 census finds that `UnifiedExecutionComposer` itself is missing from overlayStack. With focus inside the Composer textarea, global Esc reaches `escapeTopOverlay()`, finds no Composer owner, then exits through the text-input early return. Main multi-selection can also show group actions beside the open Composer, while Conversation Subcanvas carries a duplicate surface-specific `conversation-work:*` registration.

A19 candidate moves ownership to the shared Composer itself:

```text
UnifiedExecutionComposer
→ overlayStack owner
→ Esc / top-only outside dismissal
→ one local transient slot
```

Main group actions and NodeInfo yield while Composer is dominant; Conversation Subcanvas duplicate registration retires.

A19 does not implement SpatialOverlayPlacement. Phase A remains OPEN.

---

# 30. Phase A candidate · A20 SpatialOverlayPlacement Owner

The user explicitly continues construction before returning a real-local A19 HEAD. Provenance remains:

```text
real local authority 5901c02 (A18)
→ A19 source/static candidate
→ A20 source/static
```

Fresh post-A19 census finds two duplicate contextual geometry owners:

- Main Selection Composer: persisted Selection anchor + hand-written viewport clamp;
- NodeInfoPopover: independent right/left/above clamp with hard-coded footprint.

A20 introduces the canonical screen-space `SpatialOverlayPlacement` owner:

```text
visual target bounds
+ measured overlay size
+ viewport
+ safe insets / occupied rects
+ preferred side
→ nearest low-collision canvas rect
```

First migrated call sites are Main Unified Composer and NodeInfoPopover. Mature ObjectOrbit/Base UI menu positioners are intentionally not rewritten.

A20 architecture/source-static completion does **not** equal visual acceptance. Four-corner, Dock/Rail/Minimap, zoom/DPI and motion-direction QA remain runtime/Human debt. Phase A remains OPEN.

---

# 31. Phase A candidate · A22 Object-local Interaction Grammar

Human GUI review after A21 exposes a final class of shared interaction-language defects rather than Phase B morphology work:

- multi-selection lost normal individual + aggregate selection readability;
- full radial Orbit visually over-occupied the canvas;
- Composer and direct actions were forced to be mutually exclusive;
- right-click duplicated Focus/Pin direct actions;
- Surface Component collapse produced an empty mini-bar with permanent generic chrome.

A22 restores the frozen hierarchy:

```text
Selection / Locator = persistent spatial state
Action Arc = compact direct actions
Compact Composer = AI Work
Right-click / More = management
Component Functional Face = intrinsic instrument work
```

A22 does not implement A23 Compact Composer internals, A24 Voice, Centered Spatial Index navigation, or Phase C Assembly taxonomy. Phase A remains OPEN until local runtime/human gates are satisfied.

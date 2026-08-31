# LCOS v0.15 · A08 Canonical Text Edit Wiring Closeout

日期：2026-08-31
性质：Phase A · Shared Spatial Kernel / Production Owner Cleanup
命题：**普通 Runtime Text 编辑必须修改同一个 Project Artifact 的 canonical current revision；不得先 Fork / Duplicate。**

---

## Product Proposition

```text
Double-click Runtime Text
→ read current canonical body
→ edit
→ PUT /projects/:id/curation/text
→ same Artifact gets a new current Revision
→ same View / same Project identity remains
```

`Duplicate / Fork` 仍是显式用户动作，不是普通编辑的前置条件。

本 patch **不**宣称完成 Phase B 的 Text same-face visual/editor morphology。当前 `InlineNoteEditor` 的 portal/scrim 形态仍留给 Object Species 阶段处理。

---

## Source-Diff Gate

### Original User / Freeze

- 2026-08-16 Interface Productization：禁止把“接口存在”冒充产品完成；每 Session 必须 Read → Audit → canonical path → tests → manual smoke → Acceptance → Handoff → STOP。
- 2026-08-21 Spatial Surface 主稿：同一个 Project Truth 在多个 Surface 只有 projection 差异；Surface 不拥有/复制 Entity truth。

### Latest Override / Reality Feedback

- 普通 Text 编辑应直接演进 canonical Artifact revision。
- “复制并编辑”只保留为显式 Duplicate/Fork。
- Text visual/editor 的 Resting → Reading → Inline Editing → Detail 状态机是后续 Phase B morphology 工作，不用旧 Fork Confirm 代替。

### Current Production Owner before A08

- Core：`PUT /projects/:id/curation/text` + `CurationCommandService.updateText()` 已存在并支持无 `sessionId` 的 GUI direct edit。
- Web：没有 `updateTextArtifact` consumer；`App.tsx` 仍用 `forkPromptId / confirmForkProjection / originTextIdsRef` 阻断普通编辑。
- Session `noteBody` cache 可无 revision 约束覆盖 runtime projection。

### Classification

```text
IMPLEMENTATION_GAP
+
WRONG_OWNER
```

A08 审计中另发现一个同命题下的 Core read implementation gap：Primary ArtifactView 的 curation read 原先优先固定 `view.revisionId`，因此第一次 canonical edit 后第二次编辑可能重新读到创建 View 时的旧 revision。

---

## Authoritative Path after A08

### Read

```text
Runtime Text double-click
→ LocalCoreClient.readCurationViews
→ POST /projects/:id/curation/read
→ Primary View follows Artifact.currentRevisionId
→ bounded current body
```

### Write

```text
Inline editor save
→ LocalCoreClient.updateTextArtifact
→ PUT /projects/:id/curation/text
→ CurationCommandService.updateText
→ reviseManagedTextArtifact
→ immutable new revision file
→ Artifact.currentRevisionId advances
→ reload/hydrate same View
```

### Historical View rule

```text
referenceKind = primary
→ Artifact.currentRevisionId first

referenceKind = explicit_additional
→ view.revisionId first
```

这与 Web runtime projection 的 live primary / pinned historical semantics 对齐。

---

## Old Owners Retired

Production path 已删除：

- `forkPromptId`
- `originTextIdsRef`
- `confirmForkProjection`
- `DialogsHost.confirmForkProjection`
- 普通 Text edit 的“复制并编辑”确认框
- “Core text revision API 未落地”的 stale production assumption
- 无 revision 绑定的 runtime `noteBody` / derived `noteOutline` cache 覆盖 canonical body

`Duplicate` 本身没有删除，仍保留成显式独立动作。

---

## Files Changed

### Core

- `apps/local-core/src/curation-query-service.ts`
- `apps/local-core/tests/curation-query.test.ts`

### Web

- `apps/web/src/App.tsx`
- `apps/web/src/features/shell/DialogsHost.tsx`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/state/notePresentationMemory.ts`
- `apps/web/tests/localCoreClient.test.ts`

### Regression / Gate

- `tests/e2e/canonical-text-edit.spec.ts`
- `scripts/validate-v015-a08-canonical-text-edit.mjs`

### Context / Owner Index

- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- 本 Closeout

---

## Implementation Details

### 1. Web consumes the existing canonical Core write

新增：

```text
LocalCoreClient.updateTextArtifact()
LocalCoreClient.readCurationViews()
```

普通 Runtime Text 不再先更新 Web projection 再“希望 Core 跟上”。Core write 成功以后才关闭 editor / hydrate projection。

### 2. Edit entry reads current canonical body first

Runtime text double-click 先 bounded read。若：

- read 失败 → fail-close，不打开 editor；
- node 不存在 → fail-close；
- 文本超过 30k safe inline-edit bound / read truncated → 打开 Reader，不把截断内容写回 canonical truth。

### 3. Session cache becomes revision-bound

`notePresentationMemory` 新增：

```text
noteBodyRevisionId
```

Runtime rehydrate 只在 cache revision 与当前 canonical revision 完全相等时恢复 `noteBody` 和 body-derived `noteOutline`。

### 4. Save-and-convert cannot bypass canonical save

Inline editor 的“保存并转为大纲导图”现在必须等待 `saveNoteBody()` canonical save 成功，再修改 presentation layout。

### 5. Primary curation read follows current truth

A08 审计抓到并修复：

```text
旧：view.revisionId ?? artifact.currentRevisionId

新：
primary → artifact.currentRevisionId ?? view.revisionId
explicit_additional → view.revisionId ?? artifact.currentRevisionId
```

浏览器 regression 也增加**连续编辑两次**，第二次必须读到第一次生成的 current revision，而不是初始 revision。

---

## Acceptance

- [x] 普通 Runtime Text 不再弹 Fork/Duplicate Confirm。
- [x] Web 已接 canonical `PUT /curation/text`。
- [x] 编辑器打开前读取 current canonical body。
- [x] truncated bounded read 不允许进入可写 editor。
- [x] canonical write 成功后同一个 Artifact identity 前进到新 revision。
- [x] Primary curation read 跟随 Artifact current revision。
- [x] Explicit additional View 仍可保持 pinned historical revision。
- [x] Session body / derived outline cache 必须 revision-match 才能恢复。
- [x] “保存并转导图”不能绕过 canonical save。
- [x] Duplicate/Fork 仍保留显式独立入口。
- [x] stale fork owner 在 production source 中为 0。
- [x] 两次连续 canonical edit Browser regression 已写入。
- [ ] Browser E2E 真跑：`BLOCKED_ENV`，当前提取 RC 无安装依赖。
- [ ] Manual Product Smoke / Core restart：`BLOCKED_ENV`。

---

## Tests Actually Run

### Static A08 gate

```text
node scripts/validate-v015-a08-canonical-text-edit.mjs
→ 9/9 PASS
```

覆盖：

1. Web curation read + PUT route consumer
2. current body hydrate before editor
3. canonical write owner
4. fork-before-edit retirement
5. revision-bound body/outline cache
6. save-and-convert waits for canonical save
7. primary read follows current revision
8. Core GUI direct edit remains supported
9. Duplicate remains explicit separate action

### Existing Phase A regression gates

```text
R2-D Interaction Grammar             20/20 PASS
A04 Selection Composer Ownership      4/4 PASS
A05 Selection Reference Separation    8/8 PASS
A06 ExecutionItem Fail-Close          8/8 PASS
A07 Project Navigation Ownership      5/5 PASS
R1-C Unified Command State           12/12 PASS
git diff --check                           PASS
```

### Typecheck

Web:

```text
npm run typecheck --workspace @local-creative-os/web
→ BLOCKED_ENV
TS2688: Cannot find type definition file for 'node'
TS2688: Cannot find type definition file for 'vite/client'
```

Local Core:

```text
npm run typecheck --workspace @local-creative-os/local-core
→ BLOCKED_ENV
TS2688: Cannot find type definition file for 'node'
```

### Targeted Local Core test attempt

```text
npm test --workspace @local-creative-os/local-core -- --run tests/curation-query.test.ts
```

Pretest domain build succeeded, but test runner cannot start:

```text
vitest: not found
→ BLOCKED_ENV
```

因此没有把 unit / browser / manual runtime 写成 PASS。

---

## Donor Conformance

本 patch 是 canonical wiring / owner retirement，不是视觉 motion patch。

Relevant donor：无强制视觉借用。
LCOS Truth preserved：Text remains same Project Artifact; UI projection does not own/copy truth。
Explicitly not copied：没有用 donor taxonomy 或新 editor model 替换 LCOS Text state model。

---

## Main / Context / Workflow Parity

A08 修改的是共享 Project Artifact text truth 和 Main 当前 ordinary Text edit consumer。

- Main：canonical edit wiring 已接通。
- Context / Workflow：同一 Artifact current revision 会通过共享 project/runtime truth 投影；本 patch 不新建 Surface-local text truth。
- Phase B 若在三 Surface 开 same-face editing，必须复用这条 canonical read/write owner，不得再造局部正文存储。

---

## Explicitly Not Done

- `InlineNoteEditor` portal/scrim → same-face editing morphology。
- Text Geometry LOD。
- selected→full 内容/geometry policy。
- Universal ObjectOrbit。
- Selection Strip retirement。
- Overlay placement / visual motion。

这些不能因为 A08 canonical wiring 正确就冒充完成。

---

## Index Updates

```text
Context Index changed?             YES
Mandatory Context changed?         NO — 无新 L0 产品裁决
Plan Diff Index changed?           NO — 本刀为已知 implementation gap + 新发现的同链 Core read bug
Video/Code Donor Index changed?    NO
Responsibility Matrix changed?     YES
Production Owner Audit changed?    YES
FullE2E Index changed?             NO
```

---

## Next Admissible Proposition

经 source census，不能直接先删 Selection Strip：当前 `ProjectCanvas` 的 production ObjectOrbit 仍然只为 Conversation Glyth 打开，普通 Artifact 没有 Universal ObjectOrbit。

因此下一刀锁为：

> **A09 · Universal ObjectOrbit Coverage Foundation**

目标只建立普通 selected Artifact 的 capability-driven ObjectOrbit production owner / action coverage foundation；Selection Strip retirement 必须等其必要动作有 replacement 后再单独做下一刀。

---

## Verdict

```text
IMPLEMENTATION / STATIC ACCEPTANCE: PASS
RUNTIME / BROWSER / MANUAL: BLOCKED_ENV
OVERALL SESSION VERDICT: BLOCKED_ENV
```

环境 blocker 不污染下一独立 owner-cleanup micro-patch；Release/Full E2E 前必须在完整依赖环境补跑。

## STOP

A08 到此停止。不要在本 commit 内继续 A09。

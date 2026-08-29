# LCOS v0.15 · R1-B Human Language Gate Closeout

Date: 2026-08-29
Baseline package: `LCOS_FULLSTACK_0.1_RC_7f0690d_20260829.zip`
Baseline package SHA256: `b557c42335cd2f2426134f1e28377fa1fe53d58d9cb65890d776a17542900ca2`

## 1. Scope

This micro-patch closes **R1-B · 全站人话 Gate** only.

Frozen rule:

> 技术语义继续精确存在于 contracts / Core / runtime / diagnostics；普通产品 Surface 必须翻译成人能直接理解的动作和状态。

This patch does **not** start R1-C, does not change Core truth, does not change Assembly state architecture, and does not change Pointer / Relation semantics.

## 2. What changed

### 2.1 Added a real static product-language gate

Added:

- `scripts/validate-v015-user-language.mjs`
- root script `check:v015-user-language`
- `check:fast` now runs the language gate first

The gate scans ordinary product surfaces and excludes Diagnostics / tests. It checks rendered JSX copy, user-visible attributes, notices/messages/errors/progress copy, plus known helper copy paths such as `commandDraft` and run-event descriptions.

The gate blocks the frozen internal vocabulary and translated execution terms, including:

- Core / Project Truth
- ReceiverRef / ActiveReceiver / Receiver Glyth / ConnectedConversation
- ContextManifest / OrderedReference / ResultSlot / ChangeSet
- Projection / PresentationState
- Provider / Adapter / RuntimeBinding / Runtime
- FTS / Vector / Embedding / RAG / OCR / MCP / CLI
- Session ID / READ_ONLY / PREPARE / tokens
- Run / Checkpoint / Context Pack / canonical

### 2.2 Humanized execution / receiver / result copy

Updated the ordinary product UI so users see concepts such as:

- `交给哪段对话`
- `这次会参考`
- `结果会放在这里`
- `这次修改`
- `版本 / 保存的现场`
- `这次处理 / 执行`

instead of backend contract names.

Touched paths include:

- Unified Execution Composer
- command draft compatibility reasons
- Canvas Scene Host execution blockers
- Agent Context Surface
- Conversation Controller
- Project Tools
- runtime error presentation
- Work / Deliver / Workflow surfaces
- Workspace history / preview surfaces

### 2.3 Humanized project / assembly / legacy surfaces

Removed product-facing wording such as `Project Truth`, `Local Core`, `Source Provider`, `Project Warehouse`, `Context Pack`, raw runtime state names, and raw ChangeSet copy from ordinary UI.

The underlying data model, API calls, IDs, and persistence semantics are unchanged.

### 2.4 Diagnostics remain truthful

Raw diagnostic payloads remain available where the UI already exposes an explicit **复制诊断信息** action. Product copy is translated; diagnostics are not destroyed.

## 3. Validation

### Passed

- RC SHA256 matches the supplied checksum exactly.
- `node scripts/validate-v015-user-language.mjs`
  - **PASS**
  - 229 ordinary product-surface source files scanned
- TypeScript transpile diagnostics over all modified TS/TSX files
  - **PASS: 33 files**
- `node scripts/validate-spatial-component-foundation.mjs`
  - **22/22 PASS**
- CRLF-aware `git diff --check`
  - **PASS**

### Baseline-equal legacy static gates

The following gates still fail exactly as they already fail on the untouched `7f0690d` RC snapshot. Current output was diffed against the baseline output and produced no differences:

- Main Canvas Human-Golden static: **13/14**
- Main Canvas Human QA Round 1 static: **14/15**
- GUI Human Round 1 Fence+Docs static: **16/20**

These are pre-existing RC debts, not regressions introduced by R1-B.

### Not completed in this sandbox

Full workspace `npm lint / typecheck / test / build` could not be executed because the supplied RC contains no `node_modules`, the sandbox has no npm dependency cache, and `npm ci --ignore-scripts --no-audit --no-fund --prefer-online` timed out during dependency restore.

Therefore this closeout deliberately does **not** claim the full workspace gate passed.

## 4. R1-B status

**Code-complete + static-gate complete.**
**Full dependency-backed integration gate remains pending in an environment that can restore the workspace dependencies.**

Do not begin R1-C by silently editing this patch. Apply / validate this micro-patch as one unit first.

## 5. Next official patch after integration validation

`R1-C · Unified Composer 真统一`

Carry-forward requirements already frozen for R1-C:

- current Surface + Selection + Receiver + Reference Set + Prompt share one execution language
- Conversation / Assembly / Canvas / Composer share the same Reference Set truth
- Reference Pick is not Relation and is not durable Glyth mapping
- Assembly latest synchronized-workspace planning must be consumed, not replaced by a second attachment system

No R1-C implementation is included here.

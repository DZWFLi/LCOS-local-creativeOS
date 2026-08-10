# Phase E Handoff

## Completed

- **schema v22**：relations 增加 origin / created_by / evidence_json / confidence（nullable，legacy 不重写）
- **reviseManagedTextArtifact**（E3/E4/E5）：immutable `.creative-os/notes/<artifactId>/<revisionId>.md`；旧 `notes/text-<uuid>.md` 首次更新时复制迁移 + 旧 FileRecord 重指向；`currentRevisionId` 直接切换（Curation edit ≠ Managed Run draft）
- **CurationCommandService**（E1）：createText / updateText / applyPatch；project/scope 校验、clientRef 映射、逐步 receipt、operationId 重放（内存 receipt）、presentation CAS 冲突显式失败
- **CurationPatchV0 契约**（E12）+ `POST /projects/:id/curation/apply`、`POST|PUT /projects/:id/curation/text`
- **CLI**：`node create-text` / `node update-text` / `curation apply --json` / `presentation patch --json`（自动读当前 version，支持 --expected-version）；commands/curation-command.mjs + presentation.mjs
- **GUI 刷新**（E15）：graph mutation 走现有 graph refresh；presentation 走 Phase B SSE——无新通道

## Files changed

```text
packages/contracts/src/curation-patch.ts / index.ts
packages/domain/src/index.ts（Relation provenance 可选字段）
apps/local-core/src/metadata-repository.ts（v22 + relation mapper + commitManagedTextRevision）
apps/local-core/src/text-artifact-service.ts（revise + legacy 迁移）
apps/local-core/src/curation-command-service.ts
apps/local-core/src/routes/curation.ts / compose.ts / server.ts
apps/local-core/tests/curation-command.test.ts（5 用例）
tools/lcos-agent/cli.mjs / commands/curation-command.mjs / commands/presentation.mjs
```

## Contracts frozen

```text
CurationPatchV0 / CurationPatchReceiptV0 / CurationPatchStepReceiptV0
Relation.origin / createdBy / evidenceRefs / confidence
managed text revision 语义：Curation edit → 新 Current（无 Draft Review）；Managed Run → Draft → Accept
```

## Migrations

```text
v21 → v22：relations 4 个 nullable 列 + user_version=22；legacy 行不重写
```

## Tests run

```text
npm run lint / typecheck                    : PASS
npm run test                                : web 274/274 · core 277/277 · domain 5/5 · contracts 4/4
npm run test:architecture                   : 86/86
npm run build                               : PASS
CLI real-process smoke                      : create-text / update-text（含 legacy 迁移）/ curation apply 全过
Playwright E2E                              : 3/3（CLI 节点 GUI 可见 / 大纲成员 / reload 保留）
```

## Acceptance evidence

```text
node create-text → artifact/revision/view/fileRecord 四 ID 返回
node update-text → 新 revision + legacyMigrated:true（notes/text-uuid.md → artifact 目录）
curation apply → 3 步 receipt（createText → relation(来源于, agent, 0.9) → presentation）
  applied:true；GUI 画布出现新节点；大纲 10 objects 含 patch 成员；reload 后 members=4
```

## Known compatibility paths still present

```text
旧 notes/text-<uuid>.md 首次编辑才迁移（按对象，不 eager）
Managed Run draft/review 路径不变（runtime services）
```

## Explicitly NOT implemented

```text
Curator Skill / vector / 飞书 / Bridge 改动
FS+SQLite 全局 ACID（V0 语义：预校验 + 顺序执行 + receipt + 失败停止）
```

## Risks for next phase

```text
receipt 为内存级（重启丢失）；operationId 重放靠同一进程。Phase F Skill 重试语义依赖它。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commit  : b35e444
HEAD    : b35e444
```

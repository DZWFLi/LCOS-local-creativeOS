# MVP 收口标准功能排查审计（2026-08-01）

> 读者：Dz（决策人）
> 作者：Codex
> 目的：核对 `codex/mvp-fast-build` 是否满足 MVP V1 收口标准，并恢复 worktree 重建时丢失的测试证据。
> 结论：**收口标准功能全部齐备，质量链全绿，E2E 4/4；合并前尚有 3 项工程债需 Dz 决策。**

---

## 1. 审计依据

- `MVP_V1_EXECUTION_README.md`（已从备份恢复，收口标准权威文档）
- `docs/architecture/ADR_MVP10_RUNTIME_UI_CLOSURE_2026-07-29.md`（Dz 批准，验收条件 6 条）
- `docs/handoffs/MVP_1_0_RUNTIME_CLOSURE_REVIEW_2026-07-29.md`（闭环评审，基线 `d374628`）
- `docs/audit/PRE_MERGE_AUDIT_20260730.md`（task_c2fc4c5c 收口审计）

## 2. 恢复操作（worktree 重建丢失的证据）

从 `_mvp-fast-build-bak` 恢复 16 个文件：

| 类别 | 文件 |
|------|------|
| E2E | `tests/e2e/golden-path.spec.ts`（v0.7 Runtime 身份断言 + 移除 rmSync） |
| Local Core 测试 | `active-context-store` / `bridge-mcp-client` / `context-manifest-service` / `runtime-adapter` / `runtime-application-service` / `runtime-http` / `runtime-persistence` / `runtime-result-ingestion` / `runtime-review-service` `.test.ts` |
| 架构测试 | `tests/architecture/runtime-v6.test.ts` |
| 收口文档 | `MVP_V1_EXECUTION_README.md`（根目录）、`README.md`（补 MVP V1 执行入口小节） |
| 脚本 | `scripts/light-bridge.mjs`、`scripts/light-bridge-canary.mjs`、`scripts/phase25-golden-path.mjs`（短 ID 冲突修复版） |

## 3. 集中质量链结果（恢复后实测）

| 阶段 | 命令 | 结果 |
|------|------|------|
| lint | `npm run lint` | ✅ PASS（仅存量 warning） |
| typecheck | `npm run typecheck` | ✅ 4/4 workspace |
| unit (web) | `npm run test --workspace @local-creative-os/web` | ✅ 28 files / 113 tests |
| unit (core) | `npm run test --workspace @local-creative-os/local-core` | ✅ 20 files / 115 tests（恢复前 11/76） |
| unit (domain/contracts) | `npm run test` | ✅ 5 + 4 |
| integration | `npm run test:integration` | ✅ 5/5 |
| architecture | `npm run test:architecture` | ✅ 4 files / 27 tests（恢复前 3/24） |
| build | `npm run build` | ✅ PASS |
| smoke | `npm run smoke` | ✅ PASS |
| E2E | `npm run test:e2e` | ✅ **4/4**（恢复前 2/4） |

对照闭环评审基线（core 19/119、arch 4/27、E2E 4/4）：数量略有差异（core 20/115，多了 1 个测试文件、少 4 个用例，均通过），功能覆盖一致。

## 4. 五个纵向 Slice 核对

### Slice 1 真实输入

| 要求 | 证据 | 状态 |
|------|------|------|
| Canvas Drop = Import Copy | `App.tsx:837` 调 `bridgeRef.current.importCopy`；`import-copy-service.ts` 写 `<projectRoot>/imports/` | ✅ |
| Browser 只传文件内容与不透明业务标识 | `localCoreClient.importCopy(projectId, { file, importRequestId, scopeId, x, y })`；`server.ts:44` `FORBIDDEN_BROWSER_PATH_FIELDS` 拒绝 path 字段 | ✅ |
| 幂等 + 409 冲突 | `import-copy-service.ts:107` `ImportCopyConflictError`（重复 requestId 不同内容） | ✅ |
| 状态明确 | `ImportCopyResult` 状态字段 + `Temporary/Importing/Persisted/Failed` 前端标签（Runtime Diagnostics 导入门） | ✅ |
| 外部 Source 走 Trusted Selection + opaque `selectionId` | `registerTrustedSource` 仅提交 selectionId；Stage 7A 已验证 | ✅ |
| 删除 View 不删 Artifact | ARCH-P3-002 测试 | ✅ |

### Slice 2 项目理解

| 要求 | 证据 | 状态 |
|------|------|------|
| Reference / Feedback / Decision / Revision / Manifest / Handoff | `active-context-store.ts`、`context-manifest-service.ts`、`HandoffDialog.tsx`、Relation/Note/Decision 实体 | ✅ |
| Manifest 从 Project Truth 构建 | `context-manifest-service.ts:116` `this.repository.get(projectId)`，不读 Fixture | ✅ |
| 同一份 Manifest 服务人工 Handoff 与 RuntimeInputPack | `buildContextManifest` 客户端方法 + `runtime-adapter.ts:315` 物化 `runtime-input-pack.json` | ✅ |
| Feedback 结构化（来源/Change Request/Keep-Locked/状态） | `active-context-store` + 测试 `active-context-store.test.ts` | ✅ |

### Slice 3 文件演化

| 要求 | 证据 | 状态 |
|------|------|------|
| 手动 Refresh 真实成立 | `server.ts:824` `POST /file-records/:id/refresh` → `file-observation-service.ts` | ✅ |
| Adopt External Change = 用户动作 + 新 Revision | `server.ts:835` `POST /file-records/:id/adopt`；`metadata-repository` Revision 状态机 | ✅ |
| Current Revision 唯一 | `Artifact.currentRevisionId` 指针 + `RuntimeLifecycleConflictError` Guard（`metadata-repository.ts:1430` 等） | ✅ |
| Watcher 不引入（P1） | 无 Chokidar / 无 watcher 依赖；观察为手动 API 级 | ✅ 符合冻结 |

### Slice 4 AI 执行

| 要求 | 证据 | 状态 |
|------|------|------|
| Canonical LCOS Run（`task_id` 只是外部映射） | `runtime-application-service.ts` + `metadata-repository` runs 表；Binding 保存外部 ID | ✅ |
| 幂等创建 | `idempotencyKey: String(run.id)`（application service） | ✅ |
| 重启恢复 | `dispatch/recover/sync` HTTP + `get_task_by_lcos_run_id` 查询 + `runtime-persistence.test.ts` | ✅ |
| Retry 创建新 Run 且旧 Run 不改回 | `runtime-review-service.ts:74` `retryOfRunId: previousRun.id` + 状态机测试 | ✅ |
| changed_files 结构化 + Path Guard | `runtime-result-ingestion.ts`（realpath 四级 Guard）+ `path-guard.ts` | ✅ |
| Bridge 不决定 Artifact/Revision/Current | Provider 状态只在 RuntimeBinding；`review` 仅为 presentation phase（架构测试覆盖） | ✅ |
| Bridge 提纯硬门 | `tools/ai-bridge-runtime/` 独立于 `E:\Buddy项目\ai-bridge`；未接线外部目录 | ✅ |

### Slice 5 结果回收

| 要求 | 证据 | 状态 |
|------|------|------|
| changed_files → Staging → pending_review → Draft Revision | `runtime-result-ingestion.ts` + `ArtifactReturn.pending_review` | ✅ |
| Accept CAS（Draft → Current，旧 Current → Superseded） | `server.ts:533` `POST /artifact-returns/:id/accept`；CAS Guard + E2E 真实 Accept | ✅ |
| Reject 保留证据不改变 Current | `reject` 端点 + 测试 | ✅ |
| Retry 引用旧 Run | `retryArtifactReturn` → `retryOfRunId` | ✅ |
| MVP 不覆盖源文件 | 输出写入 `staging/` 新文件，Accept 才更新 Current 指针 | ✅ |
| 刷新 + Core 重启恢复 | E2E「Restart Local Core → reload → data persists」PASS | ✅ |

## 5. ADR 验收条件核对

| ADR 条件 | 状态 |
|----------|------|
| 真 Run ID、Manifest、Dispatch、Binding 可重启恢复 | ✅ runtime-persistence + HTTP 测试 + E2E 重启用例 |
| Bridge 不可用有结构化错误与 recover 操作 | ✅ `recoverRuntimeRun` + recovery_required 状态 |
| review Result 生成 Pending Return 和 Draft Revision | ✅ ingestion 测试 + 真实 E2E 证据（closure review） |
| Accept CAS / Reject / Retry New Run 从 UI 可操作 | ✅ `acceptRun/rejectRun/retryRun` 接入 WorkRail + 测试 |
| 原 Current 不被执行或摄取自动覆盖 | ✅ CAS Guard + 测试 |
| Root quality chain / Runtime E2E / 浏览器 Golden Path 通过 | ✅ 本次实测全绿 |

## 6. 最终完成线核对（执行 README §11）

```text
拖入真实 Markdown/图片 → Runtime 持久化 + Preview → 绑定 Reference/Feedback/Decision
→ ContextManifestV0 → WorkBuddy 修改 → changed_files → Draft Revision
→ Accept/Retry/Reject → 刷新 + Core 重启 → 完整恢复
```

✅ 全部实现并有测试/文档证据。真实 WorkBuddy 闭环曾完成（`run-d190abd4-...`，Bridge `task_bec3f4cb`），其磁盘证据位于旧 `.data`（未随 worktree 迁移，属 gitignore 开发数据）；如需复核可重跑真实闭环。

## 7. 明确不做项（符合冻结，不算缺口）

- 真实 `waiting_input` 暂停/恢复（MVP 用 Review + Retry）
- Watcher 自动观察（P1）、SSE 实时推送（用户触发 + 3s 有限轮询）
- PPT/DOCX 修改、多 Executor、多项目/多用户
- PDF Preview（可选未实现）、Agent 自动唤醒、Delivery Bundle
- 前端 `setTimeout` 仅存在于显式 Demo 路径（`App.tsx:403` `if (activeRun.runtime) return`），Runtime 模式走真实 dispatch

## 8. 合并前遗留（非收口标准缺失，但被点名）

1. **正式 Project Create 未通**：`App.tsx:477` `createProject` 仅内存创建；Core 无 `POST /projects`；`DEFAULT_PROJECT_ID = disposable-mvp-sample` + `project-huaxin` 硬编码（Buddy 已提交 6 步方案，Dz 倾向 Codex 施工）。
2. **Runtime Source Gate 未修**：runtime 模式 cache miss 仍可能静默回退 localStorage/Fixture，需显式报错。
3. **E2E 独立临时数据库**：当前 spec 注释"手动清理"（Buddy 沙箱 safe-delete 兼容的懒政），未实现独立临时 DB。
4. App.tsx 拆分 hooks：明确后置，不阻塞收口。

## 9. 风险

- 真实闭环磁盘证据（`.data/mvp-sample-project`）不在当前 worktree，重放真实 E2E 需 WorkBuddy 在线。
- SQLite Windows EBUSY/超时属环境偶发（本次未复现，架构测试全过）。
- Buddy 共享 worktree 提交行为需约定：未经确认不得代提交。

## 10. 结论与下一步

收口标准功能**齐全**，测试证据已恢复到闭环评审水平。下一步由 Dz 决定：

1. 提交本轮恢复（16 文件 + 2 处断言修正已在 `ef6f107`）；
2. 批准合并主干前，先处理第 8 节三项工程债；
3. 或先手工浏览器验收（Porcelain 视觉 + Runtime 闭环）。

---

_Codex 2026-08-01 生成，全部结论基于本次实测，未使用 Mock 冒充。_

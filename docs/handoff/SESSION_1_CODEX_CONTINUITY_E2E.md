# Session 1 Handoff｜Codex Continuity 真 Harness 主链

## Goal

把 B6 Continuity（Resolve / Bind / Attach / Return）从「只有 CLI 消费的合同」变成真实 Codex 执行链的一部分：不新建 Harness Framework、不复制 ContextManifest、不为 Codex 建第二套 session truth。

## Baseline

- branch: `codex/r1-vision-merge-20260812`
- HEAD（实施前）: `0b5b24d`
- dirty files before: 无（四个前置已收口）
- dirty files after: 本 Session 的代码 + 测试 + 本文档

## Authoritative path after this session

```text
Web startRunFrom（带 continuitySessionId，localStorage 每项目稳定）
→ POST /projects/:id/runs { sessionId }
→ Core create()：首次绑定 session + attachBundle(provider=codex)
→ Attach Bundle 的 contextPack 合并进冻结 ContextManifest orderedItems（identity: continuity:*）
→ dispatch → Light Bridge task（envelope 不变）
→ watchdog → codex exec（executor 会话按 lcos-executor-run 认领）
→ get_lcos_run_context 返回含 continuity 项的 Manifest → 真实执行
→ submit_lcos_result → sync/ingest → Run completed
→ Core 在 completed 转场点（以及 accept 路由）自动 intakeReturn
→ SessionSummary + Handoff + SessionContext 原子创建（幂等，同 Run 只一次）
```

retry / failed / 未 completed / 无 sessionId 的 Run 不产生 Handoff。

## Files changed

- `packages/contracts/src/index.ts`：`BuildContextManifestV0Input.extraItems`
- `apps/local-core/src/context-manifest-service.ts`：append extraItems
- `apps/local-core/src/runtime-application-service.ts`：`CreateRuntimeRunInput.sessionId`、`attachContinuity()`、bind+attach→manifest、run.queued 记 sessionId、`intakeContinuityReturn()`（幂等）、completed 转场自动 intake
- `apps/local-core/src/compose.ts`：continuity → runtimeApplication 注入
- `apps/local-core/src/routes/runs.ts`：create 入参白名单 + sessionId
- `apps/local-core/src/routes/runtime-reviews.ts` / `server.ts`：accept 后 authoritative intake
- `apps/web/src/runtime/localCoreClient.ts` / `App.tsx`：continuitySessionId（localStorage）+ createRuntimeRun/continuityResume 传递
- `apps/local-core/tests/continuity-run-linkage.test.ts`：新增 3 用例

## Tests actually run

| command | result |
|---|---|
| `npm run typecheck`（4 包） | PASS |
| `vitest continuity-run-linkage.test.ts` | 3/3 PASS |
| `npm run test --workspace local-core` | 87 文件 / 426 用例 PASS |
| `npm run test --workspace web` | 99 文件 / 455 用例 PASS |

## Manual smoke actually run（真实 Codex Run E2E）

栈：Local Core 43121（新 DB + MVP sample）+ Light Bridge 43122 + watchdog（once）+ 真实 `codex.exe`（executor MCP `lcos-executor`）。

Run #1 `run-4825533a-150d-49ad-ae27-e888c2ce0763`：
- bind 后 attach 得到的 Manifest `context-manifest-aa7c61...` orderedItems 含 4 条 `continuity:*`（Script / Brief / Feedback Notes / Reference Image）
- 执行器会话认领（claim_lcos_run）→ get_lcos_run_context 读到上述冻结上下文 → 提交 review 结果，runner exit 0

Run #2 `run-2dc6b185-866c-431b-abc4-ef4da9f2ecf7`（同 LCOS session，Codex 侧 resume 同一会话 `01a0090a-d4a1-75d0-badb-44ba846b5f69`）：
- 模型回包明确列出 continuity 来源四项材料标题 → Attach Bundle 确实进入 Codex 输入
- completed 后自动生成：
  - `session-summary-e8a1c736-...`（runIds=[run#2]）
  - `handoff-47e0d4c8-...`（fromProvider=codex，sessionSummaryId 互指）

Resolve / Resume：
- `POST /runtime/continuity/resolve` → `projectId=disposable-mvp-sample, reason=session_bound, confidence=1`
- `POST /projects/:id/continuity/resume?sessionId=session-s1-e2e` → `requestedSession=session-s1-e2e`，reload 后仍可找到

## Acceptance checklist

- [x] explicit project resolve / session affinity resolve（resolve 路由 + 真实调用 reason=session_bound）
- [x] bind 后 attach 得到同一 project/session（Manifest 含 continuity 项）
- [x] Codex 确实收到 Attach Bundle 上下文（执行器 get_lcos_run_context + 回包列名）
- [x] 执行后 Return Intake 成功（completed 转场自动 intake）
- [x] Session Summary / Handoff 真实创建（HTTP 可见，runIds / handoffRef 互指）
- [x] retry / failed 不产生伪成功 handoff（单元测试：未 completed / 无 session → 0 summary；幂等重复调用仍 1 条）
- [x] reload 后 continuity resume 找到正确 session
- [x] 未新建 Harness Framework / 第二套 ContextManifest / 第二套 session truth

## Remaining debt discovered in this Session

1. analyze + reply_only 无 ArtifactReturn 属既有合同（无产物可 Accept）；intake 因此同时挂在 completed 转场与 accept 两处。create/revise 的 Return→Accept→intake 由 `runtime-application-service` / accept 路由 + 既有 accept 测试覆盖，未在本轮做第二次真实 revise Run。
2. `run.sessionId` 用 `run.queued` 事件 payload 承载（避免 run 表 schema 变更）；若后续 S2/S3 需要结构化查询，再评估正式字段。
3. `lcos-executor` MCP 在用户 config 默认 `enabled=false`，依赖 runner 每次 `-c enabled=true` 覆盖；长期可考虑单独 executor profile。

## Explicitly not done

- 未做 Web 浏览器点击式 E2E；
- 未做 revise/create 的第二次真实 Codex Run；
- 未进 Session 2。

## Risk / rollback point

- 回滚点：`0b5b24d`。所有改动为增量（extraItems 可选、sessionId 可选、intake 幂等），不破坏既有无 session 的 Run 链。

## Verdict

**PASS**

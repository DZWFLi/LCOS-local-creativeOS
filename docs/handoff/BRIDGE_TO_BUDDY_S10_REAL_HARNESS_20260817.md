# Bridge 交接 · S10 真实 Codex Harness（Buddy 接手）

> 日期：2026-08-17 · 交接人：Codex（T）→ Buddy
> 任务：CODEX_MINIMAL_SUPPLEMENT_REQUEST_S10 —— 真实 Codex Harness Golden Project 证据链。
> 用户明确要求：**省 token、只交接，不继续烧**。

## 1. 当前环境（栈正在运行，勿重启 Core）

| 服务 | 端口/位置 | 说明 |
| --- | --- | --- |
| Local Core | 127.0.0.1:43121 | **DB = `.codex-runtime/golden.sqlite`**（全新，仅含 `disposable-mvp-sample`；GUI 建 Context 的缺陷就在这个库上复现） |
| Light Bridge | 127.0.0.1:43122 | runtime root = `.codex-runtime/bridge` |
| Vite | 127.0.0.1:5173 | cwd=`apps/web`，token 注入 |
| Watchdog | `npm run watchdog`（后台会话） | 真实 codex executor，绑定 `CODEX_BIN = %LOCALAPPDATA%\OpenAI\Codex\bin\e305f1c75d8da435\codex.exe` |

- Token：`.codex-runtime/local-core-token`（当前值可用；Core 已按它启动）。
- 日志：`.codex-runtime/devlogs/{core,bridge,web,watchdog}.{out,err}.log`。
- 重启 Core 的命令（如真需要）：`node apps/local-core/dist/index.js`，env `LOCAL_CORE_API_TOKEN=<token>`、`LOCAL_CORE_DB_PATH=<abs>\golden.sqlite`。

## 2. 已完成的真实证据（不是 mock）

### Run #1（真实 codex 执行完成）

- Run：`run-44df7bc9-dfc2-4b8e-8a75-760221ff6b9d`（provider=codex，outputIntent=analyze）
- Session：`s10-golden`（provider-session 绑定，origin=manual）
- 执行器线程：`01a00f22-2608-7dc0-afa7-4d995cd2f510`
- 逐字记录：`C:\Users\1\.codex\sessions\2026\08\17\rollout-2026-08-17T17-51-31-01a00f22-2608-7dc0-afa7-4d995cd2f510.jsonl`（709KB）
- 状态：`completed` / providerStatus=`review`；已读完整 Context Manifest（brief/feedback/reference/notes/checkpoint），产出结构化建议（沉淀 Brief+Script、建 Fixture/Demo 边界 Note、排除 Midea 会话与 hotfix 索引）。
- 执行器实际经历：首次 `claim_lcos_run` 报 `TASK_DIRECTED_ELSEWHERE`（"Task is directed to another session"）→ 自行读源码 → 改用 `workerId=s10-golden` 认领成功 → start → heartbeat → 提交 review。

### GUI 可见性

- LCOS Web GUI（`/?project=disposable-mvp-sample`）能看到 Run 节点（`Run · run 44df7bc9…`）；截图 `.codex-runtime/devlogs/s10-gui-run.png`。

## 3. 已实锤的缺陷（给 GPT/Buddy 修，勿改产品语义）

1. **executor MCP 无 propose 工具**：`tools/lcos-agent/executor-tools.mjs` 只有 8 个执行工具，没有 `propose_lcos_context_change` → `lcos context proposals` 为空。PASS5「S5 代码闭合」不成立。黄金链第 5 步不可达。
2. **claim workerId 契约不一致**：executor skill 要求 workerId=本会话线程 id，但 bridge `store.py:_dispatch_target` 校验 workerId==dispatch target（=provider session）。当前靠执行器自己悟出传 `s10-golden`。修法候选：claim 时用 Core 返回的 provider session 作 workerId，或 skill 明确 workerId=provider-session。
3. **GUI「从选择沉淀上下文」仍坏**（S2 遗债未真修）：主画布选节点→右键→「从选择沉淀上下文」点击后**无任何 Core 写请求**、无 toast、Context Graph 0 个。现象：画布节点 `data-view-of=null`，`semanticRefsForSourceIds` 拿不到 presentation 节点 → `createContextFromMembersDirect` 静默早退。PASS5 的 `context-create-from-selection.spec.ts` 在真实浏览器里不通过（其 BUILD_INFO 自称"待完整环境跑"）。
4. **deterministic gate 残留 1 个测试失败**：`guiR3DirectManipulation.test.ts > restores Right-button drag...` 断言 `const guard = (menuEvent: Event) =>`，PASS5 实现是内联 `contextMenuGuard.current = (menuEvent: Event) => ...`。二选一。

## 4. 已做的本地适配（可复核）

- `scripts/productization-s10-release-gate.mjs`：Windows 下 `spawnSync('npm.cmd')` EINVAL → 改为 `node + npm_execpath`。
- `apps/web/tests/productizationS4S8Contract.test.ts`：webRoot 去掉重复 `apps/web`。
- 7 个旧契约测试断言对齐 PASS5（guiR31aCloseout / crossSurfaceDrop / newSceneSemanticDrop / guiR31aProjectNodeFoundation / guiR3DirectManipulation / dialogDismissal / gui5Reorganize）。

## 5. Deterministic Gate 现状

```text
lint        PASS
typecheck   PASS
unit        FAIL（残留 1 条，见 §3.4）
architecture / integration / build:local-core / build / e2e / golden   未跑（gate 停在 unit）
```

## 6. Buddy 下一步（按序）

1. 修残留断言（§3.4，选一边即可）→ `npm run check:0.1:deterministic` 全 PASS（E2E 与 golden 会首次真正执行，注意 E2E 需要独占 43121：先停手测栈）。
2. Run #2（真实 create/revise → ArtifactReturn）：
   ```bash
   node tools/lcos-agent/cli.mjs run create disposable-mvp-sample --instruction "按 Brief 起草一版手稿（只写 staging，不覆盖源文件）" --provider codex --output revise --target artifact-brief
   node tools/lcos-agent/cli.mjs run list disposable-mvp-sample
   ```
   watchdog 会自动拉起真实 codex；完成后 `run accept <artifact-return-id> --base-revision <id>`。
3. 补 propose 缺口（§3.1）后重跑 Run #1 类任务产出 Context Proposal，GUI/CLI accept。
4. Feedback → Revision：WorkRail「基于反馈生成下一版」或 Core revision-workflows 路由（按可用路径选）。
5. 回填 `docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE.md`（真实 ID 已预填一部分），跑 `npm run check:0.1:release`。
6. 修 GUI「从选择沉淀上下文」（§3.3）并补 reload 持久化验证。

## 7. 已预填的 Evidence（其余留空等 Buddy）

```text
REAL_HARNESS_VERDICT: NOT_RUN（等 Run #2/Proposal/ArtifactReturn 补齐后改 PASS）
PROVIDER: codex
REAL_PROVIDER_PROCESS: true
SCRIPTED_OR_MOCK_WORKER: false
HEAD: 950acba
PROJECT_ID: disposable-mvp-sample
SESSION_ID: s10-golden
RUN_1_ID: run-44df7bc9-dfc2-4b8e-8a75-760221ff6b9d
RUN_2_ID: （待 Run #2）
CONTEXT_PROPOSAL_ID: （待 §6.3 修复后产出）
ARTIFACT_RETURN_ID: （待 Run #2）
FEEDBACK_ARTIFACT_ID: （待 §6.4）
SESSION_SUMMARY_ID: （completed 转场自动生成，查询：GET /projects/disposable-mvp-sample/conversations + runs）
HANDOFF_ID: （同上）
CONTINUITY_RESUME: （待验：reload GUI / resume 端点）
GOLDEN_USER_STORY: （待全链）
```

## 8. 相关文件

- 请求：`CODEX_MINIMAL_SUPPLEMENT_REQUEST_S10_20260817.md`（桌面 8.17）
- Gate 证据：`docs/handoff/S10_GATE_EVIDENCE_20260817.md`
- 审计：`docs/audit/PRODUCTIZATION_S4_S10_AUDIT_20260817.md`
- 工作树：`.worktrees/mvp-fast-build`，分支 `codex/r1-vision-merge-20260812`，HEAD `950acba` + 全部未提交改动（PASS5 已并入）

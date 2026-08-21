# Codex → GPT 交接文档（LCOS Codex Native Loop 收口现状）

> 日期：2026-08-04 ｜ 分支：`codex/backend-hardening-20260802` ｜ HEAD：`49d7f14`
> 交接人：Codex ｜ 接手人：GPT（按本文件 + 下方文档索引继续）
> 栈状态：当前 dev:open 正在运行（Web 5173 / Core 43121 / Bridge 43122）

## 1. 一句话现状

“Codex 派单接单闭环 + 内置浏览器实时上下文”双目标的**后端与浏览器侧均已实现并验证**；
真实 Codex CLI 会话接单 E2E 与用户反馈的“单点节点不行”仍待确认（详见 §6）。

## 2. 本轮提交（按 Slice）

| Commit | 内容 |
|---|---|
| `504f0cd` | 合并前开发规划入库（docs/product/LCOS_CODEX_NATIVE_LOOP_PREMERGE_DEVELOPMENT_PLAN_20260804.md） |
| `2b8052d` | C0：ActiveContextV2 合同冻结（version 单调、expectedVersion 409、afterVersion 短轮询、updatedBy、contextItems） |
| `c76f6fe` | C1+C2：MCP 读链（bind/watch/get_run_context/list_pending）+ Bridge claim_task_by_id/heartbeat + run 级 claim/start/heartbeat/fail |
| `bf4a66a` | C4：Codex 上下文提案（create/accept/reject/stale，进程内存储） |
| `85b359a` | C5：Golden Path 增加 Codex provider 分支（claim-by-id 真实链路） |
| `1a86741` | C6：最终 Handoff + 合并清单（含水分自纠） |
| `8723651` `092b828` `9219850` | 看门狗：派单模式、GUI 冲突护栏、Core 决策（existing/spawn/wait） |
| `f94376c` `c1984c5` | 看门狗：空闲 GUI 可接活（busy 判断）、已认领不重复派 |
| `d9ddc6d` | Bridge 定向派单（dispatch_target 存 bridge_meta，排队认领不抢定向任务，**没有禁用 codex 排队认领**） |
| `ed2e1f2` | 实测 codex-cli 0.146：无 `--skill`、续会话用 `codex exec resume <id> "msg"`；合并门降级诚实化 |
| `24932a6` `3fc5ec8` | C3 浏览器 Agent Surface：`?agent=codex` 模式、同步徽章、提案接受/拒绝卡片、待办提示、Run 快照锁定；浏览器探针通过 |
| `fbe2ad1` | 派单计划读 Bridge 任务状态（leaseExpiresAt，租约过期重新可派） |
| `49d7f14` | 看门狗零注册模式：`codex exec -C <项目目录> resume --last "提示"` 自动续最近会话，无会话才拉起新的 |
| `3200bda` | docs/product 三个源文件入库 |

更早的收口（同分支历史）：文本 Artifact、UI v5 接入、lcosproj P1-P4、Watcher、Revision/投影/现场/会话后端、Membership/Proposal 等——详见
`docs/handoffs/PHASE0_1_*`、`PHASE1_4_*`、`SLICE_*`、`DZ_REQUIREMENTS_FIX_MATRIX_20260803.md`。

## 3. 派单/接单架构（现状）

```
LCOS GUI 发 Run
  → Core 创建 Canonical Run → Bridge 创建 Codex Task（provider=codex）
  → 看门狗（watch.ps1）每 60s 问 Core：POST /runtime/codex-dispatch-plan
      Core 读 Bridge 任务状态（assigned/claimed/lease 过期等）出结论：
        dispatch_existing（有注册会话）→ 看门狗 direct + codex exec resume <id>
        未注册会话 → 看门狗 codex exec -C <root> resume --last（自动续最近会话）
        无历史会话 → codex exec -C <root> "提示"（拉起新会话）
        wait（会话在思考/任务已认领/终态）
  → 会话收到「LCOS 接单提示」→ 按 skill 认领（claim_lcos_run → claim_task_by_id）→ 执行 → 提交
  → Core sync/ingest → ArtifactReturn → GUI Review
```

关键点：
- Bridge 是唯一任务状态机；Core 只判断；看门狗只投递（从不 claim）。
- Codex 任务支持排队认领与定向认领并存；定向任务其他会话抢不走（bridge_meta 存 dispatch_target）。
- 认领租约过期 → Core 会重新派单（防卡死）。
- 会话“忙闲”判断：看门狗读 `~/.codex/sessions/<id>*` 文件最近写入时间（10s 阈值）；注册模式才启用。

## 4. C3 浏览器 Agent Surface（已真做）

- 入口：`http://127.0.0.1:5173/?agent=codex&project=<id>`
- 功能：同步徽章（同步中/已同步 vN/冲突+刷新）、Target/Context chips、Codex 提案接受/拒绝卡片、待办提示、Run 快照锁定横幅
- 后端配套：ActiveContextV2、`GET active-context?afterVersion=` 短轮询、提案 API、`GET context-manifests/v0/:id`
- 验证：`tests/e2e/agent-surface-probe.mjs` 真实浏览器通过（提案→卡片→接受→版本 2→4）

## 5. 诚实遗留（接手者必须知道）

1. **合并门“Codex 唯一验收 Executor”已降级 🟡**：Golden Path 是脚本模拟（codex provider + claim-by-id），不是真实 Codex CLI 会话；真实会话 E2E 未完成（需用户配合开一个 CLI 会话）。
2. **上下文提案为进程内存储**：重启即丢（用户已确认低优先级；若要做需 v14 表迁移，属红区）。
3. **看门狗忙闲判断**基于会话文件写入模式，未经真实会话验证；零注册模式无忙闲保护。
4. **waiting_input** 未做（Bridge 协议无此状态）。
5. **WorkBuddy** 退出关键路径，Provider 状态保持 manual。

## 6. 待排查：用户反馈“单点节点不行”（重要）

- 现象：用户截图（codex-clipboard-ecffecfc-…png，内容未知）说“单点一个节点怎么还不行”。
- 已做排查：`tests/e2e/single-click-probe.mjs` 在 headless Chromium 分别以 1440×860 与 1366×768、
  普通视图与 `?agent=codex` 视图复测：**单击均正常**（节点 .selected、SelectionComposer 出现、
  ActiveContext version 递增、无 console/page error、无遮挡，双击打开 Workbench 正常）。
- 结论：代码路径在自动化环境无复现。接手第一步 = 请用户补充具体现象：
  是没高亮？没 Composer？有报错？在哪个页面（普通/agent）？哪个节点类型（文件/文本/过程节点）？
  并让用户浏览器 F12 Console 截图。可能方向：真实窗口与无头的差异（HMR 陈旧）、
  用户点击的是过程/投影节点、或面板遮挡、或用户期望的交互与实现不同。

## 7. 如何运行/测试

```powershell
cd "E:\Codex 项目\OS开发\.worktrees\mvp-fast-build"
npm run dev:open        # 起 Web/Core/Bridge + 浏览器
npm run dev:status      # 看状态
npm run dev:stop        # 全停

# 看门狗（零注册模式）：
pwsh -NoProfile -File tools\codex-orchestrator\watch.ps1

# 质量链：
npm run typecheck
npx vitest run apps/local-core/tests apps/web/tests tests/architecture tests/integration
# kernel（Python venv）：
$env:PYTHONPATH="tools\light-bridge-kernel\src"
tools\light-bridge-kernel\.codex-runtime\bridge-test-venv\Scripts\python.exe -m pytest tools\light-bridge-kernel\tests -q
```

浏览器探针：
```powershell
node tests/e2e/agent-surface-probe.mjs    # C3 提案接受闭环
node tests/e2e/single-click-probe.mjs     # 单击/双击诊断
```

## 8. 关键文件

- 规划：`docs/product/LCOS_CODEX_NATIVE_LOOP_PREMERGE_DEVELOPMENT_PLAN_20260804.md`
- 最终 Handoff（含合并清单）：`docs/handoffs/LCOS_CODEX_NATIVE_LOOP_FINAL_HANDOFF_20260804.md`
- 看门狗：`tools/codex-orchestrator/`（watch.ps1、sessions.example.json、README）
- Core 派单：`apps/local-core/src/codex-dispatch-service.ts`、`runtime-adapter.ts`（getCodexTaskState）
- 上下文提案：`apps/local-core/src/context-proposal-store.ts`
- Bridge：`tools/light-bridge-kernel/src/lcos_bridge/core/store.py`（claim_task_by_id/direct_task）、`transport/http_api.py`
- MCP/CLI：`tools/lcos-agent/mcp-server.mjs`、`cli.mjs`
- Skill：`packages/skills/lcos-project-context/SKILL.md`
- C3 前端：`apps/web/src/App.tsx`（AgentContextSurface 局部组件）
- E2E 探针：`tests/e2e/agent-surface-probe.mjs`、`single-click-probe.mjs`

## 9. 给 GPT 的接手清单（按优先级）

1. **先定位“单点节点不行”**：让用户给具体现象 + F12 Console；必要时用真实窗口（非 headless）复现。
2. **真实 Codex CLI 会话 E2E**：请用户开一个项目目录 CLI 会话 → 起看门狗 → GUI 发 Run →
   确认会话收到提示并完成认领/执行/提交；有阻塞就修。
3. 视情况把 C6 合并清单的 🟡 项做实（真实会话 E2E 通过后改 ✅）。
4. 可选增强：v14 提案持久化（红区，需用户批准）。
5. 合并主线前：`git diff --check`、全量测试、确认工作树干净（当前已干净，除 §6 待办）。

## 10. 已知坑（避免重复踩）

- Launcher 拒绝脏工作树启动（含未跟踪文件）；要起栈先提交或清理。
- codex-cli 0.146.0-alpha.9.2：**没有 `--skill`**；续会话=`codex exec resume <id> "msg"`；自动续最近=`codex exec -C <dir> resume --last`。
- Bridge REST：43122；Core：43121；token 在 `.codex-runtime/local-core-token`。
- 浏览器不能调 Bridge；认领动作由 Codex 会话通过 MCP/CLI 完成。
- Core 决策“无任务状态不盲派”（拿不到 Bridge 状态就跳过）。

---

_Codex 2026-08-04，结论基于 412 测试 + kernel pytest 全绿 + 真实浏览器探针。_

# Slice D Handoff：ActiveContext 写回验证 + CLI/MCP 对齐 + Skill 同步

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commits：`05ab9d9`（显式 Intent + CLI/MCP）、`ed31984`（Core token 供 CLI/MCP）、`b81b943`（analyze maxFiles 真实 E2E 修复）

## Decision

Slice D 完成可无红区施工的部分：

1. **ActiveContext 写回**：Web 早已在 runtime 模式 PUT selection（150ms debounce）——本次用真实浏览器验证「点选 → Core → CLI 立读」，补正向保护测试。
2. **Intent 必填**：删除 Core `outputIntent ?? 'revise'` 默认误判——服务端 400 校验、应用层显式必填；CLI/MCP 同步要求显式 `--output` / `outputIntent`。
3. **CLI**：`lcos doctor`、`lcos capabilities`、`project inspect`、`project current`、`run create --dry-run`、统一 JSON + 退出码。
4. **MCP**：补齐 `create_lcos_run` / `dispatch_lcos_run` / `recover_lcos_run` / `finalize_lcos_run` / `accept_lcos_return` / `reject_lcos_return` / `retry_lcos_return`，全部复用 Local Core 既有端点。
5. **Skill**：修正「MCP 只读」「revise 默认主意图」「changed_files 含 deleted」三处过时/夸大声明。
6. **真实 E2E 抓包**：真实 Bridge 拒绝 analyze `maxFiles:0`（内核约束 ≥1），修正为 `allowZeroFiles:true + maxFiles:5`；这是单元测试（Fake Bridge）漏掉、真实链路暴露的合同 bug。

## Exact files

- `apps/local-core/src/runtime-application-service.ts`：`CreateRuntimeRunInput.outputIntent` 必填；create 缺 Intent 抛错
- `apps/local-core/src/server.ts`：POST /runs 400 校验要求 outputIntent
- `apps/web/src/runtime/localCoreClient.ts`：`CreateRuntimeRunInput.outputIntent` 必填
- `apps/local-core/src/runtime-adapter.ts`：analyze `maxFiles: 5`（内核 ge=1）；类型 `1 | 5`
- `tools/lcos-agent/cli.mjs`：doctor / capabilities / project inspect / project current / run create --dry-run / 退出码
- `tools/lcos-agent/lib/client.mjs`：自动读取 `.codex-runtime/local-core-token`
- `tools/lcos-agent/mcp-server.mjs`：7 个 Run/Return 工具（现在共 25 个）
- `scripts/dev-launcher.mjs`：open 时落盘 Core token，stop 时删除
- `packages/skills/lcos-project-context/SKILL.md`：MCP 写路径、Intent 必填、changed_files 范围、工具数
- `tests/e2e/active-context-probe.mjs`（新增）：浏览器点选 → ActiveContext 写回探针
- `tests/architecture/july-plan-gap-protection.test.ts`：UI-05 从「锁定缺口」改为正向锁定
- 测试更新：runtime-http / runtime-application-service / runtime-resource-pack / runtime-analyze-ingestion / v06 两个 web 结构测试（B-1 后的旧断言）

## Schema

无迁移。

## Before / After flow

```text
Before: Core 缺 Intent 默认 revise；analyze 合同 maxFiles=0（真实 Bridge 拒绝）；
        CLI 无 doctor/capabilities/current/inspect；MCP 只能读 Run；
        CLI/MCP 拿不到 launcher 的随机 Core token；Skill 声明过时
After:  Intent 显式必填；analyze 合同被真实 Bridge 接受（实测 bound）；
        CLI doctor/capabilities/current/inspect/dry-run 实测可用；
        MCP create→dispatch→review→claim→cancel 全链实测；
        token 落盘自动读取；浏览器点选→Core ActiveContext→CLI 立读实测通过
```

## Security impact

- Core token 落 `.codex-runtime/local-core-token`（gitignore），stop 时删除；CLI/MCP 仅从本目录读取
- 端口清扫/签名逻辑不受影响；无新依赖
- MCP 写工具全部走 Local Core 既有 127.0.0.1 端点，不直连 SQLite

## Failure recovery

- 缺 Intent 创建 Run → 400/409 明确错误（不再静默 revise）
- analyze 合同不符合内核 → 真实 Bridge 校验失败现在会直接暴露（不再被 Fake 掩盖）
- `project current` 多项目歧义 → 明确列出候选 id，不猜
- CLI/MCP 无 token 时 → 401 明确提示；token 文件随栈停止清理

## Tests actually run（真实环境）

- 单元/架构/集成：75 文件 / 361 测试全绿；全仓库 typecheck 4/4；lint 无新增错误
- 真实栈（dev:open）：`lcos doctor` healthy=true；`capabilities` 输出 bridge 版本/契约/两 provider；`project current/inspect` 实测；`run create --dry-run` 输出 payload
- MCP 真实链路：`create_lcos_run(analyze)` → `dispatch`=bound（真实 task 落 Bridge）→ `get_lcos_run`=queued+binding → `claim`=claimed → `cancel`=cancelled
- 浏览器探针：headless Chromium 点击 `view-brief` → Core `selectedViewIds=["view-brief"]` → `lcos context get` 立读一致（验收条件 7）

## Known limitations

- CLI-06 `run events` 需 durable Event 表（Schema 红区，未做）；`run cancel` 需 Core cancel 后端 + Bridge 端口扩展（未做，待决策）
- MCP-03 `compare` 无后端端点，未实现
- CLI-04/05/07（Artifact inspect/compare、Feedback、Checkpoint/Preview）未做，列入 Slice F 前决策
- 浏览器级三 Intent 完整 Golden Path 待 Slice F

## Rollback

Revert `05ab9d9` / `ed31984` / `b81b943`；无 Schema/数据迁移。Intent 必填回滚后恢复旧默认，保护测试需同步回退。

## Worktree clean / STOP-GO

- 本 Handoff 提交后工作区干净
- **GO → Slice E**：右侧 Artifact Workbench（单击/双击/Preview/Viewer Registry）

---

_Codex 2026-08-03，全部结论基于本次实测。_

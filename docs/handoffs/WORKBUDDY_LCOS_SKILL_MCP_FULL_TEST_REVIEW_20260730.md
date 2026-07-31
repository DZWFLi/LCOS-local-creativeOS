# WorkBuddy LCOS Skill / MCP 完善与全测试交付

日期：2026-07-30  
Branch：`codex/mvp-fast-build`  
基线：`9eebc87`  
执行方：WorkBuddy (task_98c07da7)

## 任务摘要

本轮把 LCOS Agent 对接（Project Context Skill + stdio MCP）升级为权威、可正式接入 WorkBuddy 的形态：

```text
LCOS Canvas / Project Truth
→ ActiveContext
→ LCOS Project MCP (14 tools, including 6 Bridge)
→ Light Bridge V1 pull Task (thin loopback delegation)
→ Agent claim / start / submit
→ ArtifactReturn
→ Accept / Retry / Reject
```

## 实际范围

### 已完成

#### 1. LCOS stdio MCP 新增 6 个 Bridge 工具（薄委托）

`tools/lcos-agent/mcp-server.mjs`：14 个工具（原 8 个 + 新增 6 个 Bridge 工具）：

| 工具 | 说明 | 委托方式 |
|---|---|---|
| `claim_lcos_task` | Pull 一个 Light Bridge 待分配任务 | `bridgeRequest` → `POST /v1/tasks/claim-next` |
| `start_lcos_task` | 将任务标记为 running | `bridgeRequest` → `POST /v1/tasks/{id}/running` |
| `get_lcos_task` | 读取 Light Bridge 任务状态 | `bridgeRequest` → `GET /v1/tasks/{id}` |
| `get_lcos_task_by_run` | 按 LCOS run ID 查 Bridge 任务 | `bridgeRequest` → `GET /v1/tasks/by-run/{id}` |
| `submit_lcos_result` | 回传执行结果 | `bridgeRequest` → `POST /v1/tasks/{id}/result` |
| `cancel_lcos_task` | 请求取消 Bridge 任务 | `bridgeRequest` → `POST /v1/tasks/{id}/cancel` |

**薄委托约束已执行：**
- 每个 Bridge 工具 = 一行 `bridgeRequest()` HTTP 调用，零业务逻辑
- 不复制状态机、不实现队列/重试/死信/worker 路由
- 不直接访问 SQLite
- 不自动 Accept
- 不修改 Schema
- 不新增依赖
- 所有连接强制 loopback（`127.0.0.1`/`localhost`/`[::1]`，由 client.mjs 网关保证）

#### 2. 权威 Skill 文档

`packages/skills/lcos-project-context/SKILL.md`：从 40 行扩展到 200+ 行的权威 Skill，覆盖：

- Architecture boundary（Project MCP vs Bridge MCP，轻量 Loopback 委托）
- 完整调用次序（Read phase → Execute phase → claim-start-execute-submit_result）
- OutputIntent（create / revise / analyze）
- changed_files 结构化规范
- Draft / Pending / Accept / Reject / Retry 完整生命周期
- Agent Browser 与飞书链接上下文
- 10 条安全规则（不覆盖源文件、不自动 Accept、不越界写 outputRoot 等）
- 测试验证清单
- 完整 WorkBuddy agent flow 示例

#### 3. 配置与文档更新

- `.mcp.json.example`：新增 `LCOS_BRIDGE_URL` 环境变量
- `tools/lcos-agent/README.md`：工具列表补充 Bridge task lifecycle 说明

### 明确未做

- 不引入 tldraw 或第二张 Canvas
- 不抓取私有飞书正文
- 不自动 Accept、不自动创建 Revision
- 不复制 Light Bridge 状态机
- 不做多 Agent 自由编排、Watcher、源文件覆盖
- 不提交（commit/push 禁止）

## 不修改的项目

本次所有改动均在以下文件范围内，未触碰任何项目核心代码（apps/web、apps/local-core、packages/domain、packages/contracts 均未修改）：

```text
tools/lcos-agent/mcp-server.mjs          (新增 6 个 Bridge 工具)
tools/lcos-agent/.mcp.json.example       (新增 LCOS_BRIDGE_URL)
tools/lcos-agent/README.md               (工具列表更新)
packages/skills/lcos-project-context/SKILL.md  (权威版全文重写)
docs/handoffs/WORKBUDDY_LCOS_SKILL_MCP_FULL_TEST_REVIEW_20260730.md  (本手交文件)
```

## 测试结果

| 测试 | 结果 | 说明 |
|---|---|---|
| `npm run lint` | ✅ PASS | 0 errors，全部 workspace。Warnings 均为既有的 App.tsx / import-copy / contracts 遗留 |
| `npm run typecheck` | ✅ PASS | 全部 4 个 workspace |
| `npm run test` | ⚠️ 112/113 PASS | 1 fail：`v07Integration.test.ts` 中 `sourceKind: external_url` 未在 `createLinkReferenceDocument` 落地——**既有测试缺口**，非本次回归 |
| `npm run build` | ✅ PASS | Web production build 成功 |
| `npm run smoke` | ✅ PASS | 2 built assets, React root present |
| `npm run test:architecture` | ✅ 27/27 PASS | |
| `npm run test:integration` | ✅ 5/5 PASS | |
| `npm run test:e2e:golden` | ❌ FAIL | Local Core (127.0.0.1:43121) 未运行——**环境问题** |
| `npm run test:e2e` | ⚠️ 1/4 PASS | 3 fail 均为 `ERR_CONNECTION_REFUSED` (dev server not running)——**环境问题** |
| `git diff --check` | ✅ PASS | 无空白问题（初始有个 trailing whitespace 已修复） |
| `pytest tools/light-bridge-kernel/tests` | ✅ 26/26 PASS | |
| LCOS MCP `initialize` + `tools/list` smoke | ✅ PASS | 14 个工具全部注册，schema 完整 |
| `npm run bridge -- doctor` | ✅ PASS | Bridge 0.2.0 / bridge-task-v1 / pull / 双 provider (workbuddy + codex) / create+revise+analyze |

### 改为文件

```text
packages/skills/lcos-project-context/SKILL.md    → 重写为权威 Skill (200+ 行)
tools/lcos-agent/mcp-server.mjs                  → +68 行 (6 个 Bridge 工具)
tools/lcos-agent/.mcp.json.example               → +1 行 (LCOS_BRIDGE_URL)
tools/lcos-agent/README.md                       → +1 行 (工具列表更新)
```

## 证据

- MCP `tools/list` 输出：14 个工具，含全部 6 个 Bridge 工具（claim/start/get/get_by_run/submit/cancel）
- Light Bridge Pytest：26/26 passed
- Bridge doctor：`bridgeVersion: 0.2.0`, `primaryContractVersion: bridge-task-v1`, `providers: [workbuddy, codex]` (both `pull`)
- `git diff --check` 通过

## 风险与未完成

1. **v07Integration.test.ts 既有测试缺口**：`createLinkReferenceDocument` 缺少 `sourceKind: external_url` 字段。非本次引入，但需后续 Slice 修复。
2. **e2e 测试依赖运行环境**：需 Local Core + dev server 同时运行。非本次回归，是环境前置条件。
3. **Bridge Python 环境**：需单独配置 `LCOS_LIGHT_BRIDGE_PYTHON`；`scripts/light-bridge.mjs` 默认使用系统 `python.exe`。测试中安装了 `pytest`/`pydantic`/`fastapi`/`uvicorn`/`httpx2` 到 managed Python 3.13.12。
4. **Bridge 工具实际调用验证**：当前 Bridge 未运行（无 workflow:provider 任务），新增的 6 个工具 schema 正确但未经过真实 Bridge 收发。建议后续 Slice 做一次 `claim → start → submit → get` 完整端到端验证。
5. **queue 中还有 task_c71e72bb**：未在此轮执行，需后续处理。

## 回滚说明

1. 删除 `tools/lcos-agent/mcp-server.mjs` 中第 32–52 行（6 个新工具定义）和 113–145 行（6 个 handler）可独立撤销 Bridge 工具。
2. 回退 `packages/skills/lcos-project-context/SKILL.md` 到 git 基线可恢复旧 Skill。
3. 删除 `.mcp.json.example` 中的 `LCOS_BRIDGE_URL` 行不影响原功能。
4. 上述改动不影响 Local Core / Web / Domain / Contracts 任何核心代码。

## 下一步

1. 由 Codex 验收本交付（`submit_result` → `review`）。
2. 处理 queue 中的 `task_c71e72bb`。
3. 后续 Slice 做一次 Bridge 工具真实端到端验证（claim → start → submit → get 全流程）。
4. 修复 `v07Integration.test.ts` 既有测试缺口。

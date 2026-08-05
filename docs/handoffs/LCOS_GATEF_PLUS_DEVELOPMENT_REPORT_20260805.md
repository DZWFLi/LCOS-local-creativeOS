# LCOS Gate F Plus 开发与验证报告

> 日期：2026-08-05  
> 状态：Windows Evidence Candidate  
> 说明：本报告只记录本包实际代码与本环境实际测试，不把待实机验证写成完成。

## 1. 本轮完成

### MCP 与 Bridge

- 拆分 `local-creative-os` 与 `lcos-executor` 两个 MCP；
- Agent 与 Executor 工具零重叠；
- Light Bridge 删除公共 MCP，仅保留 REST；
- Local Core 通过 Bridge REST Adapter 调度；
- Codex 安装脚本备份配置，并只清理精确匹配的旧 `ai_bridge`；
- Executor Runner 启动时禁用 Agent MCP，避免工具面污染。

### 上下文直接导入

- `ContextImportSourceV0`；
- Codex JSONL 分片、流式导入；
- 手动粘贴时间线；
- SQLite L0 Message / Tool / Event / File Reference；
- FTS5 + BM25；
- L1 规则章节、改名、锁定、刷新；
- 消息钉选为 Decision Artifact；
- Timeline / Outline / Search Web 管理入口；
- Conversation Export 与 `.lcosproj` 精简导出。

### L2 / L3

- 章节小标注合同与持久化；
- `sourceContentHash` 防止旧标注伪装最新；
- Ollama Embedding Provider；
- sqlite-vec 可选安装器与加载器；
- SQLite BLOB 回退；
- 可恢复 embedding job、stale 计算与重建；
- FTS5 + Vector 混合检索；
- CLI / MCP / Web 可查看与触发语义索引。

### 既有 Gate F 保留

- ActiveContext、CommandDraft、Context Proposal；
- waiting_input；
- Session Affinity；
- create / revise / analyze；
- cancel / late result；
- Resource Import；
- Accept / Reject / Retry 生命周期。

## 2. 关键代码面

```text
packages/contracts/src/conversations.ts
apps/local-core/src/conversation-import-service.ts
apps/local-core/src/metadata-repository.ts
apps/local-core/src/server.ts
apps/local-core/src/bridge-rest-client.ts
tools/lcos-agent/mcp-server.mjs
tools/lcos-agent/mcp-executor-server.mjs
tools/lcos-agent/lib/mcp-stdio-runtime.mjs
tools/lcos-agent/cli.mjs
scripts/install-lcos-codex-mcp.mjs
scripts/install-sqlite-vec.mjs
scripts/bootstrap-lcos.mjs
apps/web/src/features/conversations/ConversationContextDialog.tsx
```

## 3. 实际验证

本环境已通过：

```text
Domain build
Local Core build / noEmit
Conversation Import Smoke
Gate F Plus Contract Check
Agent / Executor MCP tool split
真实 Light Bridge REST + Local Core + 两个 MCP E2E
Light Bridge pytest 33 tests
Light Bridge compileall
TS / TSX syntax scan
MJS node --check
```

Conversation fixture 验证包括：

```text
139 messages
4 derived sections
FTS lexical search
message pin → 2 decisions
.lcosproj schema 15 compact export/import
```

## 4. 诚实的未实测项

### 需要 Windows + Codex

- Codex 0.147 Windows CLI 真实新建 / resume；
- 两个 MCP 在真实 Codex Session 的角色加载；
- 连续 3–5 Run 的 Session 复用；
- waiting_input 后同 Session resume；
- Windows Runner cancel / process tree；
- Watchdog / Runtime Host 生命周期。

### 需要 Ollama / native extension

- Windows `sqlite-vec` DLL 实际加载；
- Ollama 模型下载和真实批量 embedding；
- sqlite-vec KNN + FTS5 混合查询。

代码和 smoke runner 已提供，但当前容器没有 Windows DLL 与 Ollama 服务，所以没有伪造绿色结论。

### 依赖安装限制

当前 npm registry 无法可靠取得完整 Web/Vitest/Playwright 依赖，故本环境不能重新执行完整 `npm ci`、Vite build 和浏览器 E2E。TypeScript 源码语法扫描和 Local Core 编译已完成。

### 官方 MCP SDK

协议层已经与业务工具分离，但官方 npm SDK 本身未在本环境安装成功。后续可在依赖可用时替换 stdio transport adapter，不改变 MCP 名称、工具合同和 Local Core API。

## 5. 回滚

- Schema 使用向前 Migration 与升级备份；
- Conversation tables 是新增域，不修改 Current Revision；
- 向量与 FTS 均为 derived index；
- 关闭 L3 不影响 L0/L1/FTS；
- Light Bridge 0.3 可单独回退，但回退后不得恢复公共 MCP。

## 6. 当前判断

```text
可作为 Windows Evidence Candidate：是
可直接宣称正式合并：否
需要推倒重写：否
下一步：按 evidence checklist 在目标 Windows 机器运行并回传证据
```

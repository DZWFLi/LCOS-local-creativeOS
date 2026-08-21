# LCOS Gate F Plus 大轮 Windows 实机证据清单

> 目标：验证两个 MCP、真实 Codex Session、L0–L3、Watchdog、取消和浏览器闭环。  
> 请回传原始 evidence 目录，不用截图代替日志。

## 0. 一键收集基础证据

```powershell
powershell -ExecutionPolicy Bypass -File scripts/gatef-plus-windows-evidence.ps1
```

## 1. 环境指纹

```powershell
codex --version
codex --help
codex exec --help
codex mcp --help
where.exe codex
node --version
npm --version
py --version
ollama --version
```

## 2. 依赖与质量链

```powershell
npm ci
npm run build:local-core
npm run build
npm run lint
npm run typecheck
npm test
npm run test:architecture
npm run test:integration
npm run test:e2e
```

## 3. Bootstrap 与 MCP 角色

```powershell
node scripts/bootstrap-lcos.mjs
codex mcp list
codex mcp get local-creative-os --json
codex mcp get lcos-executor --json
npm run check:gatef-plus
npm run test:lcos-mcp-e2e
```

验收：

```text
local-creative-os 默认启用
lcos-executor 默认关闭，只由 Runner 会话启用
Agent MCP 不出现 claim/start/heartbeat/submit
Executor MCP 不出现项目/画布/对话工具
Light Bridge /mcp 返回 404
没有 ai_bridge / 8920
MCP command 不引用 fnm 临时 multishell node.exe
```

## 4. Conversation L0 / L1

```powershell
npm run smoke:conversation
npm run smoke:schema-v18
npm run smoke:conversation-recovery
$env:LCOS_LARGE_CONVERSATION_LINES='100000'
npm run smoke:conversation-large
```

GUI 验证：

```text
导入真实 Codex JSONL
时间线 / 大纲 / 关系图切换
全文搜索
章节改名并锁定
刷新不覆盖锁定章节
钉选消息为 Decision 节点
文件引用只匹配已有项目文件
导入诊断显示忽略、无效、重复和命中文件数量
```

80 MiB 以上 JSONL：导入不整文件进内存，中断后可重试，重启后搜索和章节仍在。

## 5. L2 按需标注

- 在某章节点击“让 Agent 提炼”；
- 确认产生真实 analyze Run；
- Codex 读取章节原文；
- 返回 5 字左右标题、最多 3 条决策和 3 条待办；
- 人工改标题并锁定；
- 再次刷新或重跑，不覆盖人工结果；
- 修改原文后，旧 sourceHash 被拒绝。

## 6. L3 sqlite-vec + Ollama

```powershell
ollama pull nomic-embed-text
node scripts/install-sqlite-vec.mjs
$env:LCOS_REQUIRE_SQLITE_VEC='1'
$env:LCOS_OLLAMA_EMBED_MODEL='nomic-embed-text'
npm run smoke:conversation-semantic
```

验收：

```text
backend = sqlite-vec
indexedMessages > 0
第二次增量构建 indexedMessages = 0
混合搜索 reasons 包含 lexical / vector
修改内容后 staleMessages 增加
重建后 staleMessages = 0
Core 重启后任务和索引状态恢复
关闭 Ollama 后 FTS5 仍可搜索
```

## 7. 真实 Codex 自动执行与 Session

在 disposable Project 运行：

```text
1. analyze 零文件
2. revise Draft
3. create 两文件
4. waiting_input → 回答 → 同 Session 继续
5. running cancel
6. 连续再跑至同项目累计 5 Run
```

每个场景保存：

```text
Project ID
Run ID
Task ID
externalSessionId
claim/start/submit 时间
spawn 或 resume
Core / Bridge / Watchdog / Codex stdout+stderr
```

验收：同一有效 Session 不乱跳；Session 明确失效后只新建一次；不同 Project 可并发，同一 Project 串行。

## 8. Canvas 观察—行动—再观察

- 打开 Codex 内置浏览器和 LCOS Agent 面板；
- 用户单选、多选、移动视口、加入参考；
- 记录 Web 写入时间和 Codex 收到新 version 的时间，目标 ≤1 秒；
- Codex 调用 select/focus/move/set_viewport/create_relation/open_preview；
- 再读取 Snapshot，确认版本、坐标、关系、Cluster 和 recentChanges 更新；
- 生成 Canvas Observation，确认 screenshotRef 和 contentHash。

## 9. Cancel 与迟到结果

- running 时撤回；
- Runner graceful interrupt；
- 超时后只终止 LCOS 拥有的进程树；
- 人为提交迟到 Result；
- 迟到结果只归档，不创建 Draft，不修改 Current。

## 10. `.lcosproj` 与恢复

```powershell
npm run smoke:lcosproj-browser
```

GUI：导出、重新打开、批量备份。确认默认不包含普通原始消息和向量；同机可恢复。跨机器打开时重新绑定 Project Root，不把旧绝对路径静默当成可用路径。

## 11. 最终回传

请把以下目录整体压缩回传：

```text
evidence/gatef-plus-*
.runtime/logs（仅本轮测试，先检查无凭证）
Playwright report
测试 Project 的 Run / Task / Session ID 对照表
```

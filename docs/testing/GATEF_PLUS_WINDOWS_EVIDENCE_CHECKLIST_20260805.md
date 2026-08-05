# Gate F Plus Windows 实机证据清单

> 目标：验证真实 Codex、两个 MCP、对话导入、FTS5、sqlite-vec/Ollama、取消和恢复。  
> 请保留命令原始输出，不用截图替代日志。

## 0. 环境

```powershell
codex --version
codex --help
codex exec --help
codex mcp --help
where.exe codex
node --version
npm --version
py --version
```

## 1. 解压与依赖

```powershell
npm ci
npm run build:local-core
npm run build
npm test
npm run test:architecture
npm run test:integration
```

## 2. Bootstrap 与两个 MCP

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
lcos-executor 默认禁用，只由 Runner 会话启用
Agent MCP 不出现 claim/start/heartbeat/submit
Executor MCP 不出现项目/画布/对话工具
Light Bridge /mcp 返回 404
```

## 3. 对话 L0 / L1

```powershell
npm run smoke:conversation
```

GUI 验证：

```text
导入 Codex JSONL
切换时间线 / 大纲
全文搜索
章节改名并锁定
刷新章节不覆盖锁定标题
钉选一条消息为决策节点
```

大文件验证：导入一个 80MB 以上 JSONL，观察内存不能随文件大小等比暴涨，导入中断后可以重试。

## 4. L3 sqlite-vec + Ollama

安装并启动 Ollama，再准备模型：

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
hybrid search 至少一个结果 reasons 包含 vector
重启后索引状态仍在
修改内容后 stale 数量增加
重建后 stale 回到 0
关闭 Ollama 后 FTS5 仍可搜索
```

## 5. 真实 Codex 自动执行

使用 disposable project，分别运行：

```text
analyze 零文件
create 两文件
revise Draft
waiting_input → 回答 → 同 Session 继续
running cancel
```

记录：

```text
Project ID
Run ID
Task ID
externalSessionId
claim/start/submit 时间
是否新建或 resume
```

连续 5 Run：同一项目复用一个有效 Session，不重复窗口，不重复 lifecycle event。

## 6. 取消与迟到结果

- running 时撤回；
- Runner 先 graceful interrupt；
- 超时后只终止 LCOS 拥有的进程树；
- 人为制造迟到 Result；
- Result 只归档，不创建可接受 Draft，不改变 Current。

## 7. 重启恢复

依次重启：

```text
Local Core
Light Bridge
Runtime Host / Watchdog
```

确认：

```text
Project / Conversation / FTS / Sections 仍在
CommandDraft / ActiveContext 仍在
待 Review Return 仍在
Session Binding 可恢复
planned / queued Run 可继续
```

## 8. 收集证据

```powershell
powershell -ExecutionPolicy Bypass -File scripts/gatef-plus-windows-evidence.ps1
```

把生成的 `evidence/gatef-plus-*` 整个目录回传，不要只摘最后一行 PASS。

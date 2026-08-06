# LCOS Gate F Plus 大轮 Windows 实机验收报告（2026-08-05）

> 输入包：`LCOS_Fullstack_GateF_Plus_Big_Round_Windows_Evidence_Candidate_20260805.zip`
> SHA-256：`06f06b18b6daf936d4494d76c8379a38e9b98ea41b78fc9bcbf155ad02ccf44a`（校验通过）
> 入库提交：`887f501`；验收修复提交：`cba066c / b433b3f / bc8fcfc / b4caaa5`
> 结论：**大轮候选在 Windows 上质量链与真实 Codex 主闭环通过；MCP 真实会话加载仍被
> Codex CLI 0.147 客户端阻塞（已定位根因）；L3 真实 Ollama/native 未验证。**

## 1. 环境指纹

```text
Windows（本机）
Node v22.22.3 / npm 10.9.8 / Python 3.12.10
codex-cli 0.147.0-alpha.1.2（C:\Users\1\AppData\Local\OpenAI\Codex\bin\68de26ad08be95cd\codex.exe）
Ollama：未安装（L3 真实 Embedding 未验证）
```

## 2. 质量链（全部通过，修复后）

```text
npm ci                    PASS（92 packages；1 moderate 审计项，未自动改依赖）
lint                      PASS（仅警告：未用变量 / control-regex / hooks deps）
typecheck                 PASS（web + local-core + domain + contracts）
单测                      389 PASS（web 130 / local-core 250 / domain 5 / contracts 4）
架构                      63/63 PASS
集成                      5/5 PASS
build:local-core + build  PASS（web bundle 1.26MB js / 296KB css，chunk 超 500KB 警告）
```

### 验收中修复的问题（都是新代码合同问题）

```text
1. contracts 未导出 RunEvent（web 三处 import 失败）→ 补 Re-exports
2. App.tsx 在闭包内读 call.result.value，TS 收窄丢失 → 先取 events 再进回调
3. ConversationContextDialog 引用不存在的 decisionTitle 字段 → 对齐合同
4. runtimeBridge.test mock 缺 18 个新客户端方法 → 补齐
5. local-core 测试仍断言 schema 15 / .lcosproj 14 → 对齐 v18（.lcosproj 格式版本随
   本轮新内容升到 18；旧文件仍可打开，无版本闸门）
6. 搜索命中断言 source 字段（合同只有 reasons）→ 断言 reasons 含 fts5
7. 架构测试要求 watch.ps1 内含 run-codex-task.mjs → 新结构为薄壳指向 watch.mjs
8. bootstrap 在 Windows 找不到 npm（spawn npm.cmd 需 cmd.exe）→ 修复，干净机器引导可用
```

## 3. 专项 Smoke（全部通过）

```text
validate-gatef-plus：23/23 PASS（Agent 65 / Executor 12 / 零重叠 / Bridge REST-only /
  ai_bridge 精确退役 / Canvas Observation / L0-L3 代码路径）
conversation-import：139 messages / 4 sections / 2 pinned / 3 file refs / 5 lexical hits
conversation-recovery：deterministic identity / stale cleanup / 单行
conversation-semantic：139 indexed，增量 0，混合搜索 reasons 含 vector（BLOB fallback）
schema-v18-migration：backup + 旧行保留
codex-watchdog：跨项目并发、同项目串行、卡死超时
lcosproj-browser：download / upload / restore / 临时路径隐藏
gatef-core-smoke：14 项全 true
大文件导入：243,177,780 bytes / 100,000 messages / 58 chunks / 1,352 sections / FTS5 命中
Light Bridge pytest：35/35 PASS（starlette/httpx deprecation warning）
MCP split E2E：Agent 65 / Executor 12 / agentRejectedExecutor / canvas actions /
  claim→start→result→review 全链 PASS
Playwright E2E：7/7 PASS
```

## 4. Bootstrap 与 MCP 配置（通过）

```text
node scripts/bootstrap-lcos.mjs：PASS（修复 npm.cmd 后）
  - Skill 安装：C:\Users\1\.codex\skills\lcos-project-context
  - 配置备份：config.toml.lcos-backup-*
  - ai_bridge：已移除（旧签名精确匹配）
  - local-creative-os：enabled，稳定 launcher .cmd，无 fnm 临时 node 路径，
    startup_timeout 60s / tool_timeout 120s
  - lcos-executor：默认 disabled（符合设计，Runner 会话再启用）
codex mcp list：ai_bridge / 8920 不存在；两个 LCOS server 均为稳定 .cmd 入口
```

## 5. 真实 Codex 场景（同一一次性项目，5 个真实 Run）

项目：`project-gatef-plus-real2-985002bf`（6 文件 fixture 复制到临时目录）
首选会话：`019fd215-f6d8-7233-86e0-5e5d77a4e609`，全程未变

| # | 场景 | Run | 结果 |
|---|---|---|---|
| 1 | analyze 零文件 | run-72da0892… | ✅ completed（created→queued→running→completed） |
| 2 | create 两文件 | run-de9ab2dc… | ✅ completed，2 个 Artifact Return 接受后收口 |
| 3 | revise Draft | run-328d28ac… | ✅ completed，return 接受后收口（runner 报 sessionInvalid 标记，见 §7） |
| 4 | waiting_input | run-e384abd2… | ✅ 提问→等待→回答 todo.md→同会话续跑→completed |
| 5 | cancel | run-fa1c88c9… | ✅ 排队中取消，run/dispatch/binding 全部 cancelled |

证据：看门狗日志 `.codex-runtime/logs/codex-orchestrator.out.log`（含
`LCOS_CODEX_RESULT` 闭包行与 `Codex Runner 完成` 行）、Core provider-session
binding（origin=watchdog、failureCount=0、lastRunId 随场景推进）。

## 6. 浏览器探针（通过）

```text
single-click-probe：单选→selected=1、composer=true、ActiveContext v811→Agent v812
active-context-probe：ACTIVE_CONTEXT_WRITEBACK_OK
agent-surface-probe：提案创建/接受、Agent 面板同步 v816、AGENT_SURFACE_PROBE_OK
workbench-probe：双击打开 Workbench、Esc 关闭、截图落盘
closeout-diag：10 节点、Agent 面板 v819 与画布同步、无错误
```

未做逐毫秒测量（探针只有版本同步输出）；1 秒目标有实现路径但未严格计时。

## 7. 未通过 / 未验证（诚实清单）

### 7.1 MCP 真实会话加载：阻塞（A1 根因已定位）

```text
现象：真实 codex exec 会话（含 Runner 派单的会话）看不到 local-creative-os /
lcos-executor 的任何工具；Agent 显式上报“没有 MCP，走 CLI/REST 兜底”并完成闭环
（兜底是诚实的，但不是验收通过）。

本机实测：
1. codex exec（无 feature）：看不到任何 MCP 工具；
2. codex exec --enable mcp_2026_07_28 + -c 角色覆盖：仍看不到任何 MCP 工具；
3. 配置告警：unknown feature key in config: rmcp_client（该键已不被 0.147 识别）；
4. LCOS 服务器侧正常：直接 stdio 握手成功（protocolVersion 2025-11-25，
   serverInfo=lcos-executor 0.5.0，tools/list 正常）；
5. codex exec --help 无 MCP 加载开关；features list 中 mcp_2026_07_28 为
   under development 且默认 false。

结论：LCOS 侧 MCP（两个 server、稳定 launcher、角色分离、E2E）已就绪；
卡点是 Codex CLI 0.147 exec 模式的 MCP 客户端加载。开发需要：
  a) 确认目标 Codex 版本加载用户 MCP 的正确开关/配置格式（rmcp_client 已废，
     mcp_2026_07_28 启用后仍不加载，可能需要新的 [mcp] 配置或升级 CLI）；
  b) 在真实会话内列出工具并通过一次只读调用，作为 A1 关闭证据。
```

2026-08-06 补充（桌面会话实测）：按保姆级教程在**全新桌面对话**里查询，回复明确
“当前会话没有暴露任何 mcp__ 前缀工具，也没有 local-creative-os / lcos-executor
工具”。配置核对仍正常（local-creative-os=enabled、lcos-executor=disabled、
无 ai_bridge）。因此 **A1 升级为客户端级阻塞**：Codex 0.147 alpha 在本环境无论
exec 还是桌面会话都不加载 config.toml 的 MCP server；LCOS 侧（server、launcher、
配置、E2E）全部就绪。当前真实执行通道 = Skill + REST（已跑通 5+ Run），MCP 工具面
等待 Codex 客户端版本/配置机制支持后再验收。

2026-08-06 补充（provider 假设）：本机 config.toml 全局 `model_provider="deepseek"`
且 models.json 只含 DeepSeek 模型——所有会话均走第三方 provider，MCP 工具面不出现
与此高度吻合。尝试 `codex exec -c model_provider=openai` 做对照：ChatGPT 账号拒绝
`gpt-5.1-codex / gpt-5.2-codex / gpt-5.1-codex-mini`（均 “not supported”），CLI 侧
无法直接完成对照。**待桌面端验证**：新对话切换到账号可用的 OpenAI 模型后重跑 MCP
清单；若工具出现 → provider 为根因；若不出现 → 客户端构建/feature 为根因。

### 7.2 L3 真实 Ollama / native sqlite-vec：未验证

```text
本机未安装 Ollama；native DLL 未加载（BLOB cosine fallback 工作，增量索引、
混合评分、任务恢复均已通过 smoke）。真实模型 embedding 与 KNN 留待有 Ollama 的机器。

2026-08-05 补充：已尝试安装（winget / 官方安装包直连 / 代理 / BITS 多路），
安装包 1,490,000,000+ 字节且本机网络仅 100–200KB/s，单次会话无法拉完；
C 盘可用空间仅 3GB，安装与模型存放建议放 E 盘。
下载脚本已就绪（scripts/download-ollama.ps1 / download-ollama-loop.ps1 /
start-ollama-download.ps1），网络允许后即可继续：ollama pull nomic-embed-text →
node scripts/install-sqlite-vec.mjs → LCOS_REQUIRE_SQLITE_VEC=1 + LCOS_OLLAMA_EMBED_MODEL
跑 smoke:conversation-semantic。
```

### 7.3 其它未满项

```text
- running 中撤回进程树：只验证了排队中取消；运行中取消未实测
- 1 秒上下文同步：有版本同步证据，无逐毫秒测量
- Obsidian UI 点选：原生目录选择器无法 headless，仍以 smoke/单测为准
- Runtime Host 托盘完整生命周期（单实例/自启动/退出恢复）：托盘在跑，未全测
- runner 的 sessionInvalid 标记：revise run 在 closureObserved=true 且会话绑定未变、
  failureCount=0 时仍标 session_invalid —— 疑似误报或标记语义与重建逻辑不一致，需开发确认
```

## 8. 给开发的下一步

```text
P0-1  MCP 真实会话加载（§7.1，本机证据已给；这是唯一硬阻塞）
P0-2  澄清 runner sessionInvalid 语义（§7.3）
P1    running 撤回实测、1s 逐毫秒、托盘生命周期、Ollama 机器上跑 L3 真实验收
```

## 9. 复跑入口

```powershell
npm run smoke:gatef-plus-big
$env:LCOS_LARGE_CONVERSATION_LINES='100000'; npm run smoke:conversation-large
npm run test:lcos-mcp-e2e
py -m pytest tools/light-bridge-kernel/tests -q
npm run test:e2e
node scripts/probe-mcp-server.mjs <launcher-cmd>   # MCP 服务器侧握手自检
```

## 10. 补充验收（B6/B7 与 GUI→Core 合同审计）

```text
B6 长 Prompt + 重启恢复：通过（2790 字 analyze；强杀 Core 后 launcher 自动重启，
  Run 仍 completed，会话绑定 019fd215 不丢）
B7 选中→发送：通过（3 步；修复了 Composer 发 Run 400——GUI 发 requestedProvider=auto，
  Core 原只认 workbuddy|codex，已改为接受并解析）
GUI↔Core 合同全量审计：见 docs/audit/LCOS_GUI_CORE_CONTRACT_MISMATCH_AUDIT_20260805.md
  （除 auto 外未发现其它错位）
```

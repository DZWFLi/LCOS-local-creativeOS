> **状态说明：本文是前置设计草案。最终拍板与实现以 `ADR_GATEF_PLUS_MCP_BRIDGE_CONTEXT_IMPORT_20260805.md` 为准。**

# LCOS MCP 与 Bridge 解耦设计（不再混在一起）

> 日期：2026-08-05
> 决策来源：Dz 明确要求——“现在的 MCP 和 Bridge 很不规范，还很依赖老的 Bridge
> 架构，不想让它们再混在一起了”。
> 关联：`docs/audit/LCOS_MCP_COMPLETION_HELP_20260805.md`（MCP 完善为第一优先）

## 1. 现状问题（实测证据）

当前仓库存在**三张 MCP 面**，职责混杂：

```text
① ai_bridge（老架构）
   tools/ai-bridge-runtime/bridge_server.py → http://127.0.0.1:8920/mcp
   本机 config.toml 仍启用了 [mcp_servers.ai_bridge]，服务早已不在 8920 上

② Light Bridge（执行器自己的 MCP）
   tools/light-bridge-kernel → http://127.0.0.1:43122/mcp（streamable HTTP JSON-RPC）
   执行器同时暴露 REST 与 MCP 两套协议

③ local-creative-os（Codex 面对的唯一 MCP）
   tools/lcos-agent/mcp-server.mjs → stdio
   58 个工具同时包含：画布/上下文读、上下文写、Run 生命周期、
   Bridge Task 认领/开始/提交/取消、连接器、资源——角色混杂在一个 server
```

连带问题：

```text
- “给用户/Agent 用的 MCP”和“给执行器用的任务工具”混在同一个 58 工具清单里；
- client-facing MCP 直接依赖 Bridge REST（claim/start/submit），Bridge 内部细节
  泄漏到 Agent 工具面；
- 老 ai_bridge 长期残留配置，每次会话启动都会尝试连 8920 并失败；
- 没有统一的“哪一层该暴露什么协议”的边界规则。
```

## 2. 目标架构（一张图）

```text
┌─────────────────────────────┐
│ Codex / 其它 Agent（GUI）   │
└──────────────┬──────────────┘
               │ MCP（stdio）
               ▼
┌─────────────────────────────┐
│ local-creative-os（唯一 MCP）│ ← 薄适配器：只翻译协议，不含业务
│  namespace: canvas/context/  │
│  run/resources/connectors    │
└──────────────┬──────────────┘
               │ loopback REST（127.0.0.1:43121）
               ▼
┌─────────────────────────────┐
│ Local Core（唯一领域边界）  │  ← SQLite、Graph、Run 状态、Guard
└──────────────┬──────────────┘
               │ Bridge REST（127.0.0.1:43122，仅内部）
               ▼
┌─────────────────────────────┐
│ Light Bridge（执行器，只 REST）│ ← 租约/认领/心跳/结果，不暴露 MCP
└──────────────┬──────────────┘
               ▼
        Watchdog / Runner / Buddy
```

规则：

```text
1. 对 Codex / 用户只暴露一个 MCP：local-creative-os；
2. MCP 只做协议翻译，所有业务真相在 Local Core，所有执行在 Bridge；
3. Bridge 只暴露 REST（执行器协议），删掉自己的 /mcp；
4. 老 ai_bridge 整体退役，从 Codex 配置移除；
5. MCP 工具按角色命名空间分组，执行器专属工具与用户/Agent 工具分离。
```

## 3. 工具角色分离（二选一，建议 A）

### 方案 A：单 MCP + 命名空间 + 工具开关（推荐）

```text
local-creative-os（唯一 stdio server）
  namespace lcos.canvas.*    读画布/Workspace/ActiveContext
  namespace lcos.context.*   上下文命令/提案/Target/搜索
  namespace lcos.run.*       Run 创建/派发/恢复/取消/Review/Return
  namespace lcos.resource.*  资源描述/读取/匹配/导入
  namespace lcos.connector.* 连接器（Obsidian 等）
  namespace lcos.executor.*  claim/start/heartbeat/fail/submit（仅执行器会话启用）
```

Codex 配置用 `enabled_tools` / `disabled_tools` 按会话角色裁剪：

```text
普通 Agent 会话：禁用 lcos.executor.*
执行器会话（看门狗 resume 的 codex exec）：启用 lcos.executor.*
```

### 方案 B：两个 MCP server（更彻底）

```text
local-creative-os      画布/上下文/Run 管理（面向用户与普通 Agent）
lcos-executor          认领/开始/心跳/提交/失败 + Run 事件（仅执行器注册）
```

如果“不想混在一起”是原则，方案 B 更干净；代价是安装器要多注册一个 server。
建议先做方案 A 的命名空间与开关，再按验收决定是否拆成 B。

## 4. 迁移步骤（给开发）

```text
Step 1  从 Codex 配置移除 ai_bridge（备份后 codex mcp remove ai_bridge）
Step 2  Light Bridge 删除 /mcp 端点（只保留 REST），删对应测试与文档声明
Step 3  用官方 SDK 重写 mcp-server.mjs 的传输层（stdio），业务 handler 保持薄委托
Step 4  工具按 §3 命名空间重组；安装器支持按角色 enable/disable 工具
Step 5  执行器专属工具与 Bridge REST 的耦合收敛到 executor 命名空间/独立 server
Step 6  验收：真实 codex exec 会话内工具按角色出现；Bridge 无 /mcp；ai_bridge 不存在
```

## 5. 可借鉴的开源项目（GitHub 已实证）

| 项目 | 抄什么 |
|---|---|
| modelcontextprotocol/servers | 官方参考 server：工具 schema、structuredContent 结果信封、transport 无关的工具层；“Everything”测试 server 可当协议测试台 |
| modelcontextprotocol/typescript-sdk | 官方 TS SDK：StdioServerTransport / StreamableHTTPServerTransport、initialize 握手、取消、ping；别继续手搓 JSON-RPC |
| wong2/litemcp | 轻量 TS 框架：最小 server 的优雅写法；不想上官方 SDK 时参考 |
| jlowin/fastmcp | Python 版“干净 server”范式：一个 server = 一个业务边界；Light Bridge 侧若保留 Python 可参考 |
| sparfenyuk/mcp-proxy | stdio ↔ HTTP 代理：MCP server = 纯传输适配器、零业务逻辑——local-creative-os 的定位样板 |
| punkpeye/mcp-proxy | TS 版 streamable HTTP/SSE 代理：以后把 stdio server 暴露给远端 Agent 时直接借鉴 |
| lastmile-ai/mcp-agent | Agent 编排框架：区分“Agent 工具层”与“执行层”，学它的角色分离与组合模式 |
| mark3labs/mcp-go | Go 版协议实现：跨语言协议一致性参照（若以后做轻量 Go worker） |
| wong2/mcp-cli | MCP 检查器 CLI：list tools / call tools，直接当我们的验收调试工具 |
| modelcontextprotocol/specification | 协议规范：streamable HTTP、lifecycle、roots、sampling、cancellation 的符合性清单 |

## 6. 验收口径

```text
1. codex mcp list 只剩必要 server；ai_bridge 不存在；
2. Bridge 不暴露 /mcp，只有 REST；
3. local-creative-os 是唯一 Codex MCP，工具按角色命名空间分组；
4. 普通会话看不到 executor 工具；执行器会话看得到且能真实 claim/start/submit；
5. 真实 codex exec 会话内工具可见并调用成功（不是 REST fallback）；
6. 重启后依旧；有自动化验收证据。
```

## 7. 风险与回滚

```text
- 改名/拆 server 会破坏现有 Skill 的工具名 → 保留旧工具名作 alias 到新命名空间；
- 删除 Bridge /mcp 前确认没有依赖它的一方（当前 Codex 走 REST，无依赖）；
- config.toml 改动先备份（安装器已有备份机制）；
- 每一步独立提交、独立验收；不通过就不进下一步。
```

## 8. 全新机器部署要求（老 Bridge 完全退役，LCOS 单包承担全部功能）

> 决策来源：Dz——“希望新的 LCOS 部署到任何一台先前没装过类似东西的电脑上，
> 都能承担起老 bridge 和它自己的功能”。

目标：把包拷到一台**从未装过任何类似东西**的 Windows 电脑，一条命令完成
Core + Bridge + MCP + Skill + CLI + Web 全通；老 bridge 不用装、不用迁、
也不许残留。

### 8.1 自包含运行环境

```text
1. 不依赖 PATH 里某个特定 node / python 版本；发现不到就明确报错并给出安装指引
   （Gate W 可打包内置运行时）；
2. 绝对禁止把“安装时所在 shell 的临时 node 路径”（fnm multishell shim）写进
   MCP 配置——这是本轮实测定位的 A1 根因之一，也是全新机器部署的硬伤；
3. 包内自带 package-lock.json，全新机器 npm ci 可复现依赖。
```

### 8.2 单命令引导（bootstrap）

```text
1. 检测/初始化 .codex-runtime（token、SQLite schema、日志目录）；
2. 安装/校验 Skill（整树 hash 幂等）；
3. 注册/校验唯一 MCP（local-creative-os），并备份后清理任何 ai_bridge 残留；
4. 启动 Core(43121) + Bridge(43122) + Web，看门狗按需；
5. 全程输出“医生”检查表：运行时可发现 → Core 健康 → Bridge 健康 → MCP 配置
   → Skill 哈希 → CLI 可用 → 浏览器 URL；失败项给修复动作，不给裸报错。
```

### 8.3 老 Bridge 完全退役

```text
1. Light Bridge 承担老 ai_bridge 全部功能：task 生命周期、waiting_input、
   worker run-once/watch、V0 兼容查询；
2. 新机器不装、不启动、不配置 ai_bridge；旧机器由安装器备份并移除其 MCP 配置；
3. 迁移完成后删除 tools/ai-bridge-runtime 与一切 8920 端口引用；
4. 不再出现“先装老 bridge 再装新 LCOS”的依赖链。
```

### 8.4 全新机器验收（干净机器 / 干净用户目录）

```text
1. doctor 全绿；
2. codex exec 真实会话内看到唯一 MCP 的 58 个工具并成功调用只读工具；
3. 创建项目 → 导入文件 → 建 Run → 真实执行 → 结果回画布；
4. 重启后全部可恢复；
5. 全程不出现 ai_bridge / 8920 / sessions.json 手工编辑 / fnm shim 路径；
6. 验收脚本把检查项写成可复现清单，作为每次部署的回归基线。
```

## 9. 决策：老 bridge 不做环境依赖（选“退役替代”）

> 候选对比由 Dz 提出：要么新 LCOS 单包承担老 bridge 功能（A），
> 要么把老 bridge 变成新机器的环境依赖（B）。结论：**选 A**。

### 9.1 对比

```text
方案 A：退役替代（选）
  新机器零前置；单一任务真相（Light Bridge）；故障面最小；
  Light Bridge 已覆盖老 bridge 全部功能（task 生命周期 / waiting_input /
  worker run-once/watch / V0 兼容查询），切换成本可控；
  安装器负责旧机器配置迁移，新机器根本不接触老组件。

方案 B：老 bridge 作为环境依赖（否）
  每台新机器多一个硬前置：先装老 bridge、装对版本、起对端口；
  两套任务状态 / 两套端口 / 两套 MCP 并存 = 双真相；
  新机器部署失败率更高、排障更难；
  更关键：老 bridge 本身正是本轮问题源（fnm shim、8920 残留、
  config.toml 混杂），把它变成新系统地基等于把不可靠因素固化。
```

### 9.2 可靠性判断

```text
可靠性 = 单一真相 + 明确边界 + 可复现引导。
方案 B 的“复用”没有换来可靠性，只是把退役中的组件升级成硬依赖；
方案 A 的“重写覆盖”换来的是：安装一遍、一套端口、一个 MCP、一份状态。
```

### 9.3 迁移策略（降低切换风险）

```text
迁移期：把老 bridge 当“兼容输入”，不当“运行时依赖”
  - 旧机器：安装器备份 config.toml / 旧任务数据，Light Bridge V0 兼容查询
    继续可读旧 Task；
  - 新机器：不装、不启动、不配置 ai_bridge；
  - 完成迁移后：删除 tools/ai-bridge-runtime 与所有 8920 端口引用。

例外：若未来老 bridge 被第三方外部系统接管（不在仓库内），再按
“外部系统依赖”单独评估；本决策不因此改变。
```

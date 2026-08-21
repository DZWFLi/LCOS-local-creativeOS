# LCOS MCP 完全完善 — 给开发的帮助文档（第一优先）

> 日期：2026-08-05
> 决策：**做任何新功能（含 P0 对话导入）之前，先把 MCP 完全完善。**
> 理由：对话导入要走 Skill / MCP / CLI；MCP 是 Agent 与 LCOS 之间的正式通道，
> MCP 不完善，等于地基没打。

## 1. 什么算“完全完善”（验收口径）

```text
1. codex mcp list 显示 local-creative-os = enabled，无异常
2. 真实 codex exec / Desktop 会话内能看到 local-creative-os 的 58 个工具
3. 真实会话内能调用至少一个只读工具（如 list_lcos_projects）并返回真实 Core 数据
4. 整个调用链不依赖 REST fallback；Agent 不能再说“没有 MCP，我用等价 REST 完成”
5. 重启 Codex Desktop / CLI 后依然可用（不是装完当时能用）
6. 有自动化验收：从真实会话抓证据，而不是只看配置
```

## 2. 现状证据（2026-08-05 本机实测）

### 配置层：已注册、enabled

```text
codex mcp get local-creative-os --json：
  name = local-creative-os
  enabled = true
  transport = stdio
  command = C:\Users\1\AppData\Local\fnm_multishells\10144_1785912352326\node.exe
  args    = E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\tools\lcos-agent\mcp-server.mjs
  env     = LCOS_CORE_URL=http://127.0.0.1:43121
            LCOS_BRIDGE_URL=http://127.0.0.1:43122
            LCOS_CORE_TOKEN_FILE=<worktree>\.codex-runtime\local-core-token
            LCOS_REPO_ROOT=<worktree>
```

### 失败层：真实会话没有工具

Gate F 实机验收中，真实 `codex exec` 会话内**没有** `local-creative-os` 工具，
Agent 显式上报“无 MCP，用等价 REST 完成”。注册成功 ≠ 加载成功。

### 已定位的根因线索（高置信）

```text
线索 1（最可疑）：command 写死的是 fnm multishell 临时 node.exe
  - scripts/install-lcos-codex-mcp.mjs 用 process.execPath 作为 MCP 的 command；
  - 本机 process.execPath 是 C:\Users\1\AppData\Local\fnm_multishells\10144_...\node.exe，
    这是某个终端会话的临时 shim（当前还活着，但随时可能随 shell 清理消失）；
  - 每次从不同 shell 跑 npm run dev:stack / install 都会写成那个 shell 的临时路径；
  - Codex 启动 MCP 时若该路径失效 → 服务器起不来 → 工具静默缺失。

线索 2：遗留 ai_bridge 仍启用在配置里
  - config.toml 仍保留 [mcp_servers.ai_bridge] url = http://127.0.0.1:8920/mcp；
  - 这是旧版 Bridge HTTP MCP，当前服务不在 8920 上，Codex 每次会话启动都会尝试
    连接并超时/报错，可能干扰会话启动或掩盖真正错误；
  - 安装器只管理 local-creative-os 同名条目，不会清理 ai_bridge。

线索 3：local-creative-os 未设 startup_timeout_sec / tool_timeout_sec
  - 默认超时对纯 stdio 脚本通常够用，但显式配置能消除一类“启动慢被放弃”的干扰。

线索 4：验证停在配置层
  - 现有测试（scripts/lcos-mcp-bridge-e2e.mjs）验证的是“server 能被 spawn 且能调通
    Bridge”，不是“真实 Codex 会话加载并暴露工具”。
```

## 3. 相关文件

```text
tools/lcos-agent/mcp-server.mjs          MCP server（58 工具，stdio 薄委托）
tools/lcos-agent/lib/client.mjs           loopback REST 客户端 + token 读取
scripts/install-lcos-codex-mcp.mjs        安装器（写 config.toml，process.execPath 是隐患）
scripts/dev-launcher.mjs                  启动栈时 ensureCodexMcp()
scripts/lcos-mcp-bridge-e2e.mjs           server 级 MCP↔Bridge E2E（保持，别删）
scripts/validate-gatef-closeout.mjs       静态校验（MCP 工具名存在性）
tools/lcos-agent/.mcp.json.example        stdio 示例（node + 相对路径，env 缺 token file）
```

## 4. 修复方向（按优先级）

### P0-1 稳定 MCP 启动命令

不要再把 `process.execPath`（临时 shell shim）写进持久配置。可选方案：

```text
a) 解析稳定 Node：优先显式稳定路径（如 C:\Program Files\nodejs\node.exe），
   找不到再退回系统 PATH 上的 node；安装时校验路径存在且能跑 --version；
b) 写一个 lcos-mcp-launcher.cmd / .ps1 固定入口，MCP command 指向 launcher，
   launcher 内部用稳定 Node 启动 mcp-server.mjs；
c) 安装后自检：用写入的 command+args 实际 spawn 一次 server 并完成 initialize，
   失败则回滚配置并报错，不静默写成功。
```

这同时也是**全新机器部署**的前置要求：LCOS 必须能在“从未装过任何类似东西”的
电脑上单命令引导完成，MCP 配置不得依赖安装时 shell 的临时路径（详见
`docs/architecture/LCOS_MCP_BRIDGE_DECOUPLING_DESIGN_20260805.md` §8）。

### P0-2 清理遗留 ai_bridge

```text
安装器应把 ai_bridge（127.0.0.1:8920/mcp）识别为 LCOS 遗留并备份后移除；
或至少在安装日志中给出 codex mcp remove ai_bridge 的明确提示；
移除后重新验证 codex mcp list 只剩必要服务。
```

### P0-3 显式超时配置

```text
安装时给 local-creative-os 设置 startup_timeout_sec（建议 30–60s）与
tool_timeout_sec（建议 60–120s），消除默认值歧义。
```

### P0-4 真实会话验收自动化

```text
新增脚本/测试：
1. 用真实 codex CLI（本机路径见 §5）exec 一个会话；
2. 提示词要求“列出你当前可用的 MCP 工具，并调用 list_lcos_projects”；
3. 断言返回中出现 local-creative-os 工具调用与真实项目数据；
4. 断言结果不是 REST fallback 的口吻；
5. 记录 stdout + 会话证据文件，写进验收报告。
```

## 5. 本机 Codex CLI 路径提示

```text
可用（实测可执行 mcp 命令）：
  C:\Users\1\AppData\Local\OpenAI\Codex\bin\68de26ad08be95cd\codex.exe
当前 bin 目录下另有多个版本：34ab3e1324cc55b5 / 3e42d49ad3e35a50 / 5b9024f90663758b
PATH 里的 codex.exe 指向 WindowsApps 包内二进制，某些 shell 会“拒绝访问”，
排查时优先用 LOCALAPPDATA 下的明确版本路径。
```

## 6. 完成前禁止

```text
禁止用“REST 等价可用”充当 MCP 完成；
禁止只验证 codex mcp get 通过就宣称 MCP 已接入；
禁止把 server 级 E2E 当作真实会话级验证；
禁止在未跑通 §1 六条之前开始 P0 对话导入施工。
```

## 7. Codex（本会话）可以提供的协助

```text
- 已收集本机 config.toml / codex mcp get / codex mcp list 实测证据（§2）；
- 可提供 mcp-server.mjs 58 工具完整清单与 server 结构说明；
- 可配合在真实 codex exec 会话里跑“工具可见性 + 只读调用”验证并回传证据；
- 可复跑 scripts/lcos-mcp-bridge-e2e.mjs 作为 server 级回归基线；
- 修完 P0-1/P0-2 后，由 Codex 先真实通过 §1 六条，再开 P0 对话导入。
```

## 8. 架构级解耦（MCP 与 Bridge 不再混在一起）

“MCP 完全完善”的范围 = **修通（§1 六条） + 规范解耦**，两者一起验收、一起关闭。

现状是**三张 MCP 面**：老 ai_bridge（8920）、Light Bridge 自己的 /mcp（43122）、
Codex 面对的 local-creative-os（stdio，58 工具角色混杂）。目标收敛为：

```text
唯一 MCP（local-creative-os，薄适配器）→ 只依赖 Local Core REST
Local Core（唯一领域边界）→ 内部走 Bridge REST
Light Bridge（执行器）→ 只 REST，删 /mcp
ai_bridge → 整体退役并从 Codex 配置移除
工具按角色命名空间分组（canvas/context/run/resource/connector/executor）
```

完整设计、迁移步骤与开源借鉴清单：

```text
docs/architecture/LCOS_MCP_BRIDGE_DECOUPLING_DESIGN_20260805.md
```

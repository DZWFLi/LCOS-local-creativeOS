# LCOS Codex 看门狗（派单模式）

## 一句话

一个常驻小脚本，每 60 秒问一次 Local Core：“这个项目的待办该谁干？”
Core 给出结论：送进现有 CLI 会话 / 拉起新会话 / 先等着。
看门狗照做——不自己拍板，只执行 Core 的判断。

## Core 怎么判断（POST /runtime/codex-dispatch-plan）

- 有注册且空闲的会话 → `dispatch_existing`（把接单提示送进那个对话）
- 会话空闲（没在思考）→ `dispatch_existing`，哪怕窗口开着
- 会话正在思考/回复 → `wait`（不打断）
- 一个会话都没注册 → `spawn_new`（用 `codex exec` 在该项目目录拉起新会话干活）

## 和 Light Bridge 怎么配合（不打架）

- Bridge 仍是唯一任务状态机（assigned/claimed/running/review/failed/… + 租约）。
- Core 的派单判断直接读 Bridge 任务状态：认领中且租约未过期 → 不派；
  租约过期 → 重新可派（防止任务卡死）；review/终态 → 不派。
- 看门狗派给现有会话前，先调 `POST /v1/tasks/{id}/direct` 把任务**定向**给该会话；
  定向之后其它会话排队认领抢不走，只有被定向的会话能认领。
- 未定向的 Codex 任务：排队认领照常可用（不搞“codex 禁止排队”的一刀切）。
- 看门狗自己从不认领，只负责“定向 + 敲门 / 拉新会话”。

## 为什么这么做

- 不关 Codex：你正常项目对话一直开着。
- 不拉子对话：看门狗不创建新的干活会话，只是把提示送进现有会话。
- 零 Agent 开销：轮询是纯脚本，不消耗任何模型回合；只有真的有任务才送一条提示。
- Buddy 做不到这点：Buddy 只有微信/飞书那一个对话能实时接单，无法把任务提示送进
  其它未激活对话；Codex CLI 的 `resume` 可以把消息送进指定会话。

## 前提

### 项目会话绑定（正式模式）

1. Runtime Host 从 Local Core 读取 `projectId + provider` 的正式 Session Binding。
2. 有有效绑定时，使用 `codex exec --json -C <项目目录> resume <会话ID> "接单提示"` 精确续接。
3. 没有绑定或绑定已经失效时，只允许新建一次会话；Codex 输出真实 Session ID 后，Core 原子保存新绑定。
4. 禁止根据“最近会话”或会话文件修改时间猜测项目归属。
5. `sessions.json` 只保留旧版兼容和诊断用途，不再是正式真相。

Launcher 会把仓库权威 Skill 包 `packages/skills/lcos-project-context/` 同步到
`$CODEX_HOME/skills/lcos-project-context`，并用 `codex mcp add/get --json` 安装或验证 LCOS MCP。
安装器只更新带 LCOS 管理标记的副本，不覆盖用户自建的同名 Skill 或无关 MCP。

## 启动

```powershell
pwsh -NoProfile -File tools\codex-orchestrator\watch.ps1
```

项目默认从 Local Core 的 `/projects` 自动发现；正式会话绑定由 Local Core 持久化。
`sessions.json` 缺失不会阻止启动，它也不会覆盖正式绑定。

环境变量（可选）：`LCOS_ORCHESTRATOR_INTERVAL`（秒）、`LCOS_ORCHESTRATOR_PROJECTS`、
`CODEX_BIN`。诊断时可设置 `LCOS_ORCHESTRATOR_ONCE=1` 只检查一轮，配合
`LCOS_ORCHESTRATOR_DRY_RUN=1` 验证派单计划而不调用 Codex。

## 限制

- 桌面 App 的对话窗口没有官方推送接口，无法被脚本“塞话”；这类窗口只能靠
  skill 在每个回合主动检查（已有）。
- 目标 Windows 环境记录的 Codex 为 `0.147.0-alpha.1.2`。
- 精确恢复使用：`codex exec --json -C <目录> resume <会话ID> "提示"`。
- 创建新会话使用：`codex exec --json -C <目录> --skip-git-repo-check "提示"`。
- Skill 与 MCP 在 Runtime Host 启动前显式安装和验证，不依赖参数猜测。

## 和 GUI 不打架的规则

- **一个会话只能有一个主人**：被派单的会话请用 CLI 开，别同时在桌面 App 里开着
  同一个会话；两边读写同一套会话文件，会互相抢。
- 判断依据是“会话在不在思考”：看门狗看会话文件最近有没有写入；
  正在写 = 忙，先等；安静 = 闲，直接派单（窗口开着也没关系）。
- 看门狗内置两道护栏：
  1. 会话文件最近 10 秒内有写入（说明 GUI/另一个进程正在用）→ 本轮跳过；
  2. 同一会话 120 秒内不重复派单（防止任务还没干完就连续塞提示）。
- 冷却和写入阈值可用 `LCOS_ORCHESTRATOR_COOLDOWN_MS` /
  `LCOS_ORCHESTRATOR_WRITE_GUARD_MS` 调整。
- 派单记录存在 `.codex-runtime/orchestrator-state.json`（已忽略，不提交）。

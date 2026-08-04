# LCOS Codex 看门狗（派单模式）

## 一句话

一个常驻小脚本，每 60 秒问一次 Local Core：“这个项目的待办该谁干？”
Core 给出结论：送进现有 CLI 会话 / 拉起新会话 / 先等着。
看门狗照做——不自己拍板，只执行 Core 的判断。

## Core 怎么判断（POST /runtime/codex-dispatch-plan）

- 有注册且未标 GUI 占用的 CLI 会话 → `dispatch_existing`（把接单提示送进那个对话）
- 只有标了 GUI 占用的会话 → `wait`（不抢话，也不重复开会话）
- 一个会话都没注册 → `spawn_new`（用 `codex exec` 在该项目目录拉起新会话干活）

## 为什么这么做

- 不关 Codex：你正常项目对话一直开着。
- 不拉子对话：看门狗不创建新的干活会话，只是把提示送进现有会话。
- 零 Agent 开销：轮询是纯脚本，不消耗任何模型回合；只有真的有任务才送一条提示。
- Buddy 做不到这点：Buddy 只有微信/飞书那一个对话能实时接单，无法把任务提示送进
  其它未激活对话；Codex CLI 的 `resume` 可以把消息送进指定会话。

## 前提

1. 你项目里的正常 Codex 对话是 **CLI 会话**（用 `codex resume` 能列出 ID）。
2. 把 项目ID → 会话ID 记进注册表：

```powershell
Copy-Item tools\codex-orchestrator\sessions.example.json tools\codex-orchestrator\sessions.json
# 编辑 sessions.json，填真实 projectId 和会话 ID（codex resume 不带参数可列出）
```

3. 那个项目对话里有 `lcos-project-context` skill（收到“接单提示”后会认领执行）。

## 启动

```powershell
pwsh -NoProfile -File tools\codex-orchestrator\watch.ps1
```

环境变量（可选）：`LCOS_ORCHESTRATOR_INTERVAL`（秒）、`LCOS_ORCHESTRATOR_PROJECTS`、
`CODEX_BIN`。

## 限制

- 桌面 App 的对话窗口没有官方推送接口，无法被脚本“塞话”；这类窗口只能靠
  skill 在每个回合主动检查（已有）。
- `codex resume <id> "提示"` 的行为依赖 CLI 版本；首次使用请先手工验证一条。

## 和 GUI 不打架的规则

- **一个会话只能有一个主人**：被派单的会话请用 CLI 开，别同时在桌面 App 里开着
  同一个会话；两边读写同一套会话文件，会互相抢。
- 注册表里给会话标 `"guiActive": true` 后，Core 会让这个项目进入 `wait`，
  既不送话也不开新会话；去掉标记后恢复派单。
- 看门狗内置两道护栏：
  1. 会话文件最近 10 秒内有写入（说明 GUI/另一个进程正在用）→ 本轮跳过；
  2. 同一会话 120 秒内不重复派单（防止任务还没干完就连续塞提示）。
- 冷却和写入阈值可用 `LCOS_ORCHESTRATOR_COOLDOWN_MS` /
  `LCOS_ORCHESTRATOR_WRITE_GUARD_MS` 调整。
- 派单记录存在 `.codex-runtime/orchestrator-state.json`（已忽略，不提交）。

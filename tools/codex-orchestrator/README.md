# LCOS Codex 看门狗（派单模式）

## 一句话

一个常驻小脚本，每 60 秒看一眼 LCOS 有没有“等人接单”的任务；有就把一句话
“接单提示”送进**你本来就在用的那个项目对话窗口**（CLI 会话），由它自己认领干活。

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

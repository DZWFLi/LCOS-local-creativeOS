# LCOS Agent Tools

本目录提供 Local Creative OS 自己的两个 Agent 入口：

```text
lcos CLI       人工调试与本地 Agent pull
lcos-mcp       stdio Project MCP
```

两者只访问 loopback Local Core / Light Bridge API，不直接读取 SQLite，也不允许
Agent 绕过 Artifact Return 和 Accept 生命周期。

## 启动

```powershell
# 终端 1：Light Bridge
$env:LCOS_LIGHT_BRIDGE_PYTHON = "C:\path\to\python.exe"
$env:LCOS_BRIDGE_RUNTIME_ROOT = "$env:USERPROFILE\.lcos-bridge-runtime"
npm run bridge -- serve --host 127.0.0.1 --port 43122

# 终端 2：LCOS Web + Local Core
npm run dev:open
```

## CLI

```powershell
npm run lcos -- project list
npm run lcos -- context get disposable-mvp-sample
npm run lcos -- open disposable-mvp-sample

npm run lcos -- task claim --provider workbuddy --worker buddy-local
npm run lcos -- task start <task-id> --worker buddy-local
npm run lcos -- task submit <task-id> <result-envelope.json>
```

`open` 返回：

```text
http://127.0.0.1:5173/?agent=1&project=<project-id>
```

此页面继续使用 LCOS 原 Canvas；右上 Agent Context Surface 展示和 MCP 相同的
Workspace、选择与 Context 版本，不创建第二张 tldraw/React Flow Project Truth。

## MCP

将 [`.mcp.json.example`](./.mcp.json.example) 合并到本地 Agent 的 MCP 配置，
并确保启动目录是仓库根目录。MCP 提供：

- Project 列表与 Graph；
- Active Context；
- 不可变 ContextManifest；
- Run / Pending Return 查询与同步；
- Agent Browser URL；
- **Light Bridge task lifecycle**：claim / start / get / submit / cancel（全部为薄委托 loopback REST，不复制状态机）

对应 Skill：

```text
packages/skills/lcos-project-context/SKILL.md
```

## 飞书链接

前端“添加链接”会把飞书 URL 保存为 `.link.md` Artifact，记录 URL、标题、资源类型、
用途和用户摘要。它被选入 Context 后才冻结进 Manifest。LCOS 不会在没有授权工具的
情况下抓取私有正文，也不会把“存在链接”伪装成“已阅读文档”。

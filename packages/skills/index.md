# LCOS Skill 索引

| Skill | 角色 | SKILL.md 约 token | 触发 | 状态 |
|---|---|---|---|---|
| lcos-project-context | agent | ~0.7K | 普通 Agent 会话的 LCOS 项目/画布/上下文工作 | 已托管（仓库同步） |
| lcos-project-curator | agent | ~1.3K | 整理/沉淀/记录进 LCOS | 已托管（仓库同步） |
| lcos-executor-run | executor | ~0.6K | 消息以 `LCOS 接单提示` 开头 | 已托管（仓库同步） |
| local-creative-os-backend-flow | dev-backend | ~1.8K | 后端开发/验收 | 未托管（~/.codex，待迁移） |
| local-creative-os-frontend-loop | dev-frontend | ~3.5K | 前端开发 | 未托管（~/.codex，待迁移） |
| workbuddy-orchestrator | orchestrator | ~6.6K | 派 WorkBuddy 时 | 未托管（~/.codex，待迁移） |

读取顺序约定：

- 执行器会话：`lcos-executor-run`（不读 lcos-project-context）；
- 普通 Agent 会话：`lcos-project-context` 入口 → 按目录按需读 references；
- 整理/沉淀请求：`lcos-project-curator` 入口 → source-reading → curation-principles → cli-recipes；
- 开发/验收：backend-flow 或 frontend-loop；
- 派 WorkBuddy：workbuddy-orchestrator（仅此时加载）。

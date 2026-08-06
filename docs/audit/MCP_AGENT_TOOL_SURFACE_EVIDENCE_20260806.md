# MCP Agent 工具面瘦身证据包（2026-08-06）

用途：给开发审“MCP Agent 45 个工具能不能砍”的原始证据。本文件只列事实与
分类，不包含任何代码改动。

## 结论摘要

1. 当前 Agent 面实际暴露 **45 个工具**（`ACTIVE_AGENT_TOOL_NAMES` 白名单过滤
   后的结果，`capabilities.json` 与 MCP E2E 均确认）。
2. 同一文件里还躺着 **20 个“注册了但永远不可见”的死工具**（不在白名单内），
   纯死代码，建议无条件删除，不影响任何表面。
3. 45 个活跃工具中，**15 个有完整 CLI 等价命令且会话内低频/纯运维/大 payload**，
   建议砍掉（45 → 30）。
4. Skill 全部文件实际引用的 Agent 工具只有 **11 个**；砍 15 个候选不触碰
   Skill 任何一行。

## 判据（建议开发按此评审）

```text
保留：会话内闭环必需（绑定/读上下文/提案/发 Run/等输入/读参考/Obsidian/对话检索）
砍掉：CLI 完整等价 + 会话内低频（列表/大图/运维动作/索引构建）
待定：Review 交互类（UI 卡片已有，但用户可能让 Agent 代确认）
```

## 一、活跃 45 工具全表

域：project / canvas / context / run / resource / conversation。
CLI 等价：`lcos ...` 命令。SKILL 引用：是否出现在 packages/skills/lcos-project-context 内。

| 工具 | 域 | 调用的 Core 端点 | CLI 等价 | SKILL 引用 | 建议 |
|---|---|---|---|---|---|
| bind_lcos_project | project | /projects/:id/graph + active-context | 无（会话绑定） | 是 | 保留 |
| list_lcos_projects | project | /projects | lcos project list | 否 | 砍 |
| get_lcos_project | project | /projects/:id/graph（全量图） | lcos project show | 否 | 砍 |
| open_lcos_preview | project | graph + preview-records + previews + content | 无 | 否 | 待定 |
| get_lcos_active_context | canvas | /projects/:id/active-context | lcos context get | 是 | 保留 |
| watch_lcos_active_context | canvas | active-context?afterVersion= | lcos context watch | 是 | 保留 |
| select_lcos_views | canvas | active-context PUT | lcos context select | 否 | 保留 |
| focus_lcos_views | canvas | active-context PUT | lcos context focus | 否 | 保留 |
| move_lcos_view | canvas | /projects/:id/graph POST | lcos canvas move | 否 | 砍 |
| create_lcos_relation | canvas | graph POST + relations | 无 | 否 | 砍 |
| propose_lcos_context_change | context | context-proposals POST | lcos context propose | 是 | 保留 |
| accept_lcos_context_proposal | context | context-proposals/:id/accept | lcos context accept | 否 | 保留 |
| reject_lcos_context_proposal | context | context-proposals/:id/reject | lcos context reject | 否 | 保留 |
| list_lcos_context_proposals | context | context-proposals | lcos context proposals | 否 | 保留 |
| apply_lcos_context_command | context | active-context PUT（复合） | 无 | 是 | 保留 |
| create_lcos_run | run | /projects/:id/runs | lcos run create | 是 | 保留 |
| validate_lcos_agent_plan | run | /runs/validate-plan | lcos run validate-plan | 是 | 保留 |
| dispatch_lcos_run | run | /runs/:id/dispatch | lcos run dispatch | 是 | 保留 |
| cancel_lcos_run | run | /runs/:id/cancel | lcos run cancel | 否 | 砍 |
| get_lcos_run | run | /runs/:id/review | lcos run show | 否 | 待定 |
| list_lcos_runs | run | /projects/:id/runs?limit= | lcos run list | 否 | 砍 |
| get_lcos_run_input_request | run | /runs/:id/input-request | lcos run input | 是 | 保留 |
| answer_lcos_run_input | run | /runs/:id/input-request POST | lcos run answer | 否 | 保留 |
| sync_lcos_run | run | /runs/:id/sync | lcos run sync | 否 | 砍 |
| recover_lcos_run | run | /runs/:id/recover | lcos run recover | 否 | 砍 |
| finalize_lcos_run | run | /runs/:id/finalize | lcos run finalize | 否 | 砍 |
| accept_lcos_return | run | /artifact-returns/:id/accept | lcos run accept | 否 | 待定 |
| reject_lcos_return | run | /artifact-returns/:id/reject | lcos run reject | 否 | 待定 |
| retry_lcos_return | run | /artifact-returns/:id/retry | lcos run retry | 否 | 待定 |
| lcos_resource_read | resource | /resources/:id/content | lcos resource read | 否 | 保留 |
| lcos_resource_match | resource | /resources/match | lcos resource match | 否 | 保留 |
| list_lcos_connectors | resource | /connectors | lcos connector list | 否 | 砍 |
| scan_lcos_obsidian_vault | resource | 原生目录选择 + scan | lcos connector obsidian-scan | 是 | 保留 |
| import_lcos_obsidian_notes | resource | /connectors/obsidian/import | lcos connector obsidian-import | 是 | 保留 |
| import_lcos_conversation | conversation | 分片导入会话 | lcos conversation import | 否 | 保留 |
| list_lcos_conversations | conversation | /conversations | lcos conversation list | 否 | 砍 |
| get_lcos_conversation | conversation | /conversations/:id | lcos conversation show | 否 | 保留 |
| search_lcos_conversations | conversation | /conversations/search | lcos conversation search | 否 | 保留 |
| read_lcos_conversation_messages | conversation | /conversations/:id/messages | lcos conversation messages | 否 | 保留 |
| list_lcos_conversation_sections | conversation | /conversations/:id/sections | lcos conversation sections | 否 | 砍 |
| read_lcos_conversation_section | conversation | /sections/:id/source | lcos conversation section-source | 否 | 砍 |
| annotate_lcos_conversation_section | conversation | /sections/:id/annotation | lcos conversation annotate | 否 | 保留 |
| pin_lcos_conversation_message | conversation | /messages/:id/pin | lcos conversation pin | 否 | 保留 |
| get_lcos_conversation_semantic_index | conversation | /conversations/semantic-index | lcos conversation index-status | 否 | 砍 |
| build_lcos_conversation_semantic_index | conversation | /conversations/semantic-index POST | lcos conversation index-build | 否 | 砍 |

统计：保留 25 · 建议砍 15 · 待定 5。

## 二、20 个死注册（白名单外，从未暴露）

```text
open_lcos
set_lcos_viewport
get_lcos_canvas_observation
list_lcos_pending_runs
list_lcos_workspace_members
add_lcos_workspace_members
remove_lcos_workspace_member
move_lcos_workspace_member
propose_lcos_run
get_lcos_provider_session
set_lcos_provider_session
clear_lcos_provider_session
list_lcos_runtime_providers
build_lcos_context_manifest
export_lcos_conversation
import_lcos_manual_conversation
refresh_lcos_conversation_sections
rename_lcos_conversation_section
lcos_resource_list
lcos_resource_describe
```

删除它们：mcp-server.mjs 的注册 + switch case 一并清掉，行为零变化。

## 三、Skill 实际引用（砍 15 个不碰 Skill）

packages/skills/lcos-project-context 全部文件出现的工具名：

```text
bind_lcos_project / get_lcos_active_context / watch_lcos_active_context
create_lcos_run / validate_lcos_agent_plan / dispatch_lcos_run
propose_lcos_context_change / apply_lcos_context_command
scan_lcos_obsidian_vault / import_lcos_obsidian_notes
get_lcos_run_input_request / request_lcos_user_input（executor 面）
```

建议砍的 15 个工具没有一个被 Skill 引用。

## 四、砍掉后的改动面

```text
tools/lcos-agent/mcp-server.mjs   删除 15 个注册 + case 分支 + 白名单项
tools/lcos-runtime/capabilities.json  toolCount 45 → 30
scripts/lcos-mcp-bridge-e2e.mjs   冒烟改用 get_lcos_active_context 代替 list_lcos_projects
tools/lcos-agent/README.md        同步工具清单
测试                           mcp-role-separation / phase3-boundaries /
                                runtime-host-entrypoints 当前未 pin 具体数量，跑一遍确认
```

## 五、风险与补偿

- 砍掉 list/get project：Agent 绑定项目用 bind_lcos_project（已返回项目摘要），
  全量图用 `lcos project show`。
- 砍掉 run 运维（cancel/sync/recover/finalize/list）：CLI 全覆盖；
  cancel 应急场景可保留（若开发认为 Agent 会话内需要“停任务”）。
- 砍掉 conversation 列表/章节只读：会话内主入口是 search + read messages，
  批处理走 CLI。
- 砍掉语义索引 build/status：等 Ollama 就绪后走 CLI。
- 收益（估算）：工具 schema 从 45 → 30，每轮 Agent 上下文约省 1/4–1/3
  工具定义 token；实际数值可砍完后用一次真实会话对比。

## 六、建议的最终动作

1. 无条件删 20 个死注册（零风险）。
2. 砍 15 个活跃重复工具（45 → 30），其中 cancel_lcos_run 是否保留由开发定。
3. 5 个待定工具保留一版观察，下次收口再评估。

## 七、开发评审后执行记录（2026-08-06）

开发返回 `LCOS_MCP_AGENT_TOOL_SURFACE_REVIEW_20260806.md`，结论：
“通过瘦身方向，不通过 45→30 原表直接落地”。按评审“第一批可立即做”
已执行：

```text
✅ 删除 20 个白名单外死注册（注册 + switch case 全清）
✅ 删除 9 个内部/运维/大 payload 活跃工具：
   get_lcos_project（全量图）/ move_lcos_view / list_lcos_runs /
   sync_lcos_run / recover_lcos_run / finalize_lcos_run /
   list_lcos_connectors / semantic index status+build
✅ 新增紧凑 get_lcos_project_summary（摘要 + workspaces/views 清单，无全量图）
✅ 按评审保留 cancel_lcos_run 与紧凑 get_lcos_run
✅ Agent 面 45 → 37；capabilities.json / 政策文档 / E2E / 校验脚本同步
✅ MCP E2E（37/8 全链）、架构测试 70/70、gatef-plus / closeout /
   capabilities 校验全绿
```

未执行（评审第二/三批，合同级改动，待另行安排）：
resolve/bind 合并、Conversation section 读取链合并、Preview 有界契约、
Resource 公共 Handle 切 ArtifactId、Review 人类授权、ActiveContext
session-scoped、watch 下沉 Host、Ingestion Profile。

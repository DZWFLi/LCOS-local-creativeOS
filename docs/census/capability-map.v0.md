# LCOS Capability Map v0（机器生成）

> 由 `npm run census` 从源码生成；禁止手工编辑（`npm run check:census` 校验重生成一致性）。
> 生成时间不写入文件以保证确定性；本表即 Capability Registry v0 数据源（S 系列施工计划 S0 交付物）。

## 总览

| 域 | 能力数 | 源 |
|---|---|---|
| HTTP Routes | 210 | apps/local-core/src/routes/*.ts + server.ts |
| CLI 命令 | 129 | tools/lcos-agent/cli.mjs + commands/*.mjs |
| MCP 工具 | 47（agent 39 / executor 9） | tools/lcos-agent/mcp-server.mjs + executor-tools.mjs |
| Skills | 17 | packages/skills/*/SKILL.md |

## Routes（按 method）

| method | 数量 |
|---|---|
| GET | 93 |
| POST | 101 |
| PUT | 9 |
| PATCH | 1 |
| DELETE | 6 |

mutationClass 分布：read=93、mutation=105、mutation-proposal=6、delete=6

## MCP 工具 × 域 × 角色

| 域 | 工具数 |
|---|---|
| context | 5 |
| run | 11 |
| conversation | 9 |
| project | 4 |
| executor | 7 |
| canvas | 5 |
| resource | 6 |

工具注册调用：mcp-server.mjs 39 个、executor-tools.mjs 9 个。

漂移发现：domainOf 声明了 provider 域但无任何注册工具落入（该域能力只剩 CLI/路由入口）。

## CLI 命令（按组）

| 组 | 命令数 |
|---|---|
| affinity | 1 |
| artifact | 1 |
| canvas | 3 |
| capabilities | 1 |
| capture | 3 |
| connector | 3 |
| context | 15 |
| continuity | 5 |
| conversation | 14 |
| curation | 1 |
| doctor | 1 |
| local-ai | 3 |
| manifest | 1 |
| node | 3 |
| open | 1 |
| presentation | 2 |
| preview | 1 |
| process | 1 |
| project | 13 |
| provider-session | 3 |
| providers | 1 |
| relation | 1 |
| resource | 6 |
| retrieval | 1 |
| revision | 2 |
| run | 18 |
| runtime | 1 |
| search | 1 |
| selection | 2 |
| session | 6 |
| skill | 5 |
| target | 2 |
| task | 1 |
| workspace | 6 |

## Runtime 状态分类

- runs 状态：created / queued / running / waiting_input / completed / failed / cancelled
- Session 七态：dormant / connecting / online / busy / waiting_input / disconnected / stale
- provider 可用性：ready / busy / offline / manual

### 控制操作支持矩阵（源码裁定）

| 操作 | 支持 | 锚点 |
|---|---|---|
| pause | NO | （无源码锚点） |
| resume | NO | （无源码锚点） |
| cancel | YES | POST /runs/:id/cancel; cancel_lcos_run |
| retry | YES | retry_lcos_return |
| answer_input | YES | GET /runs/:id/input-request; POST /runs/:id/input-request; answer_lcos_run_input; request_lcos_user_input |

## Search / 索引覆盖

- 实体类型：artifact / note / conversation / resource / file
- 分析器：fallback、json、link、markdown、skill-package、text、yaml
- FTS5 表：search_documents_fts、conversation_messages_fts
- 向量存储：3 处 vec0 声明
- embedding 默认模型：nomic-embed-text（单一本地 provider——S9 缺口）
- OCR：存在（apps/local-core/src/routes/runtime.ts、apps/local-core/src/server.ts）

## Skills

| 包 | 版本 | role | requiredCapabilities |
|---|---|---|---|
| lcos-active-path | — | — | （未声明） |
| lcos-browser-bridge | — | — | （未声明） |
| lcos-context-pack | — | — | （未声明） |
| lcos-evolution | — | — | （未声明） |
| lcos-executor-run | 1.0.0 | executor | （未声明） |
| lcos-glaze-materials | — | — | （未声明） |
| lcos-project-context | 1.2.0 | agent | （未声明） |
| lcos-project-curator | 2.1.0 | agent | （未声明） |
| lcos-relationship-field | — | — | （未声明） |
| lcos-review-workflow | — | — | （未声明） |
| lcos-skill-author | 1.1.0 | agent | （未声明） |
| lcos-structure-map | — | — | （未声明） |
| lcos-workflow-step | — | — | （未声明） |
| lcos-workspace-steward | 0.1.0 | agent | （未声明） |
| local-creative-os-backend-flow | 2.0.0 | dev-backend | （未声明） |
| local-creative-os-frontend-loop | 2.0.0 | dev-frontend | （未声明） |
| workbuddy-orchestrator | 2.0.0 | orchestrator | （未声明） |

声明 requiredCapabilities 的 Skill：0/17（S8 缺口如实登记）。

## Desktop

- BrowserWindow 创建点：createSplashWindow、createMainWindow、createCaptureWindow
- Tray：有
- ipcMain.handle 通道：12 个；preload invoke 通道：12 个
- Runtime Supervisor：存在
- Companion Runtime Projection 契约：无（S4 缺口）

## 纪律

- 本文件与 capability-map.v0.json 全部由 `scripts/census-capability-map.mjs` 生成，手工编辑会被 check:census 拒绝。
- 生成器内禁止硬编码能力清单：gate 逐条校验每个能力项都能在其声明的源文件中找到锚点。
- 数字与源码一致是 S0 验收线；后续 S 系列任务以本 registry 为唯一能力事实源。

## S0 裁定记录：CLI / MCP / Bridge 施工落点（20260830）

| 面 | 落点 | 仓 |
|---|---|---|
| CLI | tools/lcos-agent/cli.mjs + commands/*.mjs | 本仓 |
| Agent MCP | tools/lcos-agent/mcp-server.mjs + executor-tools.mjs + mcp-executor-server.mjs + lib/mcp-stdio-runtime.mjs | 本仓 |
| Browser Bridge MCP | tools/lcos-browser-bridge（Python mcp_server.py） | 本仓 |
| Bridge 执行面 | scripts/light-bridge.mjs（Node 入口）+ tools/light-bridge-kernel（Python kernel） | 本仓 |
| Runtime 服务注册 | tools/lcos-runtime/capabilities.json（独立 gate：check-capability-registry.mjs） | 本仓 |

裁定：CLI / MCP / Bridge 施工落点全部在本仓；父目录历史仓只作考古参照，不回写。

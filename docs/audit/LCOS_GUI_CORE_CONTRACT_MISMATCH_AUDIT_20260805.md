# LCOS GUI ↔ Core 合同错位审计（2026-08-05）

> 起因：B7 探针发现 Composer 发 Run 一直 400——GUI 发 `requestedProvider: "auto"`，
> Core 只认 `workbuddy|codex`。这是“快速搓 MVP”时期 GUI 与 Core 各写各的合同留下的债。
> 本轮把 GUI 会调的全部 Core 端点做了一遍双向对照。

## 1. 审计方法

```text
方向 A：拉取 Core 侧全部枚举白名单（server.ts / runtime-application-service /
        runtime-proposal-service / conversation-import-service）
方向 B：拉取 Web 侧实际发送值（App.tsx / SelectionComposer / WorkRail /
        ConversationContextDialog / ProjectToolsDialog / localCoreClient）
逐端点核对：字段名、必填、枚举值、Object.keys 白名单
```

## 2. 发现并已修复的问题

| 端点 | GUI 发送 | Core 白名单 | 结果 |
|---|---|---|---|
| POST /projects/:id/runs | `requestedProvider: "auto"`（Composer/WorkRail 默认值） | 原来只有 `workbuddy|codex` | ❌ 400 → ✅ 已修：Core 接受 `auto` 并解析为就绪的自动执行器（优先 codex），提交 `3b0b02f` |

修复后 B7 探针实测：选中 → 聚焦输入 → Ctrl+Enter，3 步，Run 真实创建并成功取消。

## 3. 全量对照结果（未发现其它错位）

| 端点 | 关键字段 | GUI 值 | Core 白名单/校验 | 判定 |
|---|---|---|---|---|
| POST /projects/:id/runs | outputIntent / resultPolicy | create|revise|analyze；revise→draft_revision_per_target，analyze→reply_only，create→create_artifact | 与服务层按 intent 的 resultPolicy 白名单一致 | ✅ |
| POST /runs/:id/input-request (answer) | requestId/text/selectedOptions | 与 CLI 相同 | 白名单一致；选项需在 question.options 内 | ✅ |
| POST /runs/:id/finalize | decision | GUI 不走此端点（用 accept/reject/retry） | completed|retrying | ✅ |
| PUT /projects/:id/active-context | updatedBy | web 端可省略（默认） | 可选：web\|codex\|core | ✅ |
| POST /projects/:id/context-proposals | workspaceId/baseContextVersion/addViewIds/removeViewIds/targetViewId/reason | 与白名单一致 | ✅ |
| POST /workspaces/:id/members | viewIds/addedBy | user|agent|run|import | 与白名单一致 | ✅ |
| POST /workspaces/:id/members/move | toWorkspaceId/viewId | 一致 | ✅ |
| PUT /projects/:id/provider-sessions/:provider | externalSessionId/origin/status | origin manual|watchdog；status active|stale|closed（UI 只读+clear，不写） | 一致 | ✅ |
| POST /projects/:id/connectors/obsidian/import | scanId/relativePaths/scopeId/position | 与白名单一致；1–200 条 | ✅ |
| POST /projects/:id/conversation-import-sessions | sourceKind/title/sourceFileName/expectedBytes/workspaceId/scopeId | sourceKind codex|manual（UI 只发 codex） | ✅ |
| POST /projects/:id/conversations/import-manual | title/scopeId/workspaceId/entries | role user\|assistant\|tool\|system 与解析器一致 | ✅ |
| PATCH 章节 | title/lockedByUser | 一致 | ✅ |
| POST 章节标注 | sourceHash/title/decisions/todos/involvedFiles/annotatedBy | UI 只发 agent\|user；服务层用户标注保护 | ✅ |
| POST 钉选消息 | title/summary/scopeId/workspaceId/x/y | 一致 | ✅ |
| POST 语义索引 | model/sessionId/force/batchSize | 一致（Ollama 关闭时 FTS5 保底） | ✅ |
| POST /projects/:id/runs/validate-plan | intent/requestedProvider/contextItems/editTargets/resultPolicy/humanSummary/risks/requiresConfirmation | requestedProvider 只要求 string，`auto` 可过 | ✅ |
| POST /projects/:id/runs/propose | 同上 + createAsNewNode/decisionSource | requestedProvider 只要求 string | ✅ |
| POST /projects/:id/text-artifacts | title/body/scopeId/workspaceId/x/y | 一致 | ✅ |
| POST /lcosproj/open | filePath/rootPath | 一致 | ✅ |
| POST /lcosproj/export-all | targetDir/projectIds | 一致 | ✅ |
| PUT /projects/:id/command-drafts/:id | workspaceId/prompt/contextViewIds/provider/createAsNewNode | provider 无枚举限制 | ✅ |

## 4. 备注（非错位，但值得知道）

```text
1. ComposerResultPolicy 类型里有 create_collection，但 UI 目前不发；Core 支持，属预留。
2. provider-session 的“绑定”UI 只读+清除，不做写；写路径由看门狗/CLI 负责。
3. validate-plan / propose 对 requestedProvider 只做 string 校验，未限制枚举——
   语义上“auto”在这里是 UI 计划标记，服务层不解析，属于已知宽松点。
4. 本次没有把“web→core 合同”做成自动化回归测试；建议开发补一个 contract 层测试，
   把每个端点的枚举/字段清单固化，防止再出现“GUI 能发、Core 不认”。
```

## 5. 附带补测：B6 长 Prompt + 重启恢复（通过）

```text
长 Prompt（2790 字 analyze）：run-413afc95-6639-4625-ac35-6d2546ab9635
  queued → running → completed（结果摘要 1647 字）
强杀 Core（PID 30120）→ launcher 自动重启 → health ok
重启后：Run 仍 completed；provider-session 绑定 019fd215 仍 active，
  lastRunId=run-413afc95 —— 长 Prompt 端到端 + 重启恢复 ✅
```

## 6. 附带补测：B7 选中→发送 ≤3 步（通过，含修复验证）

```text
修复前：POST /runs 400（requestedProvider=auto 被拒），Composer 发不出去
修复后：3 步（单击节点 → 聚焦输入 → Ctrl+Enter），Run 真实创建（run-c0ab2de6）并取消成功
```

# MVP Runtime Slice B.5 Buddy Contract Review

日期：2026-07-29
分支：`codex/mvp-fast-build`
基线：`dfab076 feat(bridge): add idempotent runtime contract`

## 1. Decision

Slice B.5 one-shot Contract Gate 通过。

真实链路已经成立：

```text
LCOS RuntimeInputPack
→ Bridge task assigned
→ watcher 路由项目 inbox
→ WorkBuddy Bridge 助理唤醒
→ start_task
→ 读取只读输入
→ 创建唯一 Staging Markdown
→ 创建 ResultEnvelopeV0
→ submit_result
→ Bridge review
```

这只证明 WorkBuddy 能消费冻结合同并返回结构化结果，不代表 Local Core Adapter、
Watcher 产品化、后台 Harness 或 Artifact Return 已接通。

## 2. 真实执行身份

```text
project_id: mvp-fast-build
session_id: session_ee2ab2d6
task_id: task_fe871d5d
lcos_run_id: run-b5-one-shot-001
assignee: workbuddy
report_mode: short
```

Bridge 状态证据：

```text
assigned_at: 2026-07-29T07:14:22.447614+00:00
started_at:  2026-07-29T07:56:20.545577+00:00
reviewed_at: 2026-07-29T07:57:34.834710+00:00
final status: review
```

## 3. Feishu / WorkBuddy 唤醒证据

专用发送边界：

```text
profile: workbuddy-bridge-assistant
assistant: WorkBuddy Bridge 助理
assistant app: cli_aadee78554785cd8
p2p chat: oc_e4392f46f1408083fd431e2cd54eca6b
send identity: user
```

首次唤醒消息：

```text
om_x100b69aeb06f90b4dd361e16f61ab6a
```

首次执行被 WorkBuddy 正确拦截：智能体长期会话工作目录是
`E:\Buddy项目\Claw`，与 `mvp-fast-build` 不一致，因此没有调用 `start_task`。

在 Dz 已明确批准 Slice B.5、目标 worktree 和输出边界后，发送一次定向授权续单：

```text
om_x100b69af54be10a0c3f8e6ba29a30fa
```

续单只授权已映射的 `mvp-fast-build` worktree 和 Task 声明输出。WorkBuddy 随后
调用 `start_task` 并完成回传。

## 4. 输入与输出验证

只读源文件：

```text
.workbuddy/slice-b5/inputs/script-current.md
```

执行前后 SHA-256 均为：

```text
40f2d3351b13bf7dd59bfca7cf636400ea4b497e49b7e25371617a11dbdc6f7f
```

唯一业务输出：

```text
.workbuddy/slice-b5/staging/script-draft-run-b5-one-shot-001.md
```

结构化结果：

```text
.workbuddy/slice-b5/result/result-envelope-v0.json
```

验证通过：

- 源文件未修改；
- Draft 包含 `PortaSplit`；
- Draft 保留 `Move with less friction.`；
- 没有写入仓库产品代码或其他用户文件；
- ResultEnvelope `contractVersion=bridge-result-v0`；
- `taskId=task_fe871d5d`；
- `lcosRunId=run-b5-one-shot-001`；
- `providerStatus=review`；
- `changedFiles` 只有一个 `created` Staging Markdown；
- Bridge `changed_files` 与 ResultEnvelope 一致；
- ResultEnvelope 作为 Bridge Artifact 返回。

`.workbuddy` 是可丢弃执行证据目录，不进入 Git。

## 5. 发现的问题

### 5.1 Watcher inbox 中文路径编码

Watcher 写入 `.workbuddy/active_task.json` 时，部分中文绝对路径曾出现 mojibake。
Live Bridge 的 Task 数据保持正确 Unicode。

本次 WorkBuddy 没有信任乱码路径，而是通过 `project_id` 找到真实 worktree，并核验
Bridge 状态后执行。该问题登记为 Watcher 边界缺陷，不在本 Slice 修复。

### 5.2 飞书智能体投递边界

`WorkBuddy Bridge 助理` 是独立 Feishu App 智能体，不是通讯录联系人。使用无关
`lark-cli` App 的 bot `open_id` 会返回：

```text
99992361 open_id cross app
```

已建立专用 CLI profile，并更新 `workbuddy-orchestrator` Skill：以后必须使用同一
智能体 App 的用户身份和已验证 P2P chat，禁止联系人搜索、跨 App Open ID 和 Bot
自发消息。

### 5.3 全局智能体会话不是项目会话

飞书智能体当前复用 `E:\Buddy项目\Claw` 长期会话。默认跨项目拦截是正确行为。
正式产品化前需要明确：

- 每项目 WorkBuddy Conversation；或
- 由经过验证的 Dispatch Adapter 提供严格目标工作区；或
- 显式、最小、可审计的跨项目授权。

不能把全局飞书会话默认当作任意项目执行器。

## 6. 未进入的范围

- Local Core BridgeAdapter；
- RuntimeDispatch / RuntimeBinding HTTP 接线；
- 状态轮询与恢复；
- Result Ingestion；
- ArtifactReturn；
- Draft Revision；
- Accept / Reject / Retry；
- Watcher 产品实现；
- Route C / Companion；
- 前端 UI。

## 7. 测试与证据

本 Slice 是一次真实合同 Spike，没有修改 TypeScript 产品代码，因此未重复运行完整
`check:fast`。验证包括：

```text
Skill quick_validate                       PASS
Feishu user → assistant delivery           PASS
WorkBuddy inbound                          PASS
Bridge assigned → running → review         PASS
source SHA-256 unchanged                   PASS
expected output exists                     PASS
ResultEnvelopeV0 contract                  PASS
unexpected slice-b5 files                  NONE
git diff --check                           PASS
```

## 8. 回滚

- 删除可丢弃 `.workbuddy/slice-b5/` 即可移除 Spike 文件；
- Revert 本 Review / README Commit 可移除项目记录；
- `workbuddy-orchestrator` 是用户级 Skill，若需回滚可移除本次 Feishu 智能体
  addressing 规则；
- 没有 Schema、Project Truth、Revision 或用户源文件需要回滚。

## 9. 下一批准点

停止在 Slice B.5。

下一步必须另行批准：

```text
Slice C：Local Core Adapter
```

Slice C 才能开始：

- 物化不可变 RuntimeInputPack；
- 创建 RuntimeDispatch；
- 调用 Bridge idempotent create；
- 持久化 RuntimeBinding；
- 轮询并恢复 Provider 状态。

不得从本次 Spike 直接跳到 Result Ingestion 或 Accept 生命周期。

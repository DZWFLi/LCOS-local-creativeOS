# Slice F Handoff：完整 Golden Path + Checkpoint 真实化 + 发布纠偏

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commits：`e77ec2a`（Checkpoint 真实化 + golden 脚本）、本次 Handoff/账本/README

## Decision

Slice F 完成可自动化验证的部分：

1. **真实 Golden Path 全链**（`scripts/full-golden-path.mjs`，`npm run test:golden:full`）：自托管真实 Core + 真实 Light Bridge + 临时真实项目（两个真实 Markdown 文件）+ 脚本 Agent（claim→start→写真实文件→submit），覆盖 revise / analyze / create 三种 Intent、Review、Accept、Checkpoint、Core 重启恢复。
2. **Checkpoint 真实化（UI-07）**：Web 按钮不再只弹 toast，改为取当前 Project Truth Graph → POST `/projects/:id/checkpoints` 持久化；重启后存在。
3. **发布纠偏**：CLI/MCP README 同步新命令与工具；Skill 与 Capability Ledger 更新为实测状态；README 无夸大表述（原「完整纵向 MVP 已完成」为条件性警示，未改动）。

## Exact files

- `scripts/full-golden-path.mjs`（新增）：完整 Golden Path E2E（fetch 带超时、进度日志、成功/失败均清理子进程）
- `package.json`：新增 `test:golden:full`
- `apps/web/src/App.tsx`：Checkpoint 按钮调 Core API（projectGraph → createCheckpoint），真实成功/失败提示
- `apps/web/src/runtime/localCoreClient.ts`：新增 `createCheckpoint` 方法（接口 + 实现）
- `apps/web/tests/runtimeBridge.test.ts`：stub client 补 createCheckpoint
- `tests/architecture/july-plan-gap-protection.test.ts`：GAP-UI-07 改为正向锁定（App 必须调 createCheckpoint，禁止假 toast 回潮）
- `tools/lcos-agent/README.md`：doctor/capabilities/current/inspect、Intent 必填、dry-run、MCP 写工具列表
- `docs/audit/LCOS_CAPABILITY_LEDGER.md`：UI-07 ✅、RT-10 ✅、QA-01 🟡（Runtime 链实测、GUI 全链待手工）

## Schema

无迁移。

## Golden Path 实测结果（2026-08-03 实跑）

```text
✓ Bridge 43132 / ✓ Core 43131
✓ Project golden-path-probe（临时真实目录，brief.md + script.md）
✓ revise：真实 modified 文件 → review → accept → current revision=revision-return-…
✓ analyze：零 changed files → run completed，无 Return
✓ create：2 个真实新文件（shot-list.md / storyboard.json）→ 2 Returns → 1 accepted
✓ checkpoint-golden-1 持久化
✓ Core 被杀 → 重启：run completed、checkpoint、accepted Current 指针全部完整
```

完整日志：本次执行输出（`✓` 逐行证据）已存档于会话记录；脚本可随时复跑复现。

## Security impact

- Checkpoint snapshot 取 Core 返回的 Project Truth，前端不拼装伪快照
- golden 脚本全部服务绑定 127.0.0.1、临时目录用完即删
- 无新依赖（复用既有 PptxViewer 等）

## Failure recovery

- 任一断言失败 → 打印 `✗ FAIL`、清理子进程、退出码 1
- 脚本重复运行不污染 dev 栈（独立端口 43131/43132、独立 DB/项目目录）

## Tests actually run

- 全仓库：78 文件 / 374 测试全绿；typecheck 4/4；lint 无新增错误；web + local-core build 通过
- `node scripts/full-golden-path.mjs`：exit=0，全链 PASS（revise/analyze/create/checkpoint/restart）

## Known limitations / 未做（需决策）

- GUI 手工验收链（真实浏览器点按 Accept/Retry/Reject 按钮）仍是 QA-01 的 🟡 剩余部分
- RunEvent 持久化（RUN-10）需 Event 表 Schema 变更（红区，未做）
- `run cancel` Core 后端 + Bridge 取消链路未做（Bridge 有 cancel 端点，Core 未接）
- 托盘宿主（RT-04）ADR 已交，等批准
- WorkBuddy 真实 executor 的「零点击唤醒」E2E（RT-08）依赖外部基础设施，未在本任务内宣称完成

## Rollback

Revert `e77ec2a` 及本批文档提交；无 Schema/数据迁移。Checkpoint 回滚后按钮回到 toast（保护测试同步回退）。

## Worktree clean / STOP-GO

- 本 Handoff 提交后工作区干净
- **GO → 合并决策**：全部六个 Slice（A–F）已完成本任务可施工范围；红区/外部依赖项列于上表，建议连同本 Handoff 一并回传 WorkBuddy 与 GPT 复核

---

_Codex 2026-08-03，全部结论基于本次实测。_

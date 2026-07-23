# Known Risks and Open Decisions

## 1. 当前最大风险

最大风险不是 `apps/local-core` 缺失本身，而是三套来源尚未收敛：

```text
Git HEAD
≠ 当前未跟踪主仓 Web/Domain/Contracts
≠ v0.6.0 候选包
```

在此基础上编码会导致 Adapter 对错前端模型、根测试混收候选目录、多人文件 owner 冲突，并且无法可靠回滚。

## 2. 高风险清单

| 风险 | 影响 | 当前处置 |
|---|---|---|
| 脏工作区作为多人基线 | 覆盖/混淆用户改动 | 禁止后端直接编码 |
| Candidate 未入 Git | 无来源、review、rollback | 先整合并基线提交 |
| 根 Vitest 收集仓内候选测试 | 虚假通过 | 基线任务修复 test include/exclude |
| 双模型 | 字段漂移、重复 Domain | Phase 0 冻结 Adapter 边界 |
| Scope 合同未稳 | 错误固化 SQL/API | 暂不进入后端 schema |
| localStorage v9 保存项目真相 | 恢复与迁移风险 | 仅视为 disposable Fixture |
| Bridge task_id 冒充 RunId | 身份与 retry/recovery 错乱 | 新 RunId + mapping |
| Bridge 无 waiting_input / replay | UI 状态不可恢复 | 后续 Runtime 合同门 |
| 无 hash/lease/containment | 静默覆盖用户文件 | 不开放真实写入 |
| Pending Return 直接 Current | 破坏人工真相 | Accept 前保持 Draft/Pending |
| 旧性能文档与冻结值冲突 | 测试口径漂移 | 以最新最多 2 条为准 |

## 3. 需用户批准项

### 建议现在确认

1. 先整合 v0.6.0 候选进主仓并建立新基线提交：**建议是**。
2. 后端从新基线创建独立干净 worktree / `codex/backend-phase-0`：**建议是**。
3. Phase 1 仅做无 SQLite 的只读 Local Core 骨架：**建议是**。
4. canonical identity 使用新 `runId` + legacy `task_id` mapping：**建议是**。
5. `waiting_input` 是一等 Runtime 状态，且只能由 OS/用户继续：**建议是**。

### 后续单独批准

6. SQLite 在 Phase 2 正式引入，还是先独立 Schema Spike；
7. Preview 先 MD + 图片，PPT/PDF 延后；
8. 第一条写能力仅用于 disposable project root；
9. Child Scope 修复并冻结前，是否完全排除后端 Scope persistence；
10. Bridge OS mode 是否强制拒绝非 loopback；
11. Codex-only 是否为首个 Runtime Spike。

## 4. Worktree 决策

当前工作区不适合继续作为后端工作区。

推荐不是“现在从旧 HEAD 建一个空 worktree”，因为旧 HEAD 不含未跟踪的 Web/Domain/Contracts；推荐是：

1. 在现有主仓由各 owner 整合并审查候选；
2. 形成新 baseline commit；
3. 从该 commit 创建独立 backend worktree；
4. 原脏目录保留作为整合现场，不复制未知改动。

## 5. 停止线

本轮到此停止，不创建 branch/worktree/commit，也不创建 `apps/local-core`。原因：用户要求先提交 Phase 0 方案并等待批准，且当前尚无可引用的新基线提交。

# LCOS Codex 自动接单稳定性修复（2026-08-04）

## 任务摘要

修复真实 Codex 自动接单链中暴露的两项问题：Light Bridge 回传合同未接受 Skill 已声明的 `contentHash`，以及 Runtime 轮询重复写入生命周期事件。

## 实际范围

- `ChangedFileV1` 接受可选 SHA-256 `contentHash`，并校验、规范化为小写。
- Runtime 生命周期事件改为仅在状态真正迁移时写入。
- 增加合同与重复轮询回归测试。
- 未清理历史重复事件，未改变 Run 状态机、Revision 语义或数据库 Schema。

## 流程变化

```text
修复前：轮询 → 看见 bound/running → 再写 run.started
修复后：轮询 → 对比前后状态 → 仅首次进入 bound 时写 run.started

修复前：Agent 回传 contentHash → Bridge extra=forbid → Agent 被迫删字段重试
修复后：Agent 回传合法 SHA-256 → Bridge 接收并保留合同字段
```

## 修改文件

- `apps/local-core/src/runtime-application-service.ts`
- `apps/local-core/tests/runtime-application-service.test.ts`
- `tools/light-bridge-kernel/src/lcos_bridge/canonical/models.py`
- `tools/light-bridge-kernel/tests/test_contracts.py`

## 验证结果

- Web：31 files / 129 tests PASS
- Local Core：46 files / 238 tests PASS
- Domain：1 file / 5 tests PASS
- Contracts：1 file / 4 tests PASS
- Light Bridge：32 tests PASS
- Architecture：7 files / 48 tests PASS
- `git diff --check`：PASS（仅 Git 的 LF/CRLF 提示）

真实 Run `run-d4115d16-f3e7-4481-9512-5c5a19695dd9` 已完成，结果已生成并落为 Revision。该 Run 发生于修复代码生效前，因此耗时和历史重复事件只作为问题证据，不作为修复后性能结论。

## 风险与未完成

- 现有数据库中的历史重复事件未自动删除，避免隐式改写用户数据。
- 当前 Codex 每 Run 拉起/发现 Session 的策略仍会带来冷启动延迟。
- 项目级 Agent Session Affinity 尚未实施；需要单独批准其 Run/Session 路由方案。

## 下一步建议

设计 `projectId + provider → preferredSessionId` 的项目级 Session Affinity。手动接取和 watchdog 拉起均可建立绑定，后续 Run 优先复用；Session 失效时再显式换新。Run 仍保持独立真相，单个项目 Session 内任务串行执行。

## 回滚

撤销上述四个代码/测试文件即可恢复原行为；本次没有 Schema 或数据迁移。

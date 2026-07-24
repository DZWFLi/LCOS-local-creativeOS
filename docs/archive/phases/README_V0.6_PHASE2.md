# Local Creative OS v0.6 Phase 2

本包基于 v0.6 Phase 1.1 P0 热修继续推进，完成“选中 → 输入 → 执行 → 确认”的前端 Fixture 闭环。

## 主要入口

```text
/?state=confirm       Phase 1.1 Canvas 锁定回归
/?state=phase2-single 单文件黄金路径起点
/?state=phase2-multi  多选 Target / Context 推断
/?state=running       运行状态
/?state=waiting       等待输入
/?state=review        结果比较
/?state=accepted      接受后的当前版本
/?state=drive         Project Drive
/?state=scope         子 Canvas Scope
```

## 新增核心文件

```text
apps/web/src/state/workRailMode.ts
apps/web/tests/workRailMode.test.ts
apps/web/tests/v06Phase2TaskLoop.test.ts
docs/handoffs/V0.6_PHASE2_INTUITIVE_TASK_LOOP.md
CODEX_RUN_V0.6_PHASE2.md
VALIDATION_V0.6_PHASE2.md
```

## 边界

该包仍是前端 Fixture。Run 计时、返回文件和 Changed Files 为演示数据，不代表 Local Core、Bridge、Codex Runtime 或真实文件写回已经完成。

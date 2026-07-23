# Backend Takeover Index

> 日期：2026-07-23
> 状态：Phase 0 只读接管完成，等待批准
> 写入范围：仅本目录九份 Markdown；未修改业务代码、依赖、lockfile、Bridge 或用户文件

## 结论

当前不具备直接编码条件。推荐先由前端 owner 将已验收的 `v0.6.0` 候选包整合进主仓、修复根质量门污染并建立可追溯基线提交；随后从该提交建立独立干净 worktree / `codex/backend-phase-0` 分支。后端不能继续使用当前脏工作区作为多人协作基线。

## 证据源

- 主仓库：`E:\Codex 项目\OS开发`
- 当前分支 / HEAD：`refactor/reusable-review-core` / `1f856971e789aac73a84ab4d963d80cf321dfd91`
- 前端候选包：`前端测试\v0.6大版本测试\收口测试\Local_Creative_OS_v0.6.0_Frontend_Complete.zip`
- 候选包 SHA256：`0EEEDB459F3AC778053E2C5885EDD205FDD32208F27D62FCE262C77D5ED40626`
- 候选展开副本：`前端测试\v0.6大版本测试\收口测试\_v060_full_regression_run_20260723\Local_Creative_OS_v0.6.0_Frontend_Complete`
- Bridge 审计源：`docs/audit/BRIDGE_ALPHA_RUNTIME_SPINE_AUDIT_RETURN.md`

## 文件导航

1. `01_REPOSITORY_STATE.md`：Git、候选包差异、质量链与污染说明。
2. `02_RUNTIME_RUNBOOK.md`：当前可运行命令和未来 Local Core 运行边界。
3. `03_FRONTEND_BACKEND_CONTRACTS.md`：实体逐项映射、Fixture 与接管责任。
4. `04_BRIDGE_CURRENT_STATE.md`：Bridge 能力的五类处置。
5. `05_DATA_AND_STORAGE_AUDIT.md`：localStorage、Schema、Repository、migration 与缓存。
6. `06_PORTASPLIT_GOLDEN_PATH.md`：Golden Path、Failure Path 与证据等级。
7. `07_KNOWN_RISKS_AND_OPEN_DECISIONS.md`：风险和需批准决定。
8. `08_RECOMMENDED_BACKEND_PHASE_0.md`：集成基线与第一条安全编码任务。

## Phase 0 门禁

```mermaid
flowchart LR
    A["当前脏主仓库"]
    --> B["前端 owner 整合 v0.6.0 候选"]
    --> C["修复质量门隔离并完整验证"]
    --> D["建立可追溯基线提交"]
    --> E["创建干净后端 worktree / 分支"]
    --> F["批准最小合同"]
    --> G["只读 Local Core 骨架"]
```

未通过 D、E、F 前，不创建 `apps/local-core`，不引入 SQLite、Watcher、Bridge Adapter 或真实文件写入。

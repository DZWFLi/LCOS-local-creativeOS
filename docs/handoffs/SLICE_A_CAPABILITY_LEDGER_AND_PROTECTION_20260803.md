# Slice A Handoff：现���账本与保护性测试

> 日期：2026-08-03  
> 分支：`codex/backend-hardening-20260802`  
> HEAD：`909382b`  
> 任务：`task_702b2800` (lcos_july_plan_gap_remediation)  
> 工作单：`docs/audit/LCOS_JULY_PLAN_FULFILLMENT_GAP_AND_BUDDY_WORK_ORDER_20260803.md`

## 完成内容

### 1. Capability Ledger v1.0

`docs/audit/LCOS_CAPABILITY_LEDGER.md` — 60 项能力 6 列矩阵 (GUI/Core/Bridge/CLI/MCP/Skill/E2E)：

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 已兑现 | 6 | 10% |
| 🟡 部分兑现 | 20 | 33% |
| 🟠 接口存在 | 8 | 13% |
| 🔴 未兑现 | 26 | 43% |

每个项目均有代码证据验证，工作单中的判定全部确认。

### 2. 保护性测试

`tests/architecture/july-plan-gap-protection.test.ts` — 10 测试 5 缺口：

| 缺口 ID | 锁定内容 | 测试 |
|---|---|---|
| UI-05 | Web 未 PUT ActiveContext | server 路由存在验证 / store.update 存在 |
| RUN-01/02 | Intent 默认 revise，analyze 无零文件路径 | adapter 硬编码检查 |
| RUN-06 | Adapter 硬编码 Markdown | script-draft / text/markdown 锁定 |
| QA-02 | Bridge 离线允许派发 | BRIDGE_UNAVAILABLE 存在但无预检 |
| UI-07 | Checkpoint 假按钮 | server 路由存在但 Web 从不调用 |

测试状态：10/10 PASS（测试缺口存在，不是缺口已修）。

### 3. Commit

```
909382b audit(slice-a): add capability ledger and protective gap tests
```

## 质量

| 检查 | 结果 |
|---|---|
| `git diff --check` | ✅ |
| 保护性测试 | ✅ 10/10 |
| 架构测试（既有） | 未重新运行（本 Slice 不改代码） |

## 不在此 Slice 的

- 不修改任何源代码
- 不修改 Schema
- 不引入新依赖

## 下一步（Slice B：Run Intent 真正落地）

按工作单 9.2 节，Slice B 应完成：

1. create/revise/analyze 真实行为
2. Web 明确 Intent → Composer 显式选择
3. analyze 零文件完成
4. create 多 Artifact 返回
5. revise 同 Artifact Draft
6. Adapter Registry，删除 Markdown 硬编码
7. unsupported 在派发前失败
8. Result Ingestion、Return Group、Review 投影和测试

但 Slice B 涉及**多处代码修改和 Schema 层面的语义变化**，属于 Dz 习惯中需要先给方案的范围。建议先由 Dz 确认优先级和阶段授权后推进。

## 风险

- 工作单中约 50% 项（约 30 项）为 🔴/🟠 状态，仅靠 Slice B–F 全部修完工作量大
- Bridge offline gate (QA-02) 与 Runtime Host (Slice C) 存在依赖环：需要 Bridge 常驻才能做健康预检
- 保护性测试依赖 `fs.readFileSync` 读源码——当源码修复后这些测试也会 PASS（需要手动更新测试语义）

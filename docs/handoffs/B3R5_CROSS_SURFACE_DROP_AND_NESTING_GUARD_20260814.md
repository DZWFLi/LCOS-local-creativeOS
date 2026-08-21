# B3R5 Cross-Surface Drop 与嵌套上限协议交接（2026-08-14）

## 1. 任务摘要

同步 `LCOS_B3R5_Cross_Surface_Drop_and_Nesting_Limit_Protocol_v0.1.md`：把结构包含、实体引用、Presentation Membership 分离，并让 Rail 对象可以按引用方式 Drop 到 Arrange / Context / Workflow。

## 2. 实际范围

- Domain 新增共享 containment guard：Collection 最多两层、禁止循环、禁止跨类型结构包含。
- Agent 单次最多新建一层 Collection；Legacy 超深数据保持可读，但禁止继续加深，不自动扁平化。
- Local Core 的整快照保存和 mutation batch 共用同一守卫；`MutationBatch.actorKind` 可标明 Agent 写入。
- Arrange、Context、Context Graph、Workflow、Workflow Graph 注册明确的语义 Drop target。
- 跨 Surface Drop 仅写稳定 EntityRef / Presentation Membership；不复制实体、不转移 ownership、不新建子 Scene、不递归展开。
- GUI 创建 Collection 前执行相同深度边界提示；最终权威校验仍在 Local Core。
- 冻结展示预算：inline expansion 1 层；Graph 默认 1 hop、最多 2 hops；默认检索预算 24 个实体。

## 3. 变更流程

```text
Rail Entity
  → Semantic Right Drag（冻结 stable refs）
  → Arrange / Context / Workflow target
  → 写入目标 Presentation Membership
  → Local Core 持久化

Structural Collection write
  → shared containment guard
  → depth / cycle / type / Agent-action 检查
  → allow 或明确 reject
```

## 4. 修改文件

- `packages/domain/src/index.ts`
- `packages/domain/tests/containment-guard.test.ts`
- `packages/contracts/src/index.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/tests/metadata-repository.test.ts`
- `apps/web/src/features/spatial/semanticRightDrop.ts`
- `apps/web/src/features/spatial/SpatialCanvas.tsx`
- `apps/web/src/App.tsx`
- `apps/web/tests/crossSurfaceDropContract.test.ts`
- `scripts/validate-r31b3r5-static.mjs`
- `apps/web/package.json`、`package.json`、`package-lock.json`

## 5. 验收结果

- B3R5 static protocol：10/10 PASS。
- Domain：10/10 PASS；新增 depth 2、depth 3、cycle、cross-type、Agent、legacy 场景。
- Contracts：6/6 PASS。
- Local Core 定向：29/29 PASS；包含快照与 Agent mutation 拒绝路径。
- Web：96 files，444/444 PASS。
- Domain / Contracts / Local Core / Web typecheck：PASS。
- Domain / Local Core / Web build：PASS。
- 各 workspace lint：0 error；保留仓库既有 warnings。
- `git diff --check`：PASS（仅行尾转换提示）。

## 6. 风险与未完成

- 本轮没有改变 Project Truth，也没有为跨 Surface Drop 创建新的结构关系。
- MCP / CLI / Agent 只要经过 Local Core snapshot 或 mutation 写入口，就会命中共享守卫；绕过 Local Core 直接改 SQLite 不属于支持路径。
- 本轮以协议、单元、静态合同和 production build 验证为主；真实浏览器中的完整 Drop 矩阵仍应在前端总批次验收时逐项手操，不能用合同测试冒充全部手操证据。
- 当前工作树同时包含此前 A4–B3 集成改动，本轮未 Commit、未 Push。

## 7. 回滚

只反向恢复上述 B3R5 guard、surface target、Drop 分支、依赖与测试；不得 `reset --hard`，不得覆盖同工作树中 A4–B3 的其他改动。Legacy 数据无需迁移或回滚。

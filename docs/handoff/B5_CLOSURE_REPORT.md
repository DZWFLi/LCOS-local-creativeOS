# LCOS B5｜项目修改与协作可靠性｜代码收口报告

日期：2026-08-16
基线：R17 Realtime

## 结论

B5 代码主链已收口。R17 已提前完成同用户多界面实时同步底座，本轮在其上完成：

1. 统一变更记录与安全撤销/重做
2. 语义关系直接创建、编辑、删除
3. 反馈 → 决策 → 修改请求 → 修订提案
4. 既有修改方案预览/应用继续复用 ChangeSet 骨架
5. Web 中可查看最近持久化修改并执行安全撤销/重做

## 核心纪律

- ChangeSet 是技术审计/撤销合同，不是新的项目业务实体。
- Undo 只在 touched state 仍等于该 ChangeSet 应用后的状态时执行，不覆盖后续修改。
- Relation provenance / evidenceRefs 必须随撤销与重做完整恢复。
- 反馈、决策、修改请求作为项目历史保留；撤销不通过硬删除历史记录伪造“从未发生”。
- 项目关系与 Presentation 临时关系严格区分；临时关系只有显式“保存为项目关系”才进入 Project Truth。

## 新增/扩展入口

- `GET /projects/:id/change-sets`
- `GET /projects/:id/change-sets/:changeSetId`
- `POST /projects/:id/change-sets/:changeSetId/revert`
- `POST /projects/:id/change-sets/:changeSetId/reapply`
- `GET/PUT/DELETE /projects/:id/relations/...`
- `POST /projects/:id/revision-workflows/prepare`

## 当前验证

- B5 static gate: 14/14 PASS
- A4→B6 静态合同总计 149/149 PASS
- 当前源码 477 个 TS/TSX 文件语法扫描 0 error

## 外部 Gate

当前沙箱无法恢复 npm 依赖，因此本轮新增代码仍需在真实开发环境重新执行：

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:architecture
npm run test:integration
npm run build
npm run test:e2e
```

B5 新增 Vitest 回归已写入源码，但本沙箱未执行。

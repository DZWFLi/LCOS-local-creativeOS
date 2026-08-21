# LCOS B5 合同矩阵

| 能力 | 合同 | Core | Web | 回归 |
|---|---|---|---|---|
| 统一变更 | `MutationChangeSetV1` | `MutationSafetyService` | 项目工具最近修改 | static + Vitest source |
| 撤销 | touched-state fingerprint | safe revert | 撤销按钮 | static + stale-state test |
| 重做 | forward snapshot | safe reapply | 重做按钮 | static + relation lifecycle test |
| 项目关系 | `Relation` | relation routes + ChangeSet | Workflow edge inspector | static |
| 反馈修订 | `PrepareRevisionRequestV1` | `FeedbackRevisionService` | Agent 修改请求表单 | static |
| 多界面同步 | R17 Project Event Runtime | R17 | R17 | R17 real-browser evidence |
| 修改方案预览 | existing Proposal/Reorganize | existing | existing preview/ghost | inherited |

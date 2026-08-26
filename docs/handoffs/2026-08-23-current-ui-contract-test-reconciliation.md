# 当前 UI 契约测试迁移交接

日期：2026-08-23

## 摘要

完整 Web 单元测试最初为 485 / 494 通过。9 条失败均为旧源码字面量断言，仍指向组件化前的文案、格式或入口；逐条核对当前实现后，将断言迁移到当前冻结交互，没有删除对应能力。

## 迁移内容

- 文件双击：当前进入单实例 Immersive Reader；Workbench 保留元数据与 Revision 职责。
- Reorganize：断言真实 `apply/revert` 阶段与 Pending 标记，不再寻找已删除的 CSS 字面量。
- Context：断言当前“理解现场”与纵向理解顺序文案。
- Workflow：断言当前项目级 Presentation、动态布局策略与 presentation edge。
- Glyph：断言统一 `LcosGlyph`，不再寻找旧 `LcosSignalGlyph` 名称。
- Bottom Dock：断言当前“LCOS 工作现场 / 工作现场”可访问名称。

## 风险与回滚

本轮只更新测试，不修改产品代码、Schema 或数据。若旧交互被重新批准，可回滚本提交并恢复相应产品实现，不能只恢复旧字面量。

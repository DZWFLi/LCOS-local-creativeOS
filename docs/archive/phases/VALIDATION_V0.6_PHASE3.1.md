# v0.6 Phase 3.1 本地静态验证

## 已检查

- Child Scope 数据模型仍保持单一 Project Graph；
- `proposal + feedback + reference` 生成 3 个 ArtifactView 和 2 条内部关系；
- 面包屑容器恢复 pointer events；
- Parent Scope 导航按钮具有真实测试标识；
- Project Tab 使用独立关闭按钮；
- 全局 `Ctrl/Cmd+Enter` 统一调用确认入口；
- `C` 聚焦增加 microtask 与多帧重试；
- Canvas 暴露节点与关系数量及端点证据；
- Phase 1.1 Canvas Lock 和 Phase 2.1 Dialog Guard 代码保留。

## 尚需 Codex 真实 Chrome 验证

- `npm run check`；
- Child 返回、重新进入与删除闭环；
- BODY / Composer 两种焦点下的快捷键；
- Tab 单关、全关与恢复；
- 1366 和 125% 响应式。

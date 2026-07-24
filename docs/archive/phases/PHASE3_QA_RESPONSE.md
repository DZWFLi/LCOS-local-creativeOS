# v0.6 Phase 3 测试报告回复

## 结论

报告中的 P0 与 P1 判断成立。Phase 3 的项目隔离、空白项目、Child Workspace、布局预览、固定锚点和响应式基础已经通过；阻塞点集中在 UI 命中与正常交互链，而不是 Scope 数据模型整体失效。

## 根因与修复

### Child Scope 无法返回父 Canvas

根因不是 `enterScope()` 缺失，而是早期 `.scene-title { pointer-events: none; }` 仍作用于后来的面包屑容器。按钮看得见，但整个父容器拒绝鼠标事件，堪称一种相当礼貌的假门。

Phase 3.1 已：

- 让 `.v06-breadcrumbs` 与内部按钮恢复 pointer events；
- 使用语义化 `nav`、`aria-current` 与明确的 `scope-back` 测试标识；
- Scope 切换前保存当前 Camera；
- 进入目标 Scope 时优先恢复目标 Workspace；
- 继续保留 Safe Insets、选择清空和布局预览清理。

### Composer 快捷键

Phase 2.1 的 Composer 内部快捷键逻辑仍保留，但浏览器测试在焦点落到 BODY 时没有全局 `Ctrl/Cmd+Enter` 路径；`C` 的双 RAF 聚焦在某些 Rail 切换组合中也不够稳定。

Phase 3.1 已：

- 增加全局 `Ctrl/Cmd+Enter -> requestRun()`，无论焦点位于 Composer 还是页面主体都只打开确认；
- 保留 Dialog 的 keyboard armed guard，不能用同一个按键事件直接开始 Run；
- `C` 展开 Rail 后通过 microtask 与多帧重试聚焦 Composer，并把光标放到末尾。

### 正常创建 Child 后关系为 0

纯模型函数对 `proposal + feedback + reference` 会生成 3 个 ArtifactView 与 2 条内部关系。Phase 3.1 将新建路径改为一次确定性 Graph Transaction，并在 Canvas 上增加可核对的节点/关系数量及关系端点属性，避免 Fixture 画面与正常路径使用不同验收口径。

### Project Tab 关闭入口

旧版只在 Tab 内放置一个无独立语义的 SVG 图标，浏览器测试无法把它识别为可操作关闭控件。

Phase 3.1 改为独立按钮：

- 明确 `aria-label="关闭项目 …"`；
- 支持单个关闭；
- 关闭活动项目后切换到剩余项目；
- 全部关闭后返回 Project Drive。

## 下一步

Phase 3.1 只补阻塞链路。浏览器回归通过后，将 Phase 1.1、Phase 2.1、Phase 3.1 合并命名为正式 `Local Creative OS v0.6.0`，清理 Phase 查询入口与临时交接文件，再作为 Alpha 后端能力开发的前端基线。

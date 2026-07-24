# v0.6 开发交接

## 相对 v0.5.6.1 的主要改变

1. 删除旧 Inspector / CommandComposer / NodeStatusOverlay 运行路径。
2. 新增单一 `WorkRail`，包含焦点 Header、自适应 Body 和永久 Composer。
3. `C` 只聚焦输入，不创建节点。
4. 发送后自动创建 Context Snapshot、Command、Run 与折叠 Process Node。
5. 单击节点直接驱动 Work Rail，双击文件进入 Focus Preview，双击容器进入子 Canvas。
6. 新增 Project Drive、Canvas Scope、面包屑和父子导航。
7. 新增 Target / Context 推断与轻量歧义确认。
8. 新增自动布局 Ghost Preview。
9. 接受结果时复用同一 Artifact 身份并生成新 Revision，旧目标冻结为历史视图。
10. Dock、Mini-map 与 Work Rail 状态参与动态 Safe Insets。

## 主要文件

```text
apps/web/src/App.tsx
apps/web/src/model.ts
apps/web/src/features/workrail/WorkRail.tsx
apps/web/src/features/workrail/PreviewSurface.tsx
apps/web/src/features/project/ProjectDrive.tsx
apps/web/src/state/workContext.ts
apps/web/src/features/canvas/scopeLayout.ts
apps/web/src/features/canvas/canvasGeometry.ts
apps/web/src/foundation.css
apps/web/src/surface.css
```

## 数据边界

当前仍为前端 Fixture：

- 文件预览是模拟内容；
- Run 生命周期由前端定时器模拟；
- Project Drive 未绑定真实目录；
- Context Snapshot、Command 和 Revision 使用前端 ID；
- Local Core、Bridge、Codex Runtime 尚未接入。

后端接入时应替换 Adapter 与状态来源，不改变黄金路径。

# UI v0.7 Integration Gate

日期：2026-07-29

## Decision

v0.7 ZIP 是 UI 候选源码，不是可覆盖仓库的发布包。接入采用选择性 clean-room
移植，保留当前 Local Core、Canonical Contracts、SQLite、Runtime Adapter 与既有 Canvas
交互。

## 变更原因

当前 v0.6.1 已拥有真实 Project Graph、Import Copy、Preview、ContextManifest 与
Runtime Review，但 App Shell 仍混有旧 Prototype 入口。v0.7 提供了更适合完整 OS 的
TopBar、Utility Dock/Panel、Node Quick Look 与自适应 Work Rail。

## 变更前

```text
旧 Project Tabs / Workspace Dock
→ Canvas
→ 常驻 Work Rail
→ 分散创建与项目入口
```

## 变更后

```text
TopBar
├─ Project Tabs / Scope Breadcrumb / Runtime Status
Utility Dock
├─ Project / Search / Add / Objects / Workflows / Assets / History
Utility Panel (Overlay)
Canvas
├─ Existing Interaction State Machine
└─ Node Quick Look (Portal)
Work Rail
└─ Existing Runtime Preview / Context / Review
```

## 接入

- v0.7 App Shell 与材质 CSS；
- Utility Dock / Utility Panel；
- Add、Project、Search、Objects、Workflows、Assets、History 面板；
- Node Quick Look；
- Empty Canvas Starter；
- UI-facing capability facade；
- Link Reference；
- Web Pane / Browser Companion 接口缝。

## 不接入

- ZIP 中重复的 Domain / Contracts；
- Fixture Adapter；
- Prototype Runtime 定时生命周期；
- localStorage Project Truth；
- v0.7 `RunStatus.review`；
- 默认全开的 Runtime capability；
- Canvas nodes 直接构建 ContextManifest；
- ZIP lockfile 与依赖版本。

## 数据影响

本 Slice 不新增 Schema。Link Reference 使用项目内 Markdown Reference Descriptor，经
Import Copy 进入现有 FileRecord / Artifact / Revision / View 生命周期。URL 与用途进入
Markdown 内容，后续可升级为正式 ExternalReference，而不把浏览器 Cookie 或网页正文写入
Project Truth。

## 风险与回滚

- App Shell 改动可能影响 Canvas 可用面积与 Pointer 坐标；
- Overlay 必须保持 Portal，不进入 Canvas 布局；
- v0.7 CSS 必须命名隔离，避免覆盖旧交互。

回滚本 UI Integration 提交即可恢复旧 Shell；不涉及 Schema 回滚。

## 验收

- Runtime Sample 正常打开；
- Canvas 选择、拖动、导入与 Mini-map 不退化；
- Dock 七个入口均有真实内容或明确 disabled reason；
- Quick Look 单击立即出现；
- Link Reference 可持久化并进入 Context；
- 1366×768 可用；
- 无阻塞 Console Error。

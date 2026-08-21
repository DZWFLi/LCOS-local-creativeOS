# MVP UI v0.7 Integration Review — 2026-07-29

## 任务摘要

在不替换现有 Domain、Contracts、SQLite Project Truth 和 Slice E Runtime Review 语义的前提下，将 `mvp UI V0.7` 的 App Shell 与关键交互接入当前 MVP。

## 实际范围

已完成：

- v0.7 顶部 Project Tabs、Scope 路径、保存与运行状态区；
- 左侧 Utility Dock 与 Project、Search、Add、Objects、Workflows、Assets、History 面板；
- 节点单击 Quick Look 浮层，同时保留右侧 Inspector；
- Link Reference：保存 URL、标题、说明和项目用途为 Markdown 描述文件，并走 Runtime Import Copy；
- Link Reference 明确不抓网页、不读取 Cookie，供本地 Agent 按可用工具访问；
- Web Pane / Browser Companion 只保留 versioned capability seam，默认关闭；
- Slice E Runtime Review 的 GET / Accept / Reject / Retry 前端客户端接口；
- 旧演示 Run ID 不接真实 Review 接口，避免把 Prototype 状态冒充 canonical Run。

未完成或未接通：

- canonical Run 的前端创建与选中入口；
- Artifact Return Accept / Reject / Retry 的可用 UI（客户端接口已接，能力保持 disabled）；
- 网页内容抓取、iframe 嵌套、浏览器扩展或 Companion；
- Search Runtime Query、History Runtime Event Feed；
- v0.7 Prototype 自带的 Fixture / localStorage Project Truth。

## 变更流程

```text
原流程
Project Canvas
→ 单击节点
→ 右侧 Inspector

新流程
Project Tabs / Scope
→ Utility Dock 或 Canvas
→ 单击节点
→ 节点旁 Quick Look
→ 需要深查时继续使用右侧 Inspector
```

```text
Link Reference
→ 输入 URL / 标题 / 说明 / 用途
→ 生成 .link.md 描述
→ Runtime Import Copy
→ FileRecord + Artifact + Initial Revision + ArtifactView
→ Context Manifest 可把该描述交给本地 Agent
```

## 修改文件

- `apps/web/src/App.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/v07.css`
- `apps/web/src/runtime/v07UiContracts.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/features/shell/V07TopBar.tsx`
- `apps/web/src/features/shell/UtilityDock.tsx`
- `apps/web/src/features/shell/UtilityPanel.tsx`
- `apps/web/src/features/create/LinkReferenceDialog.tsx`
- `apps/web/src/features/canvas/NodeQuickLook.tsx`
- `apps/web/tests/localCoreClient.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `apps/web/tests/v07Integration.test.ts`
- `apps/web/tests/v06Phase31Hotfix.test.ts`
- `apps/web/tests/v06Phase3Contract.test.ts`
- `docs/audit/V07_UI_INTEGRATION_GATE_2026-07-29.md`

## 验证结果

- Web typecheck：PASS
- Web tests：PASS，27 files / 106 tests
- Web production build：PASS
- `git diff --check`：PASS（仅 Git 的 LF → CRLF 提示）
- 浏览器启动：PASS，`127.0.0.1:5173`
- Runtime Sample Project 加载：PASS
- Utility Dock / Add 面板：PASS
- Link Reference 弹窗层级：PASS
- Link Reference Runtime Import Copy：PASS
- 节点 Quick Look：PASS

浏览器验收期间创建了一个 Sample Project 测试条目：

- URL：`https://example.com/reference`
- 标题：`网页参考样例`
- 用途：交给本地 Agent 作为上下文

该条目位于 disposable MVP Sample Project，不是用户正式项目数据。

## 风险与已知问题

- 当前 App 仍包含历史 Prototype 状态与 localStorage fallback，本次没有扩大范围清理；
- canonical Run 尚无前端真实入口，因此 Runtime Review 决策 UI 不能诚实启用；
- 中文 Link Reference 文件名在当前 multipart Import Copy 展示中可能出现编码异常，描述正文和 URL 不受影响；建议后续在 Import Copy filename decode 处统一修复；
- Utility Dock 与收起态 Workspace Dock 同时显示，功能可用，但后续视觉精修可继续合并层级；
- Web Pane / iframe 易受 CSP、登录态和 Cookie 限制，本轮没有做伪实现。

## 回滚

删除新增的 v0.7 组件与 `v07.css`，恢复 `App.tsx` 原顶部栏和选择行为；移除 `localCoreClient.ts` 新增的 Runtime Review 方法即可。未修改 Schema、Domain 核心语义或 Bridge Runtime。

## 下一步

1. 先由用户验收 v0.7 Shell、Quick Look 和 Link Reference；
2. 修复 Import Copy 中文 filename 编码；
3. canonical Run 创建/选中链成立后，再启用 Artifact Return Review UI；
4. Browser Companion / Web Pane 单独立项，不与 MVP Core 混做。

# Figma Make V9 Code Audit

日期：2026-07-20
对象：`OS项目文档/Make原型/高保真原型设计.zip`
结论：可作为 Alpha 交互讨论原型；不得原样合入正式工程。

## 审计范围

- 只读检查 ZIP 结构、`package.json`、`src/app/App.tsx` 与样式入口；
- 在系统临时目录解压、安装依赖和运行构建，不修改正式应用代码；
- 在本地浏览器实际执行 `Run → waiting_input → Artifact Return → Compare → Accept → Checkpoint`；
- 将默认 Canvas 捕获到独立 Figma Review 文件，并创建 V9 审核页。

## 验证结果

### 通过

- `npm run build` 通过；Vite 6.3.5 共转换 1599 个模块；
- 产物：JS 211.10 kB，CSS 91.21 kB（未压缩）；
- Mini-map 默认 `compact`，地图区为 `128 × 76`，可切换 `standard 172 × 100`；
- `queued / running / waiting_input / review / completed` 原型状态可触发；
- `waiting_input` 的保存新版本、覆盖并保留 Revision、取消三种操作存在；
- Artifact Return、Compare、Accept、Checkpoint UI 路径可实际点击；
- Prototype / Demo State 标识明确，未伪装成真实 Bridge、Codex 或文件写入。

### 未提供的质量门

- `package.json` 只有 `dev` 与 `build`；
- 没有 lint、typecheck、unit test 或 smoke 脚本；
- 没有 lockfile，首次安装不可完全复现；
- `App.tsx` 为 1485 行单文件，Canvas、节点、Panel、Run 模拟和状态全部耦合。

## 主要发现

### P1 — Accept 后仍是 Draft，违反冻结语义

`App.tsx:390-396` 的 `acceptArtifact()` 把结果节点改为 `Accepted — Draft`，但界面按钮是 `Accept as Current Version`。

实际点击证据：接受后 Canvas 显示 `提案_v8_AI.pptx · Accepted — Draft`，同时弹出 Checkpoint 建议。

影响：用户无法判断该 Artifact 是否已经成为 Current，违反“Draft 在人工确认前不得自动成为 Current”的反向语义——人工已经确认，却仍是 Draft。

### P1 — Artifact Return 错绑旧 Run

`App.tsx:382` 将每次新 Artifact 的关系固定写成：

```ts
{ from: "r1", to: artId, dashed: true, ai: true }
```

`r1` 是初始的 `Run #07`，不是当前 `Run #8 / #9 ...`。

影响：来源 Run、Changed Files 和 Revision 追溯会错误，不能作为 Alpha 数据语义参考。

### P1 — 缺少 failed 状态

`App.tsx:14` 的 `RunStatus` 只有：

```text
idle / queued / running / waiting_input / review / completed
```

冻结 Alpha 范围要求包含 `failed`，并覆盖 Bridge 断线、Codex 不可用、文件冲突等失败路径。

### P2 — 顶部 New Run 绕过 Command / Context

`App.tsx:701` 的顶部 `New Run` 直接调用 `startRun()`，无需确认 Target、Context 或任务内容。

影响：Golden Path 可以绕过产品最核心的“判断 → Context → Command → Run”步骤。

### P2 — “加入 Context”只是 Toast

`App.tsx:1095-1096` 点击 `+ 加入 Context` 只调用：

```ts
fireToast("已加入 Context 列表")
```

没有修改 `commandCtxIds` 或其他 Context 状态。

影响：界面反馈与真实原型状态不一致，后续 Command 看不到用户刚加入的文件或页面。

### P2 — 组件与状态耦合过重

`App.tsx` 共 1485 行。Project Nav、Tabs、Canvas、Node、Mini-map、Inspector、Preview、Command、Activity、Compare 和 waiting_input 都在单一组件中。

影响：复制进正式工程后难以满足 memo、局部订阅、Inspector 不订阅全量 nodes、可取消异步任务和领域类型唯一来源等工程规则。

### P2 — 依赖清单远超实际原型需要

归档包含 MUI、Radix 全套、图表、表单、DnD、轮播、日期、路由等大量依赖，而核心 `App.tsx` 主要直接使用 React 与 `lucide-react`。

影响：不可把 Make 的 `package.json` 原样并入仓库；应只移植经过确认的组件和交互。

### P3 — 字号可读性风险

原型大量使用 7.5–10.5px 文本；在 1366×768、Windows 100% 缩放和普通显示器上存在明显可读性风险。

建议 Figma 精修时将可操作文本和状态信息最低提高到 12px，并做灰度、100% 缩放与普通 sRGB 显示器检查。

## Figma 同步

- Review 文件：<https://www.figma.com/design/W9AilfPTpCvbtGVeIpUIsL>
- V9 默认 Canvas：<https://www.figma.com/design/W9AilfPTpCvbtGVeIpUIsL?node-id=4-2>
- 已新增页面：`01 · V9 Code Audit`
- 默认 Canvas 捕获为可编辑图层；审核页列出通过项、阻断项和下一轮顺序。

## 建议修复顺序

1. 修复 Accept / Current 语义；
2. 让 Artifact Return 关联本次动态 Run；
3. 补齐 `failed` 与失败路径；
4. 禁止顶部 New Run 绕过 Target / Context / Command，或明确降级为打开 Command；
5. 让 Preview 的“加入 Context”真正更新 Context；
6. 拆分领域状态、Canvas、Node、Panel 与原型运行器；
7. 增加 lint、typecheck、unit、build、smoke；
8. 最后再进行材质、字号、间距和动效精修。

## 回滚与边界

- 本轮未修改正式 Alpha 代码；
- ZIP 原文件保持不动；
- 安装、构建与运行发生在系统临时目录；
- Figma 同步位于独立 Review 文件，可直接删除对应页面或节点回滚；
- 未提交、未 Push、未创建 Tag 或 Branch。

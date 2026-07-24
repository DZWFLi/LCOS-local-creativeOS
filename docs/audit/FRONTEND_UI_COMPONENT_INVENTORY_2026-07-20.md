# Frontend UI Component Inventory · 2026-07-20

状态：Frontend Interaction Foundation；不是 Alpha 最终冻结。

## 对照基准

- `docs/design/FIGMA_MAKE_ALPHA_PROTOTYPE_PACKAGE.md`
- `docs/design/FIGMA_MAKE_MASTER_PROMPT.md`
- `docs/design/CREATIVE_OS_MATERIAL_VISUAL_SYSTEM.md`
- `前端测试/Local_Creative_OS_CSS_Refined_v0.2.zip`（前一基线）
- `前端测试/Local_Creative_OS_CSS_Refined_v0.3.zip`（当前基线）
- 当前 `apps/web/src/features` 与 `packages/ui/src/index.ts`

## 已完成组件与状态

| 组件族 | 当前实现 | 状态/证据 |
|---|---|---|
| App Shell / Project Tab | 单 Project、单 Canvas、Prototype Data 标识 | 可用；新建/切换 Canvas 明确暂缓 |
| Workspace Dock | Overview、Workspace 聚焦、收起/展开、Add、删除 Confirm、Core/Process 筛选响应 | 可用；删除只作用于 Semantic Viewport Fixture |
| Canvas / Camera | 左键选择/拖动/框选/组拖，中键平移，滚轮缩放，Space+Click Command | 1366×768、1440×900 可用 |
| Mini-map | 相机框、点击定位、拖动、缩放步进、折叠 | 可用 |
| 六类节点 | Source、Working、Generated、Context、Process/Run、Decision | default/hover/selected/multi-selected/dragging/pending/error/disabled |
| Relations | 锚点拖建、临时预览线、选中、删除、重连、空白创建菜单、节点移动跟随 | 可用；Fixture 初始线进入同一可编辑模型 |
| Detail Overlay | `?` 详情、Preview、原生打开权限提示、Portal 定位 | 可用；原生打开未接 Local Core |
| Inspector | 对象驱动单列：主内容 → Related → Context → Activity；折叠、单实例局部返回栈、Compare 临时扩展 | 可用；无顶部四 Tab |
| Command | Target/Context 分离；Skill/Executor/Output 渐进展开；Cmd/Ctrl+Enter；状态来源显示 | 可用；Runtime not connected |
| Run / Return | queued、running、waiting_input、review、failed、completed；动态 Run ID；Artifact Return、Compare、Accept、Retry、Checkpoint | 可用；execution 与 artifact review 状态已分离 |
| UI Feedback | Toast、ConfirmDialog、Tooltip/title、aria-label、Shortcut hints、Reduced Motion | 可用 |
| File Drop | 图片 Object URL 缩略图与 revoke；文档真实 filename/type/size；Preview unavailable | 可用；不上传、不移动、不写盘 |
| Adapter Boundary | WorkspaceQuery、Preview、Runtime facade 的 Fixture 实现 | `apps/web/src/adapters/fixtureAdapter.ts`；origin 明确为 fixture |

## Fixture 能力与边界

- Workspace、CanvasNode、Edge、Camera、Run 状态、Artifact Return、Preview 状态均为浏览器内存 Fixture。
- `?perf=80|150|300` 提供完整/简化/总览节点策略，不代表真实 Project Graph。
- Preview 只返回 Fixture `PreviewResult`；Runtime facade 的 retry/getRun 明确返回 `FIXTURE_ONLY`。
- 未连接 Local Core、SQLite、Bridge、SSE、Connector、Watcher、真实文件哈希、权限系统或持久化恢复。

## 暂缓项

1. 新建/切换 Canvas 与多 Canvas 页面。
2. Codex 提示词复制/生成。
3. 真实 Local Core Preview、文件写入、Revision、Workspace/Project 重启恢复。
4. 真实 Bridge Run、事件流、取消、冲突哈希和权限判定。

## 后端接口边界

- UI 仅通过 `@local-creative-os/contracts` 类型推导的窄 adapter 消费 WorkspaceQuery、Preview、Runtime facade。
- 未复制 contracts/domain 类型；UI `Workspace` / `CanvasNode` 仅是展示模型，由 adapter 映射正式 Domain Workspace。
- Fixture adapter 不伪造 runtime 成功，不写入 Project 真相；后端接入时替换 adapter 实现即可。

## 仍缺 UI 组件 / 非阻断缺口

这些是 Spec 中提到、当前未完整展开的低频状态，不影响当前 Golden Path：

- `SelectionToolbar` 独立组件：当前使用 Canvas marquee + 键盘 Delete，没有单独浮动工具条。
- Artifact Missing / Stale / Sync Error 专用文案卡：当前复用 error/disabled 与 Preview unavailable 状态。
- Command no executor、Pending Return unknown Target 专用分支：当前 Target/Executor Fixture 固定且有边界文案。
- Cancelled Run 专用展示：当前批准范围重点覆盖 failed/retry；contracts 支持 cancelled，UI 尚未单独展示。
- `packages/ui` 目前提供 token/入口，业务组件仍在 `apps/web`，未将项目状态下沉到通用 UI 包。

## 死控件扫描

- 当前扫描范围 `apps/web/src/features`、App Shell、Dock、Mini-map、Inspector、Command、Run：未发现仍无响应的核心按钮。
- Project Tab 与 Add Tab 点击会给出诚实 Toast，并明确新 Canvas 暂缓。
- 原生打开会给出 Local Core 权限提示，不会静默执行。
- Dock Core content / Process layer 当前为 Fixture 筛选响应，不冒充真实过滤器。

## 截图证据

- `E:\Codex 项目\OS开发\.playwright-cli\final-golden-1366.png`
- `E:\Codex 项目\OS开发\.playwright-cli\final-golden-1440.png`
- `E:\Codex 项目\OS开发\.playwright-cli\retest-stale-retry-1440.png`
- `E:\Codex 项目\OS开发\.playwright-cli\state-source-consistency-1440.png`
- `E:\Codex 项目\OS开发\.playwright-cli\adapter-boundary-1440.png`
- `E:\Codex 项目\OS开发\.playwright-cli\retest-p0-hooks.png`
- `E:\Codex 项目\OS开发\.playwright-cli\v03-dock-1366-expanded.png`
- `E:\Codex 项目\OS开发\.playwright-cli\v03-dock-1440-expanded.png`
- `E:\Codex 项目\OS开发\.playwright-cli\v03-inspector-1440-file.png`
- `E:\Codex 项目\OS开发\.playwright-cli\v03-inspector-1366-context.png`
- `E:\Codex 项目\OS开发\.playwright-cli\v03-state-chain-1440.png`

## v0.3 视觉与信息架构复核

- 节点、Dock、Mini-map、Inspector、Command 统一沿用 v0.3 Bright Pearlescent / porcelain / liquid chrome 材质族；普通边静止，运行/焦点/Artifact Return 边才动。
- 1366 默认 Dock 的名称、数量、添加与删除入口均可读；收起后保留可辨识图标与 Tooltip，重新展开恢复完整结构。
- Inspector 不是四张纵向平级卡：文件默认 Preview 最重，Run 默认 Activity，Context 默认 Context，Decision 默认正文/Related；空内容不渲染，相关段落只显示轻量摘要。
- v0.3 亮色覆盖已内含在 `styles.css`，未重复加载 `bright-pearlescent-overrides.css`；未恢复 Hover 几何位移、粗色条或白墙。

## 完整质量链

- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm run test --workspace @local-creative-os/web`：15 tests passed
- `npm run build`：通过
- `npm run smoke`：通过
- `git diff --check`：通过（仅保留既有 LF/CRLF 警告）
- 浏览器 Console：双分辨率仅 React DevTools info，无阻断错误。

## Git / 敏感信息

- 未提交 Git；工作区保留主控已有未提交文件与截图产物，未执行 reset/clean。
- `apps/web`、`packages/ui` 未扫描到 API key、secret、token、password 或私钥内容。
- 未修改 `apps/local-core`、`packages/domain`、`packages/contracts`、`tests/e2e`。

## 结论

当前前端组件覆盖已足以支持个人使用的 Interaction Foundation Golden Path。剩余缺口主要是明确暂缓项、低频错误分支或后端真实能力，不应在本轮为了“保持忙碌”继续扩展。

## Canvas maturity audit (2026-07-21)

- 已完成：world-space 持久 selection-bounds、组拖派生状态、fitBounds/空视口定位入口、单选 resize handle、尺寸 clamp/Shift 等比、compact/standard/expanded density、v0.3 左色条与控件层级纠偏。
- 证据：`E:\Codex 项目\OS开发\.playwright-cli\canvas-maturity-1366-resize-multiselect.png`；浏览器确认 resize 与 Shift 多选，Console 无阻断错误。
- 测试：19 个 Web unit tests、typecheck 通过；新增 `canvasGeometry.test.ts`。
- 未完成/诚实边界：专用 middle-button 远向平移后“空视口→定位内容”浏览器序列尚未取得可靠自动化证据；fit 逻辑已有真实 bounds 单测。尺寸与选区均为 Fixture 内存状态，不写后端契约。

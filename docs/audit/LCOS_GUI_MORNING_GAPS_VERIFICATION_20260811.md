# 上午 GUI 遗留项补验记录（2026-08-11 晚）

> 背景：用户在下午收口时点名——「Checkpoint 时间线/对比、Preview 外部打开、Handoff 文件级 zip、文件夹扫描确认页、Activity/Recovery/Watcher 界面——入口有或部分实现，都没做手工验收」。
> 本文件逐项给出真实状态与证据；已补的给证据，没补的如实写 NOT DONE 并说明阻塞。

## 1. Preview 外部打开 —— DONE（本轮补验）

- 路径：正式 URL 导入（`POST /projects/:id/resources/import-url` → `buildLinkMarkdown` 生成 `url: https://...` 前置正文）→ web 导入路径自动 `generatePreview(revisionId, 'thumbnail')`（App.tsx:2224）→ `previewText` 含 `url:` 行 → 双击节点时 `handleDoubleClick` 命中 `viewerKind === 'link'` → `window.open(url)`。
- 实测：Golden 项目导入 `https://www.figma.com/design/LCOS-golden-reference` → thumbnail preview `ready` → 浏览器双击节点 → `opened urls: ["https://www.figma.com/design/LCOS-golden-reference"]`（Playwright popup 记录）。
- 截图：`.codex-runtime/gui7-18-web-external.png`。
- 备注（低优先级优化，非缺陷）：预览尚未生成时双击会落到对象工作台并显示「未提取到外部 URL」；正常 web 导入会自动生成 thumbnail，不受影响。手动 API 导入需先触发 thumbnail 预览。

## 2. Checkpoint 时间线/对比 —— NOT DONE（数据源未接入 GUI）

- 已有：`listContextSnapshots` 加载 `coreContextSnapshots`（App.tsx:331-336）；`compareContextHistory` 会用快照对比（App.tsx:1578-1595）；`ContextHistoryRail` 有「对比当前」「从这里建现场」按钮。
- 缺口：Context 投影的 `contextSurfaceRuntime.history` 硬编码为 `[]`（App.tsx:3305，注释明确“用户可见的 Context 历史属于已导入对话，不投影整个项目快照”），因此 GUI 上历史栏无数据、按钮不可见。这是产品语义决策未落地为数据接入，不是验收遗漏。
- 下一步需拍板：是否在 Context 表面展示项目级快照时间线（含对比），或保持“快照历史只在 Workbench/对话内可见”并补一条可达路径。

## 3. Handoff 文件级 zip —— NOT DONE（功能缺口）

- 现状：`HandoffDialog` 只有「复制上下文」和「下载 Markdown」（`.md` 单文件，App.tsx:3132-3141）；没有 zip 打包。
- 后端有 `exportLcosproj`（项目级 .lcosproj 导出），但语义是项目导出，不是 Handoff 上下文包。
- 若“文件级 zip”指把 Handoff 清单 + 关联文件打包下载，需要新功能（manifest + 文件收集 + zip），非验收项。

## 4. 文件夹扫描确认页 —— PARTIAL（入口存在，缺真实环境验收）

- 入口：`ObsidianImportDialog`（features/resources/ObsidianImportDialog.tsx）+ `selectObsidianVault` 流程（App.tsx:2330）；MCP/CLI 的 `scan_lcos_obsidian_vault` / `import_lcos_obsidian_notes` 路径存在（connectors route + Obsidian connector 只读扫描）。
- 阻塞：确认页由系统文件夹选择器触发（原生对话框），自动化环境无法真实弹出；本机也没有可用的 Obsidian vault。未做真人点击验收。
- 建议：由用户在真机上用一个临时 vault 走一遍，或接受 CLI 扫描 + 对话框渲染的组合证据（本轮未做后者，如实标注）。

## 5. Activity / Recovery / Watcher 界面 —— PARTIAL（Activity 有入口，Recovery/Watcher 无 GUI）

- Activity：`WorkRail` 的 `RunActivity`（`data-testid="run-activity"`）存在，需真实 Run events 渲染；本轮 Golden 无真实 Run，未做交互验收。
- Recovery：web 端无恢复界面（恢复逻辑在 Core 启动/上下文恢复，GUI 只有自动恢复与 toast）。
- Watcher：是 Bridge/后台概念，web 端无界面（诊断页 `/__diagnostics` 有 Browser Integration Checks，属开发页）。

## 附带修复

- `apps/local-core/tests/vector-knn.test.ts`：仓库根路径从 `process.cwd() 上跳两级` 改为基于 `import.meta.dirname`，消除「裸跑 vitest 与 workspace 跑行为不一致」（裸跑时 2 个 vec0 用例因路径漂移失败）。修复后 `npx vitest run apps/local-core/tests` = 362/362。

## 结论

- 已补：Preview 外部打开（DONE，带 popup 证据）。
- 未补（如实保留）：Checkpoint 时间线/对比（数据源未接）、Handoff zip（功能未实现）、文件夹扫描确认页（缺真实环境验收）、Activity/Recovery/Watcher（Activity 入口在但无真实 Run 验收；Recovery/Watcher 无 GUI）。

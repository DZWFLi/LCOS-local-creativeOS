# AdFrame Script Review — Day 2.5 Lite 审核报告

项目：`E:\Codex 项目\演示demo`  
分支：`refactor/reusable-review-core`  
冻结基线：`v0.2.0-script-review`（commit `71f158a`）

## 1. 目标与边界

本轮只建立稳定数据边界，让现有 Demo 可重置、可安全持久化、可替换案例并可继续演进。没有实施完整 Repository、Execution Runtime、插件式 Evaluator、大规模目录迁移、真实 API 或新增依赖。

## 2. 已完成

- 新增 `ProjectState`、`StoredDemoState`、`DemoUiState`。
- 新增统一 envelope：`schemaVersion / projectId / updatedAt / data`。
- 将四个旧 localStorage key 一次迁移到统一存储；损坏或不兼容结构回到 seed。
- 新增 `createDemoState()`，每次返回独立深拷贝，避免 Reset 后引用污染。
- 固定演示起点：Script V2 / PRODUCT SETUP / Human Review。
- 为固定起点补齐一条 Open Review 和 pending Mock AI Draft。
- 修复 Script V2 的 `decisionId` 错误引用。
- 新增二次确认 Reset；确认后同时恢复 Script、Review、AI Draft、Decision、版本、段落和 Tab，并关闭 Compare/Context/Export。
- 将 Markdown 与 Handoff Payload 构建逻辑从 `ExportDrawer` 抽出到独立 builder。
- JSON/Codex Handoff 新增 `schema_version`，其余业务字段保持不变。

## 3. 文件边界

- `src/demo/seed.ts`：演示起点和可重置项目状态。
- `src/infrastructure/demoStorage.ts`：浏览器持久化、旧数据迁移、Reset。
- `src/services/reviewExports.ts`：Markdown 与 Codex/JSON 上下文组装。
- `src/data/scriptProject.ts`：PortaSplit 领域案例数据，仍不被组件直接定义。

本轮刻意没有建立完整多实现接口。未来出现第二种存储、第二种 Evaluator 或真实执行 Runtime 时，再升级当前薄边界。

## 4. 子 Agent 审查

- 模型审查确认：Decision 应保持版本级，Review/AiDraft 必须坚持 `versionId + segmentId` 隔离。
- QA 审查覆盖：异常 schema、Reset、跨版本隔离、AI disposition、Review→Decision、Compare、导出和两档响应式。
- 已采纳修正：V2 起点数据补齐、V2 Decision 引用修复、统一 UI 起点持久化。

## 5. WorkBuddy 独立审查

- Bridge 任务：`task_3752dad3`，项目路由：`adframe_demo`。
- 执行证据：任务已由 WorkBuddy claim，并于 2026-07-17 11:48（北京时间）提交到 `review`。
- 审查结论：通过；未发现阻塞项，且未修改 `src`。
- 独立报告：`docs/DAY2_5_BUDDY_REVIEW.md`。
- Buddy 复核确认：统一存储信封、legacy migration、损坏数据回退、固定演示起点、版本隔离、导出 builder、Reset 及零新增依赖均符合 Day 2.5 Lite 边界。
- Buddy 记录一项非阻塞数据完整性观察：V1 存在 `decision-v1`，但版本对象未显式绑定 `decisionId`；当前决策读取按 `versionId` 工作，不影响本轮演示，留待后续数据清理。
- 协作链证据边界：Bridge 已保留 `assigned_at` 与 `reviewed_at`，飞书助手也明确回报 claim 与提交；但项目 `.workbuddy` 文件在任务结束后未保留本任务 ID，且 `status_board.json` 仍停留在前一日。因此本轮能确认“真实 Buddy 执行与 Bridge 回传”，不能把它当成“watcher 持久路由证据完整”的验收样本。

## 6. 验证结果

- `npm run lint`：通过。
- `npm run build`：通过。
- `git diff --check`：通过。
- WorkBuddy 独立复跑 `npm run lint` / `npm run build`：通过。
- 页面身份：`AdFrame Script Review`，无框架错误层。
- Console error/warn：0。
- Reset 确认层：取消与确认入口可见，确认后回到固定演示起点。
- Reset 后刷新：Open Review 与固定起点保持。
- V2 PRODUCT SETUP Mock AI：pending 可见；Revise 后刷新保持。
- 1366×768：无横向溢出。
- 1024×768：无横向溢出，确认层完整可操作。
- Codex Handoff：内置浏览器拒绝剪贴板写入时正确显示 `Copy Failed`，页面不崩。
- Markdown/JSON：按钮与生成逻辑存在；内置浏览器本轮未返回下载事件，需在最终录屏浏览器再做一次实际落盘复核。

## 7. 尚未完成 / 风险

- 当前 schema 校验是 Demo 所需的最小结构校验，不是完整运行时 schema validator。
- PortaSplit 数据仍在 `src/data/scriptProject.ts`，但已与 UI 组件隔离；为控制变更规模，本轮没有为了目录纯度搬文件。
- Clipboard 能力受浏览器权限影响，失败反馈已覆盖。
- Day 3 增加 Match Night 前，应先确认只需 seed 数据和轻量项目选择，不得重写状态结构。

## 8. 总控结论

**Day 2.5 Lite 通过。** 主线验证、子 Agent 审查和 WorkBuddy 独立审查结论一致；当前版本适合作为 Day 3 的稳定输入。下一阶段不得借机扩展 Repository、Runtime 或真实 API，应优先完成演示叙事和案例替换验证。

## 9. Day 3 建议

先完成三分钟演示脚本、README/Case Study 和实际浏览器导出复核。Match Night 保持可取消：只有在不新增评审逻辑和组件字段的情况下才加入。

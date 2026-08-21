# LCOS 未完成欠账清单（OPEN DEBTS）

> **压缩协议：任何上下文压缩 / 轮次交接 / Handoff 摘要，本文件必须放在最前面，逐项核对后再继续。**
> 更新规则：每完成一项，从本清单删除并记录到对应 Handoff；每发现新缺口，立即追加。

---

## 当前活跃欠账（按优先级）

### P0-R31A4｜Rail 直接操纵 + 渐变光幕（2026-08-13，代码已改，真机验收 PENDING）

- **已完成（第 2 轮）**：拖拽改为安卓桌面式——源项挖空浮起、浮卡跟手（`lcos-rail-drag-float`）、相邻项实时让位（transform 平移，纯视觉，松手才提交原子排序）；列数改为用户拖 rail 右缘控制（右拉双列 / 左拉单列 / 松手恢复自动），保留超容量自适应默认；删除光幕门槛调整为「左甩 ≥24px 且进入 rail 左沿 20px 带」（rail 贴屏幕左缘，原来 dx<-96 物理上够不着）；scope-backed 视图（Context/Workflow/Collection）删除已接通——`onDeleteScope` + 确认弹窗 + `removeScopeTree` 级联，与画布删除同语义；悬浮预览卡加 220ms 延迟关闭 + 命中桥，鼠标移过去编辑命名不再消失。
- **第 2.5 轮（改名卡片）**：卡片标题去掉省略号截断（完整显示、自动换行，实测长标题 sw=cw 无截断）；卡片加宽到 320px、按钮列改 auto 自适应；重命名输入框字号修正；「更多操作」菜单保留（复制视图入口仍在）。
- **第 3 轮（重命名入口补全）**：scope-backed 视图（Context/Workflow/Collection）重命名接通——`onRenameScope` 改 `setScopes` label + updatedAt，走既有 graph 保存（runtime 走 saveMutations）；悬浮卡片上铅笔按钮对两类视图都显示，标题文字也可直接点击进入编辑。
- **第 3.5 轮（用户点名收口）**：铅笔旁边的「…」更多操作按钮删除（上移/下移/删除/重命名均已被手势与铅笔覆盖；「复制视图」入口随之移除，需要时再加独立按钮）；卡片收窄 320→276px、按钮列改 2 个 auto（scope 文字区 122px / workspace 96px，实测无截断）。
- **第 4 轮（R3.1A Closeout 合并后真机修复）**：① 侧栏视图单击失效——左键拖拽在 pointerdown 即抢占 pointer capture，click 被容器吞掉；改为拖过 4px 阈值才捕获，单击恢复。② 空视图后回不到主画布——底栏「主画布」走 `enterScope` 时 `nextScopeId === scopeId` 提前返回未清 `workspaceId`；补清 Workspace/Workflow 场景。真机复现验证通过（空工作空间/Context → 底栏主画布均恢复）。
- **重要澄清（用户询问）**：本轮「删除语义」没有写进 Core——scope 删除仍是前端 `removeScopeTree` 级联 + 确认弹窗 + graph 保存（与画布删除同路径）；Core 层正式删除/合并/迁移事务语义仍是待办，等合并与跨视图拖出需求一起定。
- **验证**：typecheck ✓ 契约测试 7/7 ✓ 全量 929/929 ✓ build ✓ 5173 HMR 确认 ✓
- **PENDING（真机手测）**：左甩删除红光幕 + 确认流（workspace 与 scope 两种）、浮卡跟手与让位手感、右缘拖列数、内联改名不再消失、7+ 视图双列让位、画布右键投送光幕。
- **已记录待办（用户点名）**：
  1. 画布全局「让位式」实时重排是否太卡——先记录，后续做 Canvas 性能预算时再评估，本次未实施。
  2. 后续要做「两个 Context/Workflow 之间合并」「把一个视图的成员拖出来进另一个」——先记录，动工前需定 Core 层合并/迁移事务语义。
  3. scope-backed 重命名仍未接通（Core 无 scope rename API），workspace-backed 可内联改名。
- Handoff：`docs/handoffs/RAIL_DIRECT_MANIPULATION_AND_LIGHT_CURTAINS_20260813.md`

### P0-R31A｜Project Entity / Surface Semantic Foundation（2026-08-14，A 语义收口代码已实现，真实浏览器 Gate 待验）

- **冻结模型**：Main Canvas / Context Graph / Workflow Graph / Workspace Scene 都只是同一 Project Truth 的 Presentation；Surface 不拥有节点，Scope 只保留导航与兼容定位语义。
- **统一成员身份**：`PresentationStateV0.memberEntityRefs` 支持 `view / scope / workspace`。Collection / Context / Workflow / Workspace 可作为一等 aggregate Entity 被任意 Presentation 引用，不要求克隆成员 View。
- **Workspace / Current Scene**：Workspace 已拥有稳定 `workspace:<id>` ProjectNode identity；普通 View 继续由 `focusedViewIds` 保存，aggregate Entity 由 `presentation:custom:workspace:<id>` 保存。创建、复制、加入、移出都会保留两类成员；删除 Workspace 时 Core 原子清理其 scene Presentation 与其它 Presentation 中对该 Workspace 的 aggregate ref。
- **Collection**：新建路径不再创建成员子画布/克隆成员；Collection 只创建 aggregate Entity + exact Presentation membership。旧 `delivery` / child-canvas 结构仅保留 migration compatibility，不再作为新建入口。
- **Context**：严格两层：一级 Obsidian-like `Context Graph`（点状关联图，Context 节点可按内容量改变大小）→ 点击 Context → `Signal Track / Mind Map`。两者读取同一 exact membership。Context merge 当前采用非破坏式语义组合；真正 destructive merge/split 事务见下方完整性欠账。
- **Workflow**：底部「工作流」进入一级 `Workflow Graph`，表现为有方向/状态感的项目行动网络；点击 Workflow Entity 进入具体 Workflow Canvas。新 Workflow 有独立 Entity owner + exact membership，不依赖 Workflow Page Workspace 才能存在。
- **Drop**：Main Canvas 与非主画布 Project Surface 统一右键 semantic Drop；Project Entity 可直接投送到 Context / Workflow / Workspace / Collection。Rail 的左键排序/左甩删除/右键投送由独立 UI 变更维护，本轮不得覆盖。
- **Semantic Edge**：Scope / Workspace aggregate Entity 已可作为 Core Relation endpoint；Relation 不再必须落到 fake Artifact relation。
- **本轮验证（开发侧）**：TS/TSX transpile syntax 431 files PASS；A-closeout static contract 9/9 PASS（开发容器无 node_modules，未跑全量）；**本机已补跑：typecheck ✓、新增 closeout 测试 + 既有契约测试全绿、build ✓**（见下轮交接）。
- **PENDING REAL BROWSER GATE**：Workflow Graph 一级视图；Workspace scene 含 Context/Collection/Workflow aggregate entity；Context Graph → Context detail；跨 Surface 右键 Drop；reload 后 exact membership；Workspace delete 后无 dangling scene/reference。
- **明确仍未关闭的 Core integrity debt（不得伪装成 A 已完成）**：
  1. Collection / Context / Workflow 的 `Scope.containerViewId` 仍使用 ArtifactView 类型作为兼容 Presentation carrier；真正 generic ProjectNode carrier 需要 Domain/Schema migration。
  2. `delete_scope` 尚无 Core 原子事务；Context/Workflow/Collection 删除、Presentation cleanup、proxy orphan cleanup、跨 Presentation dangling `scope` ref 清理尚未统一。
  3. Context 当前 merge 是非破坏式组合；真正 destructive merge/split/member-move 需与 `delete_scope` 一起定义原子事务和回滚语义。
  4. `temporary-workbench` 仅剩 Context History branch compatibility；不得再作为 Current Scene 新写入。
  5. Workflow Detail 旧 Workflow Page/Operator UI 仍保留兼容，属于后续 Workflow GUI/Edge-first 重构，不是一级 Workflow Graph 的 truth owner。
  6. Decision 等 legacy Canvas kind 仍受旧 Runtime persistence heuristic 影响，尚未拥有与 Scope/Workspace aggregate entity 同等级的 generic Entity identity。
- 决策稿：`docs/decisions/R31A_PROJECT_ENTITY_SURFACE_MODEL_20260814.md`


### P0-1｜Curation applyPatch 复合事务（已关闭，2026-08-11）

- **完成内容**：`runCurationMutation`（text DB 部分 + relations + presentation CAS + change set + receipt 单事务）；applyPatch 重构为"draft 写 staged → 复合提交 → rename"；预验证 + 事务内 CAS 双保险
- **验收**：stale presentation → 预验证 0 mutation；相关 22 用例 + 全量 342 通过
- **教训**：该缺口曾因 Handoff 漏标导致返工，已纳入压缩协议

### P0-2｜HU-2 SessionReadSet（未开始）

- **已关闭（2026-08-11）**：SessionReadSet LRU + full-read lease + update 强制校验（NO_READ/STALE）+ CLI --session + restart 验证；6 用例全过，全量 348
- 附带修复：view.revision_id 不再分裂（commit 时跟随 current）

### P0-3｜HU-3 Presentation 所有权（未开始）

- **HU-3A 已完成（2026-08-11）**：前端 hierarchy/positions/pins 内存 Map 明确为
  optimistic working copy；Core presentation_views 为唯一 committed truth；去 200ms
  轮询改 bridge.subscribe；GesturePreviewStore（transient 不持久）已真实接入
  ContextGraphSurface；importer freeze 测试；跨项目主键归属守卫；patch 组合；
  恢复时序修复。Handoff：`docs/handoffs/HU3A_PRESENTATION_TRUTH_PURIFICATION_HANDOFF_20260811.md`
- **HU-3B（未开始）**：Hierarchy/Edges/Transient 正式契约（context-temp 边过滤规则、
  edge cut 语义、transient 显式化）、去 3 秒轮询（提案列表/待审计数并入 SSE）

### P0-4｜HU-3 §12 Core unavailable 降级（转 GUI II）

- Core 不可用时当前保持 memory optimistic + ready=false；Canvas 的
  degraded/read-only 或 offline-pending 提示未做。GUI II 处理，不做 offline log。

### P0-5｜HU-4 / HU-5（已完成，2026-08-11）

- HU-4 Spatial Retrieval：确定性空间 recall（hierarchy/presentation edge/
  geometric），CLI + 路由 + Skill 规则，不写 Domain、不依赖 Ollama
- HU-5 Boundary Guards：架构边界测试（importer 冻结、routes 禁裸 SQL、
  provider/web/skill 边界）+ DerivedWriteGuard 晚写守卫（applied/
  skipped_deleted/skipped_stale）+ semantic embedding 守卫
- Handoff：`docs/handoffs/HU4_HU5_SPATIAL_RETRIEVAL_AND_BOUNDARY_GUARDS_HANDOFF_20260811.md`

### P1-1｜GUI Gate 5 缺口（已关闭，2026-08-11 GUI II）

- ~~Capture Spawn Zone~~（GUI-3：CapturePlacementService，连续 20 次零重叠）
- ~~Node 空字段/工程噪音~~（GUI-2：NodeInfoPopover 有值才显示 + Developer 折叠）
- ~~Anchored Note~~（GUI-6：Core Note 投影 + anchorRefs + 定位脉冲）
- ~~Pinned Capture Target UI~~（GUI-1：ProjectStrip 收件 pill）
- ~~Reorganize Ghost GUI~~（GUI-5：提案 → Ghost → Apply → Revert）
- GUI-7 Golden 验收 25/25、Gate 21 项复测 DONE 21/21；Handoff 见 `docs/handoffs/GUI6_*`、`docs/handoffs/GUI7_*`；复测审计 `docs/audit/LCOS_H_GUI_COMPLETION_GATE_RERUN_20260811.md`

### P1-2｜A-H 各阶段遗留

见 [docs/audit/LCOS_AH_UNFINISHED_WORK_AND_NEXT_STEPS_20260811.md](audit/LCOS_AH_UNFINISHED_WORK_AND_NEXT_STEPS_20260811.md)（完整汇总）。关键项：

- 前端 Presentation hierarchy 落 Core（与 P0-3 同源）
- V07TopBar 死代码未清、Shell 职责评审
- embedding benchmark（qwen3 vs nomic）：nomic 一轮已完成（`docs/benchmarks/EMBEDDING_BENCHMARK_20260811.md`，33ms/条 + 语义冒烟通过）；qwen3-embedding 拉取因网络超时未完成，拉到后 `node scripts/embedding-benchmark.mjs qwen3-embedding` 补对比
- ~~eval fixtures 实装~~（2026-08-11 确认：6 个 case 已被架构测试消费）
- SkillPatchProposal 自动化（等 badcase 积累）

### P1-3｜本轮新发现（GUI II 收口后）

- active-context 并发写入偶发 409（前端已刷新自愈；建议后续把 active-context 写入并入 SSE/版本队列）
- 首次打开项目时 context/workflow presentation 404 属正常 NOT_FOUND→seed 流程，无需修复
- Workflow presentation 保存回环与 stuck-drag auto-pan 已修复（见 GUI-7 Handoff Discovered Debt），无遗留
- 上午点名的手工验收项补验结果（详见 `docs/audit/LCOS_GUI_MORNING_GAPS_VERIFICATION_20260811.md`）：
  - Preview 外部打开：DONE（真实 URL 导入 → thumbnail preview → 双击外部打开，带 popup 证据）
  - Checkpoint 时间线/对比：DONE（2026-08-11 晚：Context 历史栏 = Core 快照；真实 notice「新增 0 / 移除 17 / 不变 7」）
  - Handoff 文件级 zip：DONE（2026-08-11 晚：`GET /projects/:id/handoff-zip` + 自研 zip-writer + 前端「下载 ZIP」，API/浏览器双验收）
  - 文件夹扫描确认页：逻辑已验（ObsidianImportDialog 组件测试 4 例 + 只读扫描契约；真人点击仍留真机 vault）
  - Activity/Recovery/Watcher：PARTIAL（WorkRail RunActivity 入口在但无真实 Run 验收；Recovery/Watcher 无 GUI）
- vector-knn 测试路径脆弱性已修复（import.meta.dirname 定位仓库根），裸跑与 workspace 跑一致
- ActiveContext 并发写入：前端改串行写入队列 + 冲突重放（2026-08-11 晚）；快速连点 9 次 0 个 409
- Phase I 基线第一轮：`docs/audit/PHASE_I_BASELINE_20260811.md` + `scripts/phase-i-baseline.mjs`

### P2｜Phase I / J

- Phase I：资源基线测量 → ResourceGovernor → Ollama 策略 → Canvas 性能 → 真机 Gate
- Phase J：installer / 托盘 / 全局快捷键 / .lcosproj 关联 / 签名 / RC

### Phase 5｜Capture 网关 + 暂存 + 扩展（2026-08-12）

> **2026-08-18 PASS7 收敛注记（覆盖下面旧实现的产品权威性，但保留历史证据）：**
> - `StagingDialog` 已退出 active UI，系统级 `Capture Space` 成为未归项目材料的唯一默认工作面；
> - Canonical `extension/` 默认 `target.mode=staging`，不再自动归最近项目；
> - `43123/wake + capture-assistant.ps1` 退役，Desktop 源码改为常驻 Electron `CaptureWindow`；
> - Capture Space 可 AI 分组/摆放，并通过 Semantic Drop materialize 到已有项目；Capture blob/cache 不因投送项目被删除；
> - Windows installer / Electron 真机 Render QA 仍暂停，待工作树统一后再跑。

- Slice 1（capture/v1 安全网关 + Staging 查询增强）：DONE（`7de8bb9`）
- Slice 2（Staging 面板 + 从暂存创建项目）：DONE（`1ea92c0`）
- Slice 3（MV3 浏览器扩展：popup/右键/拖拽 dock/截图 + 扩展 token 网关）：DONE（`595bc68`）
  - 审计：`docs/audit/PHASE5_SLICE3_EXTENSION_AUDIT_20260812.md`
  - 交接：`docs/handoffs/PHASE5_FINAL_HANDOFF_20260812.md`
- **R2 桌面侧（2026-08-12 晚）**：
  - N5 桌面快速捕获（Ctrl+Alt+C 全局热键 + 剪贴板分类）：COMPLETE（`753be8f`，Test 模式 text/url/image/file 四种真实收据）
  - N7 Browser wake bridge（扩展 dragstart → Runtime Host 43123）：COMPLETE（`b710b87`，POST /wake 200 + 日志；端到端拖拽触发留人工）
  - N6 右下 Capture Assistant + N8 Native OLE 拖放：IMPLEMENTED（`cc2677f`；wake shown 日志已有，**NATIVE QA PENDING**）
  - 审计：`docs/audit/NON_GUI_R2_PHASE1_AUDIT_20260812.md`
- **R2 NATIVE QA PENDING（必须人工真机确认）**：Explorer 真实拖入 文件/文件夹/.lnk/.url、
  取消拖拽、多显示器右下角、125%/150% DPI 手感、Edge `edge://extensions` 刷新扩展后
  扩展→wake→Assistant 端到端拖拽触发
- **R2 VISUAL ACCEPTANCE PENDING**：GUI R2（扁平混合左栏 / Context 关系首页 / Signal Track /
  Mind Map / Workflow palette / OCR 拖选手感）截图已交付 `docs/audit/guir2-*.png`，等待人工视觉评审
- **Phase 5 整体仍 NOT COMPLETE**：桌面快速捕获已实现但未过真机验收（见上）；popup/右键
  "最近项目 chips"未做；截图整页拼接 DEFERRED（不做半成品）
- 浏览器扩展真机验收：BROWSER ACCEPTANCE PENDING（需人工加载已解压扩展）
- **DELETE /projects/:id 外键顺序 bug（已修复，2026-08-13）**：`runs`/`context_manifests`/
  `resource_descriptors` 必须删在 `artifact_revisions`/`artifacts` 之前（RESTRICT/NO ACTION 外键）；
  另补 mutation_change_sets / curation_operation_receipts / project_view_rail_order /
  capture_staging_items 孤儿清理。回归测试覆盖「带真实 Run + resource descriptor 的项目可删除」。
  真实验收：清掉 50 个失效测试项目（此前 5 个 500 的项目全部删除成功）。
- **中文项目 ID 打开失败（已修复，2026-08-13）**：`/projects/:id` 的 pathname 对中文 ID 是
  百分号编码串，前端未 decode 导致 catalog 比对失败（「没有找到这个项目」）；已加安全解码。
- **保存误报超时（第二阶段修复，2026-08-15；R17 于 2026-08-16 完成真机收口）**：三个 Capability 的
  Presentation SSE 已合并为每 Project 一条共享流；隐藏标签页暂停该流，恢复可见时重连并接收
  权威 snapshot。Presentation 增加应用时单调版本保护，写超时保留 pending intent；Active Context
  改为 `(projectId, workspaceId)` 独立串行队列，已发出的写不再被 effect cleanup 中止；Agent SSE
  与 4 秒 Run polling 不再双源竞争。自动测试、构建、smoke 均通过。
  - **后续批次已关闭**：Active Context / runs / proposals 已与 Presentation 汇聚到
    `GET /projects/:id/events`；Attention 取消传播、provider 总 deadline、writer origin/receipt
    与 `write_uncertain` 六态表达已落地。
  - **REAL BROWSER QA PASS**：见下方 R17 记录与对应 Handoff。
- **R17 多标签共享与真实压力验收（2026-08-16，已关闭）**：ProjectRealtime 增加
  `navigator.locks` Leader 选举与 `BroadcastChannel` 分发；同一浏览器上下文内多个标签只保留
  一个 Project SSE，能力不可用时安全退回每页一流。三标签 60 次交替拖动、Leader 退出接管、
  Local Core 监督重启与恢复后继续写入均通过；同时修复启动页命中 Core 重启窗口后永久 offline
  的一次性初始化竞态。证据：`docs/handoffs/R17_CROSS_TAB_REALTIME_AND_BROWSER_PRESSURE_20260816.md`。
- **GUI R3 Direct Manipulation（已合并 2026-08-13，`b00a30f`）**：Drop Target = Intent。
  验证：typecheck ✓ web 379/379 ✓ build ✓ Golden 12/12（1366/1440 截图）。
  剩余：**REAL BROWSER QA PENDING**——真实左键拖节点到左栏/Context/Workflow Page 的手测
  （headless 无法驱动 elementFromPoint 命中）；截图在 `docs/audit/gui-r3-*.png`。
- **R3 Correction：恢复右键投送（已合并 2026-08-13，`751b118`）**：
  右键 = 唯一 Drop gesture（source 不动/ghost/目标高亮/松手直接提交，走 R3 direct pipeline）；
  左键退回纯画布操作；未复活 DropShelf/edge-dwell/Add-Move-Continue。
  验证：typecheck ✓ web 381/381 ✓ build ✓ dispatchEvent 级 6/6；
  **真实鼠标右键拖拽 QA 留真机手测**（headless Chromium 右键 pointer 事件模拟有差异）。
- **R3.1A4–B3-r2 All-in-One 更新包（已完成本地合入，2026-08-14，未提交）**：
  - Patch SHA256：`CB9B8B6A74A771A6DC0E6D9DEB8BAE58500077770A0A2E69B7F3B4E49FAB2CF8`，与交付校验文件一致。
  - 已完成三处冲突的保留式手工合并：`App.tsx`、`ProjectCanvas.tsx`、`ContextRelationshipHomeSurface.tsx`；未覆盖既有 Rail / Light Curtain 改动。
  - 已落地 Freeform/Grid、Region→Collection、Context Graph/Signal/Mind Map、Workflow Graph + Edge-first Canvas、DotGlyph、Search/Focus 分流、Tap/Companion 与 schema 35 关系索引。
  - 验证：A4 13/13、A6 10/10、B1 11/11、B3 17/17；A5 11/12 为被 A6 主动替代的旧 Search/Focus 合并断言。Web 432/432、Local Core 394/394、Domain 5/5、Contracts 6/6；lint/typecheck/Web build/Local Core build/diff-check 通过。
  - **REAL BROWSER QA PENDING**：本轮未做真实鼠标的 Grid 重排、Region 提升、Context 三投影、Workflow 连线/关系说明、右键投送与窄窗适配手操验收。
  - 交接：`docs/handoffs/R31A4_B3R2_ALL_IN_ONE_MERGE_20260814.md`。
- **B3R3 Scene Creation Semantic Fix（已完成并加载到本地开发版，2026-08-14，未提交）**：
  - Workspace `+` 现为零表单创建 Empty Scene，继承当前 Camera，0 members，立即激活 Arrange。
  - `WorkspaceSeedMode`、Selection/Scene/Empty 创建三选一与 create-mode WorkspaceDialog 已移除；Dialog 仅保留编辑语义。
  - 验证：A4 13/13、A5 13/13、A6 10/10、B3 17/17；Web 436/436；新增 GUI E2E 1/1；typecheck/build/diff-check 通过。
  - 交接：`docs/handoffs/B3R3_SCENE_CREATION_SEMANTIC_FIX_20260814.md`。
- 计划：Phase 1–5 全链路 Golden Gate 真实浏览器串联验收（新建项目 → 拖文件 → 画布 →
  Command → Run → 审核 → 捕获 → 暂存 → 建项目/分配 → 重启恢复）

---

## 已关闭的欠账（防止重复核对）

- ~~HU-1A receipt SQLite + 预验证~~（Session 1，2026-08-11 完成）
- ~~HU-1B ChangeSet + safe revert + Reorganize 去硬删除~~（Session 2 主体，2026-08-11 完成）
- ~~Curation applyPatch 复合事务（P0-1）~~（2026-08-11 补完，HU-1 §18 全部勾选）
- ~~HU-2 SessionReadSet（P0-2）~~（2026-08-11 完成）
- ~~HU-1C FS staging + orphan sweep + late writer guard~~（Session 3，2026-08-11 完成）
- ~~HU-3A Presentation Truth Purification（P0-3 前半）~~（2026-08-11 完成）
- ~~HU-3B Presentation 边/隐藏语义正式契约 + SSE 验证~~（2026-08-11 完成）
- ~~HU-4 Spatial Retrieval~~（2026-08-11 完成）
- ~~HU-5 Boundary Guards + Late Writer~~（2026-08-11 完成）
- ~~GUI-1..7（GUI Closeout II 全阶段）~~（2026-08-11 完成，Golden 验收 25/25）
- ~~GUI R2 Direct-Assisted patch 合并 + P0 混合 Rail 顺序持久化~~（2026-08-12 完成，`8c4deb4`+`f0cf350`，重启保留 + CAS 409 真实 HTTP 验证）
- ~~Non-GUI R2 N1–N5/N7/N9~~（2026-08-12 完成；N6/N8 见活跃欠账 NATIVE QA）

## 本轮发现并已修复的隐藏欠账（2026-08-11）

- 跨项目主键撞车静默串数据（PUT /graph 幂等 upsert 不校验归属）→ 归属守卫 + 回滚
- bridge.patch 同帧互相覆盖（位置+pin 两 patch 只留后者）→ 组合 mutator
- 子组件先于父组件挂载导致恢复丢失（旧 200ms 轮询兜底被移除后暴露）→ bridge 注册事件
- 恢复被 key 同步 effect 覆盖（mirror 只 setState 不写 memory）→ 恢复同步写回 memory
- curator 契约测试停在 V1 SKILL.md、verify-retrieval.md 86 字符 stub、
  runtime-v6 依赖 process.cwd、vitest 混跑 Playwright spec（Phase E 遗留）→ 全修

---

## 纪律

1. 任何 Session 宣布完成前，对照施工包 Done 清单逐项勾选，缺一项都必须在 Handoff 的 NOT IMPLEMENTED 里写明，不允许"漏标"。
2. 上下文压缩时，先读本文件；未完成项未动就继续，已动的状态要更新。
3. 宁可慢一倍，不欠账返工。
4. 每次收到 UI/开发更新包，按 `docs/UPDATE_PACKAGE_SOP.md` 固定流程执行：校验 → 预检 → 分治合并 → 修订旧契约测试 → 全量门禁 → 冒烟 → Gate 手测 → 更新本文件与 Handoff。
# B3R4 closeout（2026-08-14）

- Selection Semantic Drop → Rail `+ 新 Scene` 已完成并通过静态、GUI E2E 与刷新恢复验收。
- 本 slice 无阻塞欠账；后续阶段能力不计入 B3R4 debt。
# B3R5 同步状态（2026-08-14）

- 已完成：共享结构嵌套守卫、Local Core 双写入口校验、Arrange / Context / Workflow 引用式 Drop、协议合同与构建回归。
- 非阻塞待验：前端总批次时对完整跨 Surface Drop 矩阵做真实浏览器逐项手操及刷新恢复取证。
- 边界：MCP / CLI / Agent 必须经 Local Core 支持写入口；不支持直接修改 SQLite。

# B3R6 / B4 全栈闭环包合入（2026-08-15）

- 已校验并合入 `LCOS_FULLSTACK_B3-CLOSED_B4-CLOSED_20260815.zip`；SHA256 为
  `1a74e89669363cf5d1d64888f7bd86477c0fc7e6fc6d47752c8878f63af99926`，与交付校验文件一致。
- 保留既有 dirty worktree，仅覆盖包内声明路径；未提交、未推送、未重写历史。
- 门禁：静态合同 119/119；typecheck PASS；Vitest 874/874；production build PASS；
  lint 无 error（既有/本包 warning 仍在）；`git diff --check` PASS。
- 合入时修复：严格 optional 类型、Attention metadata 接线、Workflow Graph 类型导入、
  B3R6 旧测试契约，以及旧 `LocalIntelligenceService(endpoint)` 到 provider-neutral runtime 的兼容。
- **REAL BROWSER QA PENDING**：包名中的 B3/B4 Closed 目前只获得代码、合同、测试与构建证据；
  用户此前反馈的 18 项 GUI 手操问题及 B4 Continuity / Context Composer 真实交互仍需独立验收。
- 交接：`docs/handoffs/B3R6_B4_FULLSTACK_INTEGRATION_20260815.md`。

# 0.1 收口 S1-S3 回补清单（2026-08-16）

S1/S2/S3 已按计划完成（`SESSION_1_CODEX_CONTINUITY_E2E.md` / `SESSION_2_HANDOFF_CONTEXT_HISTORY.md` / `SESSION_3_CONTEXT_SNAPSHOT_AUTHORITATIVE_BRANCH.md`），以下缺口未关闭，按序回补：

1. **S1 #6 真实 Return 链**：还没有一次真实 create/revise Codex Run 产生 ArtifactReturn → UI 可见 → Accept → intake。两次真链都是 analyze+reply_only（无 Return）。补一次真实 revise Run E2E。
2. **S1 Web 浏览器点击式验收**：startRunFrom 带 sessionId 的 UI 路径只有代码级验证，未做浏览器点击式真机验收。
3. **S2 Deposit Hint 真实可见性**：Handoff 进 contextDepositCandidates 只有源契约测试；cooldown + evidence 门下的真实弹出未验。
4. **S2 UI 原则打折**：rail 只显示决定/未决/产物「数量」，未显示具体内容，也未关联对应 Session。
5. **S2 记录的债**：「从选择沉淀上下文」右键流程未产出 Context（疑似 scope 持久化与 presentation mutation 时序），未根因化。
6. **未 push**：S0-S3 全部提交仍在本地 `codex/r1-vision-merge-20260812`，待用户确认后推送。

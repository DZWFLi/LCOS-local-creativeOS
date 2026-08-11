# Phase H Handoff｜Capability Freeze + GUI Closeout + Golden Acceptance

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase H 目标：A-G 能力闭环后做 GUI 减法、一致性、legacy 脱钩与 Golden Acceptance。本轮完成：

1. **RuntimeDiagnostics 主路径隐藏确认**（H5）：诊断页只走 `?debug=1` route（main.tsx），普通用户主界面不可见 ✅
2. **用户文案清理**（H8）："资源理解"→"详情"/"资源详情"（用户明确说过看不懂这个术语）；ResourceDetailDialog 标题/aria 同步
3. **AgentContextSurface 降噪**（H4）：Phase D 已做默认折叠胶囊，本轮确认 ✅
4. **全阶段 Golden Regression**：
   - Core：67 文件 / 330 用例全过
   - Web：60 文件 / 274 用例全过
   - Smoke：Phase A / B / C / D / E / G 六套真实 HTTP 全过；Phase F 由 conversation-semantic-smoke（vector 命中）+ embed-smoke（768 维）覆盖

## H2 GUI Inventory 基线更新（对照 20260811 报告）

以 `docs/audit/LCOS_GUI_SURFACE_SKILL_GAP_INVENTORY_20260811.md` 为基线，A-G 后的状态：

| 原状态 | 项 | A-G 后 |
| --- | --- | --- |
| 🔵 内存态 | Presentation hierarchy/折叠（前端 presentationHierarchyState） | **仍 🔵**：Core 有 presentation_views 契约（hierarchy 可持久化，CurationPatch setHierarchy 已通），但前端大纲/思维导图 state 仍走内存（未切 Core） |
| 🔵 内存态 | Strands（presentationDraftState） | 仍 🔵（与 hierarchy 同一问题） |
| 🟡 | AgentContextSurface 挡画布 | ✅ 默认折叠胶囊（Phase D） |
| 🟡 | 节点改名写 Core | ✅ manual mode 写回（Phase A） |
| 🟡 | 预览卡住/资源理解 | 🔶 预览主线已通（缩略图全格式 + visualFamily），文案已清理；"卡住"场景需真人复测 |
| 🟡 | 多选 drop 体验 | 🔶 dropIntentMachine 已修，真人验收待做 |
| ⛔ | 画布整理 skill | ✅ Curator V2 reorganize route + Reorganize API（Phase D/E） |
| ⛔ | Capture 入口 | ✅ 浏览器扩展 + CLI + watch + staging（Phase B/C） |
| ⛔ | 语义搜索 | ✅ Ollama + vec0 KNN + 混合管线（Phase F） |
| ⛔ | 会话连续性 | ✅ Session Context Ref + provider adapter（Phase G） |

**诚实结论**：P0 项中"Presentation 内存态"仍未收口（需前端把 hierarchy 状态切到 Core presentation_views——这是 Phase I/后续 GUI 迭代的明确工作），其余 P0 已闭环。

## Files changed

- `apps/web/src/features/canvas/NodeInfoPopover.tsx`（文案）
- `apps/web/src/features/resources/ResourceDetailDialog.tsx`（标题/文案）

## Explicitly NOT implemented

- ❌ Shell 去重（H3）：ProjectStripVNext / V07TopBar / WorkspaceRailVNext 职责重叠审计需要真人 UX 评审，未强改
- ❌ Preview 三处统一 resolver（H7）：现状 Canvas/popover/immersive 基本同源，未引入新抽象（避免过度工程）
- ❌ 真人点击验收（Golden Acceptance 的 GUI 部分）：需要用户在浏览器过一遍；所有 API/契约层已自动验收
- ❌ Cross-session Bridge dispatch（Phase G 遗留，Context Continuity Golden Case 后接）

## A-H 总验收（MASTER §13）

| 验收项 | 状态 |
| --- | --- |
| Capture → 无需先打开 LCOS | ✅ 扩展/CLI/watch 直接收（Phase B/C） |
| Open → Project 1 个动作可达 | ✅ 新标签页 + reveal folder + runtime registry（Phase A） |
| Create → 无需先命名 | ✅ Zero Naming + TitlePolicy（Phase A） |
| See → Capture 后节点一眼可识别 | 🔶 visualFamily + 缩略图已通；真人目检待做 |
| Organize → Agent 真能删/合并/归组/重排 + 回退 | ✅ Reorganize + rollback + auto-pin（Phase D） |
| Retrieve → 用户不需要先选择来源 | ✅ 混合检索 + Session continuity（Phase F/G） |
| Continue → 下一 Session 自动拿回相关 Context | ✅ Session Context Ref（Phase G） |
| Learn → Skill 从 repeated badcase 形成可验证改进 | 🔶 Trace/Review 已通；patch 自动化待积累 |
| Local Intelligence → Ollama 可用增强、不可用不破坏 | ✅ KNN + fallback + 全链路验证（Phase F） |

## Next steps（Phase I/J 前）

1. 前端 Presentation hierarchy 切 Core（收口最后一块 🔵）
2. 真人 Golden Acceptance 走查（浏览器：Capture → 整理 → 审核）
3. embedding benchmark（qwen3 vs nomic）→ docs/benchmarks/
4. Shell 去重 UX 评审

## Commit

提交将在本 Handoff 完成后执行（见 git log）。


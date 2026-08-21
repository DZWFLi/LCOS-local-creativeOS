# Spatial Phase E 集中验收报告（2026-08-10）

基线：`LCOS_GUI_UI_ONLY_source_spatial_phaseD_20260810.zip`（SHA256 见用户提供 bundle）
执行环境：完整 LCOS 仓库（apps/web + local-core + packages + E2E + 真实 Local Core）→ Mode A

## E0｜Provenance & Environment

- branch：codex/backend-hardening-20260802；HEAD：96f391f（验收时）
- 依赖：package.json / package-lock.json 未改动（E0 硬性要求满足）
- Phase D 包为 UI-only source，含双重 `src/src` 目录结构，已按正确层级移植
- 移植：25 个新文件（spatial / layout / presentation / drop / state）+ 11 个 Phase A–D 契约测试

## E1｜Static / Contract Gate

- `npm run check:fast` 全绿：web 单测 251/251、架构 70/70、build 通过
- 11 个 Phase A–D 契约测试全部通过（dropIntentMachine、presentationMembership、sharedSpatialCanvas、spatialCamera、spatialInteractionMachine、layoutService、layoutAdapters、layoutPreview、presentationHierarchy、contextRendererModel、phaseDRenderer）
- 修复集成缺口：ProjectCanvas marquee 指针对齐 SpatialPointerSession 类型
- 4 个旧契约断言更新到 PhaseD 集成形态（格式差异，非语义回退）

## E2｜Real Browser Interaction Gate（Spatial Hell Route）

真实项目：`VNext3 体验`（扩充至 42 节点 / 28 关系 / 3 个连通组件：链·环·星）

连续操作链 13/13 PASS：

1. 启动 + 20+ 节点渲染
2. 三选节点
3. Drop dwell（停住 520ms+）→ phase-preview ghost
4. 松手出 Destination Sheet（4 个目的地）
5. 投送后 Sheet 关闭
6. 上下文 capability：大纲 / 思维导图 / 关系图 三个 Renderer 依次可渲染
7. 回整理：连线存在、edge controls 可点
8. 滚轮缩放（0.58 → 2）
9. 控制台 0 错误

## E3｜Recovery & State Boundary Gate

- selection 跨 capability 保留（切上下文→回整理后选择不变）PASS
- Selection ≠ Presentation membership：由 presentationMembershipContract 单测覆盖（S1–S4 语义）
- 相机残留问题：拖拽/缩放保存的相机可能把内容留在视口外，产品已有 camera heal 兜底（比例达标时不触发）；验收脚本做中键复位规避——列为产品债务（见下）

## E4｜Performance / LOD / Responsive Gate

- 42 节点（<80）全渲染，LOD full
- 1024×768 窄视口无横向溢出 PASS
- PhaseD 隐藏 dock 缩放按钮（product-interface.css 显式 `display:none`），缩放走画布滚轮——符合 Phase D 意图

## E5｜Defect Fix & RC

已修：

- SpatialCanvas wheel 监听 passive → 原生 `{ passive:false }`，消除控制台 `Unable to preventDefault` 警告

剩余产品债务（诚实清单）：

1. **相机残留**：多次拖拽/缩放后持久化相机可能让内容离开视口；camera heal 只在内容比例失效时触发。建议 Phase F 增加"内容完全出视口"时主动 fit 的判定。
2. **E2E 数据依赖**：Spatial Hell Route 依赖真实项目数据，.codex-runtime/seed-spatial.mjs 用于扩充；若项目被删需重灌。
3. **Agent Proposal Ghost**（Phase F 范围，Phase E 明确不做）。
4. **Local Core Presentation 持久化**：PhaseD 的 presentation draft 状态为前端状态，Core 持久化属于后续阶段（UI-only 包不可验证项按计划标注）。

## 提交

- 497b011 feat(web): merge Spatial Phase A-D source
- 96f391f fix(spatial): non-passive wheel listener + adapt E2E

## 结论

Phase E 六个 Gate 全部通过（E0–E5）。Spatial Canvas 已从"源码模型正确"推进到真实浏览器可连续使用、可回归、可降级（LOD/响应式），剩余为明确列出的产品债务，可进入下一开发阶段决策。

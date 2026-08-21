# GUI R2 Direct-Assisted Merge + P0 Rail Order Audit

> 日期：2026-08-12

## Status

```text
PATCH MERGE: COMPLETE
P0 MIXED RAIL ORDER: COMPLETE
REAL TYPE/CHECK/BUILD: PASS
BROWSER FUNCTIONAL QA: PASS
VISUAL ACCEPTANCE: PENDING（截图供人工/视觉评审）
PRODUCT STATUS: NOT COMPLETE（按 handoff 约定，视觉与深度交互待评审）
```

## 1. Patch merge

- Base：`79b4394`（当前 HEAD 精确对齐）；`git apply --check` 干净，直接应用。
- 范围：16 个文件修改 + `ContextRelationshipHomeSurface.tsx` + `guiR2ProductShape.test.ts`。
- 产品形状按 GPT handoff 原样保留：扁平混合左栏、Context 关系首页、垂直 Signal Track、
  Mind Map before/inside/after、Workflow 右侧 Pages + operator palette、画布通用 URI/text 拖放。
- 未重新设计任何 GUI；未删除冲突 hunk。

## 2. 真实仓库修复

- 8 个存量契约测试按 R2 语义更新（旧 Strand 渲染带 / Outline 用户面 / 顶部 operator 表单 /
  edge-cut hidden ids / Files drop 分支断言全部对齐 R2 实际结构），非放水：
  每个更新都指向 R2 代码中真实存在的机制（`lcos-signal-segment-tools`、`lcos-workflow-operator-palette`、
  `onFilesDropped && files.length` 等）。
- schemaVersion 33 → 34 相关断言同步更新。

## 3. P0 —— 持久化混合 Project View Rail 顺序

### Requirement

- project-scoped；混合 Collection/Context/Workflow refs；CAS/versioned；restart-safe；
  stale 写拒绝；缺失 ref 确定性清理；不复制 Artifact/Presentation；不用 localStorage。

### Code path

- `apps/local-core/src/metadata-repository.ts`：schema v34 新表 `project_view_rail_order`；
  `getProjectViewRailOrder` / `saveProjectViewRailOrder`（BEGIN/COMMIT + CAS）。
- `apps/local-core/src/routes/projects.ts`：`GET/PUT /projects/:id/view-rail-order`；
  GET 按现有 workspace/scope 过滤缺失 ref；PUT 校验格式/去重/版本冲突 409。
- `apps/web/src/features/shell/workspaceRailOrder.ts`：纯排序函数。
- `apps/web/src/App.tsx`：加载/保存/冲突重载；左栏菜单上移/下移扩展为跨类别混合重排。

### Tests

- Core `project-view-rail-order.test.ts` 4 例：混合往返、CAS stale 拒绝且不破坏已提交顺序、
  重启（新 repository 同库）保留、缺失 ref 容错。
- Web `workspaceRailOrder.test.ts` 3 例：空顺序保持、跨类别排序、缺失/kind 不匹配忽略并确定性追加。
- 真实 HTTP：GET 空 → PUT v1（3 refs）→ stale PUT 409 → reload v1 → **Core 重启后 v1/3 refs 保留**。

## 4. 浏览器 Golden（R2 界面）

1440×900：

- 左栏合法 kind 集合 ✓
- Context 下关系首页 / Signal Track / 思维导图 pills ✓，无大纲 ✓
- 关系首页渲染 ✓（截图 `guir2-relationship-home-1440.png`）
- Signal Track 渲染 ✓（`guir2-signal-track-1440.png`）
- 思维导图渲染 ✓（`guir2-mindmap-1440.png`）
- 工作流画布渲染 ✓（`guir2-workflow-1440.png`）
- reload 后左栏保留 ✓

1366×768：

- 主页截图 ✓（`guir2-home-1366.png`）
- 画布 text/uri-list 真实 drop → 创建链接节点 ✓（`guir2-canvas-url-drop-1366.png`）
- 画布 text/plain 真实 drop → 创建文本节点 ✓（`guir2-canvas-text-drop-1366.png`）

## 5. Remaining Debt

- VISUAL ACCEPTANCE PENDING：左栏视觉、关系首页、Signal Track、Mind Map、Workflow 的
  最终手感/间距/图标由人工/视觉评审确认（截图已交付）。
- 深度交互（Signal Track 段拖拽、Mind Map before/inside/after、Workflow palette 拖放）
  有组件级测试覆盖；真实浏览器全手势留给人工 Golden。
- Non-GUI R2 N2-N9 按 brief 继续（Huabu audit / 桌面助手 / 原生拖放等）。

# AdFrame Day 2 审核报告（供 Buddy 审查）

审核基线：2026-07-16 18:56（北京时间）
项目路径：`E:\Codex 项目\演示demo`
审核范围：Script Review pivot 实现（版本/段落绑定、人工评审、Mock AI、决策、localStorage、对比与导出）
审核原则：只读，不修改 src

---

## 1. 总控结论

**有条件通过**。六项审查维度均已实现并形成可用闭环：V1/V2/V3 版本管理、段落编辑、Issue/Impact/Evidence/Suggestion 评审卡、Mock AI Skill 展示、Keep/Modify/Remove 决策、localStorage 自动持久化、版本对比和 Markdown/JSON/Codex Handoff 导出。

**阻塞项**：5 个 TypeScript 构建错误（`npm run build` 失败），必须修复后才能交付。详见第 7 节。

---

## 2. 版本与段落绑定

### 2.1 实现正确项

| 检查点 | 结论 |
|--------|------|
| 版本结构：`ScriptVersion.segments` 内嵌段落数组 | 通过 |
| 版本切换时段落联动回退：`selectVersion()` 自动将不存在于新版本的 segmentId 重置为 `segments[0].id` | 通过 |
| 段落编辑：`changeSegment()` 使用不可变更新，定位到正确的 `version.id` + `segment.id` | 通过 |
| 左栏 `ScriptRail`：版本列表 + 当前版本的段落导航，带状态指示（draft/reviewing/accepted/revised） | 通过 |
| 五段式结构（HOOK / HEAT SETUP / PRODUCT SETUP / COOLING PAYOFF / END CARD）在三版间共享相同 id | 通过 |
| `ScriptSegment.versionId` 字段用于评审过滤（`review.versionId === segment.versionId`） | 通过 |
| V1→V2→V3 链：`sourceVersionId` + `decisionId` + `feedbackIds` 建立追溯关系 | 通过 |

### 2.2 观察项（建议，非阻塞）

- **段落 id 硬耦合**：三版共享 `hook` / `heat-setup` / `product-setup` / `cooling-payoff` / `end-card`。若未来某版需要增删段落（如新增 PRODUCT SHOT），需确保 `selectVersion()` 的回退逻辑能处理。当前三版同 id 集合工作正常。
- **`segment.versionId` 冗余**：段落实例在 `scriptProject.ts` 里通过 `map` 手动设置 `versionId`，而 `ScriptVersion.segments` 已经嵌套在版本下。这是为了 `reviews.filter(review => review.versionId === segment.versionId)` 的便利性，设计取舍合理。
- **字幕/台词字段歧义**：`ScriptCanvas` 的第三个 textarea 绑定 `segment.dialogue ?? segment.super` 显示，但 `onChange` 只写入 `super`。若某段落有 `dialogue` 值，修改后 `dialogue` 被覆盖为 `undefined`，值会丢失。

---

## 3. 人工评审

### 3.1 实现正确项

| 检查点 | 结论 |
|--------|------|
| 评审卡模型：Issue / Business Impact / Evidence / Suggestion 四字段 | 通过 |
| 新建评审：表单支持填写全部四字段，`evidenceText` 自动预填段落信息 | 通过 |
| 状态流转：`open → accepted → resolved → open`（循环切换按钮） | 通过 |
| Decision Action：Keep / Modify / Remove 三选一，底部 toggle 按钮 | 通过 |
| 过滤：当前段落 / 全部问题（`segment` / `all`） | 通过 |
| 预置数据：4 条初始评审卡，覆盖 motivation、installation、payoff、蓝色气流 | 通过 |
| `authorType` 区分 `human` / `ai` 来源 | 通过 |

### 3.2 观察项

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 新建评审的 `category` 硬编码为 `'Human Creative Review'` | 中 | 用户无法选择其他维度（如 Product Communication、Brand Fit），所有新建卡片标记相同 category。建议改为下拉或自由输入 |
| 已存在评审卡不可编辑内容 | 中 | `issue`、`suggestion` 等字段创建后无法修改，只能修改 `status` 和 `decisionAction`。若用户打错字需删除重建 |
| `rejected` 状态跳过 | 低 | `statusFlow` 将 `rejected` 映射到 `open`，即 rejected 卡点击状态按钮会直接回到 open。这是故意的简化还是遗漏？预置数据中有一条 `status: 'rejected'` 的卡片（`review-rejected-blue-air`），但 UI 上 "rejected" 显示为状态按钮文字，点击后变 open |
| 删除功能缺失 | 低 | 没有删除评审卡的手段 |

---

## 4. Mock AI

### 4.1 实现正确项

| 检查点 | 结论 |
|--------|------|
| AI 草稿模型：`AiReviewDraft` 含 findings、originalText、humanRevision、disposition、confidence | 通过 |
| 预置数据：每个 V3 段落一条草稿，`heat-setup` 有 2 条 skill finding | 通过 |
| 展示：Skill name + finding、AI Original（只读）、Human Revision（可编辑） | 通过 |
| 处置按钮：Accept / Revise / Reject | 通过 |
| 明确标注 "Mock Skill Analysis" | 通过 |
| 无草稿时的 fallback："该版本尚未运行 Mock Skill 分析。" | 通过 |

### 4.2 观察项

| 问题 | 严重度 | 说明 |
|------|--------|------|
| AI 草稿绑定正确性 | — | `aiDraft` 通过 `versionId + segmentId` 查找，切换版本/段落时正确联动 |
| "Run Mock AI" 按钮缺失 | 低 | 符合 Day 2 范围（不接真实 API），但用户无法从 UI 触发模拟分析 |
| `disposition` 更新后不会触发生成新的 mock 数据 | 低 | Accept/Revise/Reject 仅改 disposition，不改变 findings 或 originalText。符合 mock 预期 |

---

## 5. 决策

### 5.1 实现正确项

| 检查点 | 结论 |
|--------|------|
| Keep / Modify / Remove 三个清单 | 通过 |
| 自动从评审卡同步：`changeReviews()` 触发决策更新 | 通过 |
| `nextVersionGoal` 可编辑 | 通过 |
| 无决策时自动生成 `emptyDecision()` 占位 | 通过 |

### 5.2 观察项

| 问题 | 严重度 | 说明 |
|------|--------|------|
| `unresolvedQuestions` 未渲染 | 中 | 类型定义有 `unresolvedQuestions: string[]`，预置数据有"客户是否确认尾帧文案？"，但 Decision tab 不显示此字段 |
| 决策同步逻辑只认当前版本 | 中 | `changeReviews()` 里 `scoped = nextReviews.filter(item => item.versionId === version.id)` — 若用户切换版本后再改评审卡，非当前版本的决策不会更新。但 localStorage 的 `decisions` 已存全量，无数据丢失风险 |
| `decisionSource` 静态 | 低 | `emptyDecision()` 固定为 `'ai-assisted'`，不会根据实际评审来源调整 |
| `acceptedIssues` / `rejectedIssues` 字段存在但 UI 不使用 | 低 | 同步逻辑写入这两个字段（从 `review.status`），但 Decision tab 只展示 keep/modify/remove。预置数据中有"冰块道具缺乏来源"等 accepted issue，靠 keep/modify/remove 承载 |

---

## 6. localStorage

### 6.1 实现正确项

| 检查点 | 结论 |
|--------|------|
| 四个独立 key：`adframe.script-versions.v2`、`adframe.script-reviews.v2`、`adframe.script-ai-drafts.v2`、`adframe.script-decisions.v1` | 通过 |
| 防崩溃：`loadStored()` / `saveStored()` 均 try-catch 包裹 | 通过 |
| 惰性初始化：`useState(() => loadStored(KEY, fallback))` | 通过 |
| 自动保存：四个 `useEffect` 监听状态变化即写入 | 通过 |
| 版本化 key 命名（`.v1` / `.v2`） | 通过 |

### 6.2 观察项

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 无法清除/重置数据 | 低 | 无"恢复默认"按钮，用户只能手动清除 localStorage |
| 静默失败 | 低 | `saveStored` 的 catch 块为空 — localStorage 满或禁用时无用户提示。Demo 场景可接受 |
| 中间刷新不恢复 | 低 | 若 localStorage 在运行中被外部清除，已加载到 state 的数据不受影响；刷新后恢复为 fallback 初始数据 |

---

## 7. 构建错误（阻塞）

`npm run lint` 通过（0 errors, 0 warnings）。`npm run build` 失败，5 个 TypeScript 错误：

| # | 文件 | 行 | 错误 |
|---|------|------|------|
| 1 | `App.tsx` | 99 | `ExportDrawer` 接收了 `decision` prop，但 `ExportDrawerProps` 未声明此属性 |
| 2 | `ExportDrawer.tsx` | 17 | `version.label` 不存在，应改为 `version.versionLabel` |
| 3 | `ExportDrawer.tsx` | 22 | 同上 |
| 4 | `ExportDrawer.tsx` | 44 | 同上 |
| 5 | `ExportDrawer.tsx` | 44 | `item.impact` 不存在，应改为 `item.businessImpact` |

**根因**：

- 错误 1：`App.tsx` 第 99 行传给 `ExportDrawer` 的 `decision` prop 在组件接口中未定义。`ExportDrawer` 目前不需要 decision（它从 reviews 构建导出数据），应移除该 prop。
- 错误 2-4：字段名 `label` vs `versionLabel` — `ScriptVersion` 类型定义的是 `versionLabel`，但导出代码中三处引用了 `label`。
- 错误 5：`ScriptReviewItem` 的字段是 `businessImpact`，但 Markdown 导出模板用了 `item.impact`，导致导出内容中 Impact 为 `undefined`。

**修复指引**：`App.tsx` 删除 `decision={decision}` 传参；`ExportDrawer.tsx` 中 `version.label` → `version.versionLabel`（3 处），`item.impact` → `item.businessImpact`。

---

## 8. 代码质量

### 8.1 正确项

- 数据模型清晰：`ScriptProject` → `ScriptVersion` → `ScriptSegment` 三级嵌套合理
- 状态提升模式正确：App 持有全部状态，子组件通过 props + callbacks 通信
- 不可变更新：`setVersions(current => current.map(...))` 模式一致
- 组件职责单一：Rail / Canvas / Panel / Drawer 各管一块
- CSS 变量体系完整，遵循 Day 1 视觉 Token

### 8.2 关注项

| 问题 | 位置 | 说明 |
|------|------|------|
| `decision` prop 冗余 | `App.tsx:99` | 传给 `ExportDrawer` 但组件未使用 |
| 部分 `useCallback` 缺失 | `App.tsx` | `selectVersion`、`changeSegment`、`changeAiDraft`、`changeReviews`、`changeDecision` 均未 memoize。当前无性能问题，但如果子组件使用 `React.memo` 则需要 |
| CSS `context-detail` 和 `derived-output-strip` 类在 `App.css` 中未定义样式 | 全局 | 这些类在 JSX 中使用但 CSS 文件中无对应规则块 — 当前依赖浏览器默认布局渲染，视觉效果可能非预期 |

---

## 9. 与 PROGRESS.md 的对照

PROGRESS.md 声称已完成项：
- "Human Review, Mock AI Skill analysis, Decision, V1/current comparison, local persistence, and Codex Handoff are implemented."

**验证结论**：六项功能均属实已实现。但 5 个 TypeScript 构建错误意味着 Demo 当前无法 `npm run build` 产出静态文件。

---

## 10. 建议优先修复顺序

| 优先级 | 项 | 影响 |
|--------|-----|------|
| **P0** | 修复 5 个 TypeScript 构建错误 | `npm run build` 失败，Demo 无法部署 |
| P1 | `unresolvedQuestions` UI 缺失 | 类型与数据已有，加一行渲染即可；预置的"客户是否确认尾帧文案？"是真实迭代遗留问题 |
| P2 | 新建评审卡片时可选 category | 当前全部标为 "Human Creative Review"，降低 Demo 说服力 |
| P3 | 已存在评审卡的内容编辑 | 打错字只能删卡重建 |

---

## 11. 审核结论

**有条件通过**。Day 2 的核心闭环（脚本评审、AI 辅助、决策、持久化、对比、导出）均已实现，逻辑链完整。5 个 TypeScript 错误总计改动不超过 5 行，修复后即可交付。

建议修复构建错误后直接推动 PROGRESS.md 状态更新，并准备 Day 3 的素材替换与叙事包装。

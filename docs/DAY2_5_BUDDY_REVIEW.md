# AdFrame Day 2.5 Lite — WorkBuddy 独立审查报告

审核基线：2026-07-17 11:45（北京时间）
审核范围：Day 2 构建错误修复、存储架构重构、导出抽离、Demo 重置、UI 增强
审核原则：只读，不修改 src；运行 lint 与 build

---

## 1. 总控结论

**通过。** Day 2 的 5 个阻塞 TypeScript 错误全部修复。Day 2.5 在此基础上完成了三项架构改进：存储层抽离（`demoStorage`）、导出抽离（`reviewExports`）、Demo 种子隔离（`demo/seed.ts`）。所有变更均在约束范围内——零新增依赖、零后端、零破坏性重构。

`npm run lint`：0 errors, 0 warnings（12 文件，103 规则）
`npm run build`：成功，产物 224.50 KB JS + 16.77 KB CSS（gzip: 71.75 + 3.74 KB）

---

## 2. Day 2 阻塞项修复验证

| # | Day 2 错误 | Day 2.5 修复 | 验证 |
|---|-----------|-------------|------|
| 1 | `ExportDrawer` 缺 `decision` prop | `ExportDrawerProps` 新增 `decision: DecisionRecord` | 通过 |
| 2–4 | `version.label` → `version.versionLabel` | 导出逻辑移至 `reviewExports.ts`，正确引用 `version.versionLabel` | 通过 |
| 5 | `item.impact` → `item.businessImpact` | `buildReviewMarkdown()` 正确使用 `item.businessImpact` | 通过 |

5/5 修复，`npm run build` 从失败变为成功。

---

## 3. 架构变更

### 3.1 存储层（`infrastructure/demoStorage.ts`）

**变更前**（Day 2）：4 个独立 localStorage key，4 个 useEffect 监听的散装读写。

**变更后**：单一 `demoStorage` 模块，包含：
- 单一 key：`adframe.demo-state.v1`
- Schema 版本信封：`StoredDemoState { schemaVersion, projectId, updatedAt, data }`
- `load()`：优先读新版 key；schema/项目/结构校验失败 → 尝试 legacy migration → 全部失败则回退 seed
- `save()`：原子写入整个 `ProjectState` + `DemoUiState`
- `reset()`：清除新版 + 旧版 key，写入 seed，返回 `ProjectState`

**评价**：
- ✅ 存储原子性显著提升——不会出现 versions 存了但 reviews 没存的状态撕裂
- ✅ Schema 版本化 + migration 路径为未来数据模型升级预留了空间
- ✅ `isProjectState()` 类型守卫是实在的防损坏机制（检测数组存在、嵌套 segment 结构、UI 字段类型）
- ✅ legacy key 迁移后自动清除旧 key，不留垃圾
- ⚠️ `clone()` 使用 `JSON.parse(JSON.stringify())`——对当前数据结构完全够用，但如果未来 segments 包含 Date/Function/undefined 会有丢失。当前数据模型无此风险

### 3.2 导出层（`services/reviewExports.ts`）

**变更前**：`ExportDrawer` 组件内硬编码 `buildPayload()` 和 Markdown 模板。

**变更后**：
- `buildHandoffPayload()`：接收 `decision` 参数，仅导出 `status === 'accepted'` 的评审，payload 包含 `schema_version`、`source_version_id`、`change_reason`、`creative_direction` 等完整上下文
- `buildReviewMarkdown()`：接收 `decision`，使用 `item.businessImpact`（修复了 Day 2 的 `item.impact` bug），增加 Decision 段和 Next Version Goal 段

**评价**：
- ✅ 导出逻辑与 UI 解耦，可独立测试
- ✅ Handoff payload 只传已确认（accepted）的评审，避免 Codex 收到噪音
- ✅ Markdown 增加 Creative Direction / Decision / Next Version Goal 三段，信息完整性提升
- ✅ `decision` 类型正确接入（修复了 Day 2 的类型漏洞）

### 3.3 Demo 种子（`demo/seed.ts`）

**变更前**：`App.tsx` 直接 import `scriptProject.versions` 等作为 fallback。

**变更后**：
- `DEMO_SCHEMA_VERSION = 1` 集中定义
- `DEMO_START` 默认 UI 状态：Script V2 / PRODUCT SETUP / Human Review
- `createDemoState()` 通过 `clone()` 深拷贝，避免引用污染

**评价**：
- ✅ 单点修改种子数据的入口，存储和 UI 层共享同一套默认值
- ✅ `DEMO_START` 选择 V2 + PRODUCT SETUP 而非 V3 + HOOK，更匹配"演示从有问题的状态开始"的叙事

---

## 4. 功能变更

### 4.1 Demo 重置

**实现**：顶栏新增"恢复演示数据"按钮 → 确认对话框 → `resetDemo()` → 清除 localStorage + 写入 seed

**评价**：
- ✅ 重置目标状态：Script V2 / PRODUCT SETUP / Human Review / 已有一个 open review + AI draft
- ✅ 背景遮罩 + `mousedown` 关闭 + 确认/取消双按钮，交互完整
- ✅ 重置后关闭 drawer/compare/context，UI 回到干净状态
- ⚠️ 关闭对话框时 `event.currentTarget === event.target` 的判断依赖事件冒泡——子元素点击也会触发 `mousedown`，但只有 overlay 自身触发时关闭。正确行为

### 4.2 版本隔离强化

- `EvaluationPanel` 新增 `versionReviews`：`reviews.filter(review => review.versionId === versionId)`
- `all` filter 现在显示当前版本的全部评审（而非跨版本全部评审）
- V2 新增独立评审卡 `review-v2-installation`（Product Communication，open 状态）
- V3 `decision-v3`：`decisionSource: 'human'`，区别于 V2 的 `ai-assisted` 和 V1 的 `client`

**评价**：
- ✅ 跨版本数据不再混淆——切换 V2 时只看 V2 的评审
- ✅ V2 有自己的评审卡和 AI draft（product-setup），V3 也有自己的——Demo 叙事更完整
- ✅ decision 的三个来源（client / ai-assisted / human）覆盖了 Demo 要展示的三种决策类型

### 4.3 ExportDrawer 增强

**新增功能**：
- `copyState`：点击 Codex Handoff 显示 "Copied" ✅ 或 "Copy Failed"
- 文件名含 `{projectId}-{versionId}`（`portasplit-thinker-script-v3-review.md`）
- MIME type 加 charset（`text/markdown;charset=utf-8`）

**评价**：
- ✅ 复制反馈是 Demo 演示场景的基本礼仪
- ✅ 文件名版本化，多次导出不会覆盖

### 4.4 CSS 增强

| 新增样式块 | 用途 |
|-----------|------|
| `.reset-demo` / `.reset-overlay` / `.reset-dialog` | 重置按钮 + 确认弹窗 |
| `.context-detail` / `.direction-summary` | Creative Direction 展开区（三列布局→1100px 单列） |
| `.segment-intent` | 段落 Purpose + Product Role 行（两列网格） |
| `.segment-locks` | 段落底部 Locked Elements 标签行 |
| `.derived-output-strip` | 底部衍生输出状态栏 |
| `.segment-status` 扩展 | 新增 `reviewing`、`accepted`、`revised`、`draft` 颜色 |
| `.review-card.status-rejected` | rejected 卡片降低不透明度 |
| 1100px 响应式 | `.direction-summary` 单列、`.derived-output-strip` 隐藏文本 |

**评价**：
- ✅ 所有新增 CSS 遵循现有 Token 体系（var(--accent)、var(--line-soft) 等）
- ✅ 1100px 响应式规则完整覆盖新增的 `direction-summary` 和 `derived-output-strip`
- ⚠️ `context-detail` 在 JSX 中使用但在 Day 1 时未定义样式——Day 2.5 补齐了样式

---

## 5. 数据模型检查

### 5.1 新增类型

```typescript
DemoUiState { selectedVersionId, selectedSegmentId, activeTab }
ProjectState { versions, reviews, aiDrafts, decisions, ui }
StoredDemoState { schemaVersion, projectId, updatedAt, data }
```

### 5.2 数据完整度

| 数据实体 | V1 | V2 | V3 | 完整性 |
|---------|-----|-----|-----|--------|
| Script Versions | 5 segments | 5 segments (modified 0-2) | 5 segments (inherits V2) | 通过 |
| Reviews | 0 | 2 (`v2-installation`, `rejected-blue-air`) | 3 (`motivation`, `installation`, `payoff`) | 通过 |
| AI Drafts | 0 | 1 (`product-setup`) | 5 (all segments) | 通过 |
| Decisions | 1 (`decision-v1`) | 1 (`decision-v2`) | 1 (`decision-v3`) | 通过 |

### 5.3 数据一致性

- ✅ V2→V3 sourceVersionId 链完整
- ✅ V2 `feedbackIds: ['review-v2-installation']` 对应 review id
- ✅ V3 `feedbackIds: ['review-installation', 'review-payoff']` 对应两个 V3 review
- ✅ V2 `decisionId: 'decision-v2'` / V3 `decisionId: 'decision-v3'` ——但 V1 的 `decisionId` 仍为 `undefined`（V1 有 `decision-v1` 但未关联）。属于数据完整性问题，但不影响功能（版本选择和决策绑定走 `versionId`）

---

## 6. 差异对比（Day 2 → Day 2.5）

| 维度 | Day 2 | Day 2.5 |
|------|-------|---------|
| TypeScript Build | ❌ 5 errors | ✅ 0 errors |
| 存储方案 | 4 个 localStorage key，散装 useEffect | 1 key + envelope + migration + corruption guard |
| 导出方案 | 组件内硬编码 | `reviewExports` 独立服务层 |
| Demo 种子 | 散落在 App.tsx / scriptProject.ts | `demo/seed.ts` 单文件 |
| 重置功能 | 无 | 确认对话框 + 全量重置 |
| 版本隔离 | 跨版本评审显示 | 按 versionId 过滤 |
| 导出反馈 | 无 | Copied / Copy Failed 状态 |
| V2 评审数据 | 1 条（rejected） | 2 条（+ v2-installation） |
| V2 AI Draft | 无 | 1 条（product-setup） |
| V3 Decision | 无 | decision-v3 (human source) |

---

## 7. 未修复的 Day 2 观察项（延续）

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 新建评审 category 硬编码 `'Human Creative Review'` | 低 | 延续 Day 2 状态，非 2.5 范围 |
| 已存在评审卡不可编辑内容 | 低 | 延续，非 2.5 范围 |
| `unresolvedQuestions` 不在 Decision tab 渲染 | 低 | 延续，但 `decision-v3` 有 unresolved 数据 |

以上三项 Day 2 已记录为 P2/P3，Day 2.5 未覆盖属正常范围控制。

---

## 8. 新风险

| 风险 | 严重度 | 说明 |
|------|--------|------|
| `clone()` 使用 JSON 序列化 | 低 | 当前数据纯 POJO，无风险。若未来数据模型加 Date/Function/undefined，需替换为结构化深拷贝 |
| Legacy migration 是一次性的 | 低 | `load()` 只在首次匹配到 legacy key 时执行 migration。如果用户在不同浏览器打开，legacy 数据不在，fallback 到 seed 是正确行为 |

---

## 9. 审核结论

**通过。** Day 2.5 Lite 按预期修复了 Day 2 的 5 个 TypeScript 构建错误，并在不扩大范围的前提下完成了存储/导出/种子三项架构抽离。lint 和 build 均通过，零新增依赖。

建议：可在 PROGRESS.md 中将当前 milestone 从"Day 2.5 Lite — reusable Script Review hardening"推进到"Day 2.5 完成，准备 Day 3 素材替换"。

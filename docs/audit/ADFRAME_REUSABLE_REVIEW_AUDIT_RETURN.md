# ADFRAME_REUSABLE_REVIEW_AUDIT_RETURN

> status: `complete`  
> handoff_id: `OS-ADFRAME-REVIEW-AUDIT-001`  
> project_id: `local-creative-os`  
> task_id: `os-adframe-review-audit-20260719-001`  
> audited_repo: `E:\Codex 项目\演示demo`  
> audited_branch: `refactor/reusable-review-core`  
> audited_head: `2a526f833f76d5f441bca81426ddbae9316a082f`

## 1. 执行摘要

旧 AdFrame Prototype 可以为 Local Creative OS 的 Sprint 1 Review 模块提供三类来源：

1. **领域词汇与最小对象骨架**：Review、Decision、Script Version、Script Segment、Locked Elements；
2. **可提取的纯构建逻辑**：Review Markdown 与 Codex Handoff payload builder；
3. **交互参考**：段落级 Review、AI Draft 的 Accept / Revise / Reject、版本来源对比、Keep / Modify / Remove 决策。

但旧仓库**没有真实 Repository、Evaluator 或 Runtime Adapter**。它只有：

- 一个直接访问浏览器 `localStorage` 的 Demo Storage 对象；
- 一组写死在 fixture 中的 Mock AI Draft；
- 一个复制 JSON 到剪贴板的 CopyOnly Codex Handoff；
- 三个禁用状态的 Derived Output Placeholder。

因此不建议把旧仓库作为 OS 模块直接搬迁。建议迁移策略是：**以类型和行为为参考，提取纯函数，围绕 OS 自己的 Workspace/Artifact/Runtime 边界重新实现端口；旧三栏 App Shell、Demo 状态编排、PortaSplit fixture 和样式全部留档。**

建议 Sprint 1 最小 Review 范围只包含：

- ReviewItem（绑定目标对象/版本/可选片段）；
- Decision（Keep / Modify / Remove + 下一版目标）；
- Locked Elements 的只读快照与传递；
- 人工 Review 的创建、状态更新和决策动作；
- AI Draft 作为外部 Evaluator 结果的可选输入，但 Sprint 1 不宣称真实 Evaluator；
- Markdown / JSON Handoff 的纯构建器；
- Repository 与 Runtime 仅定义端口，由 OS 实现，不复用旧实现。

## 2. 文件级 KEEP / EXTRACT / REWRITE / ARCHIVE

### KEEP

| 文件 | 结论 | 用途 | 注意 |
|---|---|---|---|
| `docs/SCRIPT_OBJECT_DEFINITION.md` | KEEP（参考） | 作为脚本、版本、段落、Review、Decision 的业务语义来源 | 不是运行时 schema；迁移前须与 OS 领域模型对齐 |
| `docs/PORTASPLIT_REVIEW_LOGIC.md` | KEEP（案例证据） | 作为广告脚本 Review rubric 与真实案例依据 | 只作为案例/fixture，不进入 OS 核心领域 |
| `docs/CASE_STUDY_DAY3.md` | KEEP（证据） | 说明产品闭环、Mock 边界和业务价值 | 不作为实现规范 |
| `docs/qa/day3-1366.png`、`docs/qa/day3-1024.png` | KEEP（视觉证据） | 保留旧原型可运行与布局证据 | 不作为 OS UI 目标 |

### EXTRACT

| 文件 | 可提取内容 | 入口与依赖 | 提取要求 |
|---|---|---|---|
| `src/types/evaluation.ts` | `ScriptReviewItem`、`DecisionRecord`、`DecisionAction`、Review/AI disposition 等领域词汇 | 无运行依赖，但同时混入 Brief、Project、Demo UI、StoredDemoState | 按 OS bounded context 拆分；不要整文件复制 |
| `src/services/reviewExports.ts` | `buildReviewMarkdown` 与 handoff payload 的纯构建思路 | 依赖 Demo schema version、`ScriptProject`、`ScriptVersion`、Review/Decision/AI Draft | 改为接收 OS DTO；schema version 归 OS contract；增加显式返回类型与测试 |
| `src/components/ScriptCanvas.tsx:38-41` | 通过 `sourceVersionId + segment.id` 找基线段落的 Compare 行为 | 基线查找实际位于 `App.tsx:34-35`；UI 依赖旧 Canvas 和 CSS | 只提取 compare selector/use case，不迁移组件 |
| `src/App.tsx:75-89` | Review 变化后派生 Decision 的行为意图 | 强依赖 React state、当前 version 闭包和旧 Decision 结构 | 提取为纯 domain service；修正规则后测试，不复制原函数 |

### REWRITE

| 文件 | 原因 | OS 建议 |
|---|---|---|
| `src/infrastructure/demoStorage.ts` | 直接绑定 `localStorage`、固定单 key、导入 Demo seed、包含 legacy migration、失败静默；不是 Repository | 定义 `ReviewRepository`/`DecisionRepository` 端口，由 OS Local Core 选择实现；旧文件只参考 envelope 与 fallback 思路 |
| `src/components/EvaluationPanel.tsx` | Review/AI/Decision 三种职责集中；导入 `EvaluationTab` 自 `App`；内部直接产生 ID、时间和状态流；视图与 mutation 绑定 | 拆成 OS 的 ReviewList、ReviewEditor、AiDraftDecision、DecisionSummary；通过 use case/commands 驱动 |
| `src/components/ScriptCanvas.tsx` | Brief、Locked、Compare、脚本编辑、Review 数量和 Placeholder 输出混在单组件；依赖旧内容布局 | OS 只复用 Review target anchor、Locked snapshot、Compare slot 的交互概念，按 OS Shell 重写 |
| `src/components/ExportDrawer.tsx` | 浏览器下载、Clipboard 和旧固定 Drawer 强耦合；Codex 只是复制 JSON | UI 重写；纯 builder 与下载/复制 adapter 分离；Runtime handoff 必须走 OS 自有端口 |
| `src/App.tsx` | 全部状态所有权、选择器、派生逻辑、持久化、Reset、旧三栏编排集中；静态 singleton project | 不迁移；用 OS composition root、repository/use case 和既有 Shell 重新组装 |

### ARCHIVE

| 文件 | 原因 |
|---|---|
| `src/data/scriptProject.ts` | PortaSplit fixture、Mock AI、Review 和 Decision 写死在同一文件；只适合作为 demo seed/测试夹具 |
| `src/demo/seed.ts` | 专用于 Demo Reset，且以 JSON stringify/parse 克隆；不属于生产初始化 |
| `src/components/ScriptRail.tsx` | 旧项目版本/段落导航与三栏 Shell 强耦合；OS 应使用自身 Workspace/Artifact 导航 |
| `src/App.css`、`src/index.css` | 旧 App Shell、固定三栏、固定底部 Drawer 和 AdFrame 视觉 token；不是 OS 目标架构 |
| `src/main.tsx`、`vite.config.ts`、`index.html` | Prototype 启动壳，不是可复用 Review 模块 |
| `src/assets/*`、`public/*` | Demo 品牌与视觉资产，不构成 Review 能力 |
| `docs/DAY*`、`docs/DEMO_SCRIPT*`、`docs/VISUAL_TOKENS_PROPOSAL.md` | 项目过程、验收与展示材料；保留追溯但不迁移为 OS 实现 |

## 3. 能力、入口、依赖、状态所有权与 App Shell 耦合

| 能力 | 实际入口 | 状态所有权 | 依赖 | Shell 耦合 | 能力性质 |
|---|---|---|---|---|---|
| Human Review 创建 | `EvaluationPanel.tsx:32-49` | `App.tsx` 的 `reviews` state | 当前 version/segment、Date.now | 高 | **真实 Demo 能力** |
| Review 状态更新 | `EvaluationPanel.tsx:6,28-30,79-83` | `App.tsx` | 组件内固定 `statusFlow` | 高 | **真实但规则简化** |
| Keep/Modify/Remove | `EvaluationPanel.tsx:83` | Review item + App 派生 Decision | `changeReviews` | 高 | **真实 Demo 能力** |
| Decision 派生 | `App.tsx:75-89` | `decisions` state | 当前 version 闭包、所有 version reviews | 高 | **真实但边界泄漏** |
| Decision 编辑 | `EvaluationPanel.tsx:97-102` | `App.tsx` | 只可编辑 nextVersionGoal | 高 | **部分真实** |
| Locked Elements | `ScriptCanvas.tsx:31-34,55` | 静态 project/version data | Brief 与 Segment 两级数组 | 中 | **只读展示/传递**，不是约束引擎 |
| Script Version | `ScriptRail.tsx`、`App.tsx:20,32,58-62` | `App.tsx` | 静态 `scriptProject` + local state | 高 | **真实 Demo 能力** |
| Segment 编辑 | `ScriptCanvas.tsx:43-58`、`App.tsx:64-68` | versions state 内嵌 segments | 当前 version | 高 | **真实 Demo 能力** |
| Compare | `App.tsx:34-35`、`ScriptCanvas.tsx:38-41` | UI `compareOpen` | `sourceVersionId` + 相同 segment id | 中高 | **真实但仅 action 文本对比** |
| AI Skill 分析 | `scriptProject.ts:45-48`、`EvaluationPanel.tsx:89-95` | `aiDrafts` state | 写死 fixture | 高 | **Mock** |
| AI Accept/Revise/Reject | `EvaluationPanel.tsx:51-53,92-95` | `aiDrafts` state | 当前 Mock draft | 高 | **真实处置交互，输入为 Mock** |
| Persistence | `demoStorage.ts`、`App.tsx:19,41-56` | 浏览器 localStorage | Demo seed、固定 key、浏览器环境 | 中高 | **真实 Demo persistence**，不是 Repository |
| Markdown/JSON 导出 | `reviewExports.ts`、`ExportDrawer.tsx:16-39` | 无独立状态 | 当前项目/版本/Review/Decision | UI 中高、builder 低 | **真实客户端导出** |
| Codex Handoff | `ExportDrawer.tsx:30-31,39` | copyState 仅组件内 | Clipboard API + payload builder | 高 | **CopyOnly**，无执行 |
| Repository | 无 | 无 | 无 | 无 | **不存在** |
| Evaluator | 无真实实现 | 无 | 仅 fixture Mock | 无 | **不存在；Mock only** |
| Runtime Adapter | 无 | 无 | 无 | 无 | **不存在** |
| Shot List / Prompt Pack / Vendor Brief | `ScriptCanvas.tsx:61` | 无 | disabled buttons | 高 | **Placeholder** |

## 4. 领域类型重复与边界泄漏

### 4.1 Demo/UI 类型进入领域文件

`src/types/evaluation.ts:116-134` 将 `DemoUiState`、`ProjectState`、`StoredDemoState` 与 Review 领域对象放在同一文件。UI tab、选中版本、localStorage envelope 都不应属于 OS Review Domain。

### 4.2 Project 状态有两个所有者

- 静态 `scriptProject` 持有 Brief、Creative Direction 和初始 versions：`scriptProject.ts:22-34`；
- `App.tsx:20-23` 又分别持有可变 versions/reviews/aiDrafts/decisions。

导出时通过 `{ ...scriptProject, versions }` 临时拼回项目（`App.tsx:102`）。这说明 Prototype 没有稳定 aggregate/repository 边界。

### 4.3 Decision 是 Review 的重复投影，存在漂移风险

`DecisionRecord` 保存 accepted/rejected issues 以及 keep/modify/remove；同样信息已存在 Review 的 status、issue、decisionAction。`App.tsx:75-89` 在 Review 变化时重算部分字段，但 `nextVersionGoal` 等又允许独立编辑。Decision 应明确为：

- 可重复计算的 projection；或
- 经确认后独立持久化的 decision artifact。

不能同时模糊承担两者。

### 4.4 Locked Elements 多处重复且未强制

Locked Elements 同时存在于：

- `BriefSnapshot.lockedElements`；
- `ScriptSegment.lockedElements`；
- `DecisionRecord.keep`；
- handoff payload 的 `keep` 合并数组（`reviewExports.ts:20`）。

当前没有去重、来源标记、继承规则或编辑保护。它们只是展示和文本传递，不是可执行约束。

### 4.5 Review 与 AI Draft 重叠

`ScriptReviewItem.authorType` 支持 `ai`，同时又有独立 `AiReviewDraft`。Fixture 中也确实存在 AI authored Review（`scriptProject.ts:41-42`）。OS 需要明确：AI 输出是 proposal/draft，还是已经进入 Review ledger 的 item；建议只有人工接受后才转为 Review/Decision evidence。

### 4.6 Script/Shot 边界泄漏

`ScriptReviewItem` 包含未使用的 `shotId`（`evaluation.ts:78`），但 V0 明确是 Script Review。该字段是未来范围泄漏，Sprint 1 应改为通用 `targetRef` 或暂不纳入，而不是携带未实现 Shot 模型。

### 4.7 App 类型反向被组件依赖

`EvaluationPanel.tsx:3` 从 `App.tsx` 导入 `EvaluationTab`。叶子组件依赖 composition root，是直接的层级反转证据。

### 4.8 Compare 依赖隐式 ID 约定

来源段落通过相同 `segment.id` 匹配（`App.tsx:34-35`）。Fixture 在不同版本复用 `hook/product-setup` 等 id，但 `ScriptSegment` 自身又含 `versionId`。这不是稳定 identity 设计；分支、拆段、合段时会失效。

## 5. 真实能力、Mock、CopyOnly、Placeholder

### 真实能力（限定为浏览器 Demo）

- 人工 Review 创建；
- Review status 与 Keep/Modify/Remove 修改；
- 脚本段落编辑与版本选择；
- 基于 sourceVersionId 的简化 Compare；
- AI Draft 的人工 Accept/Revise/Reject 处置记录；
- localStorage 持久化、schema envelope、legacy key 迁移与 Reset；
- Markdown/JSON 下载；
- Clipboard copy。

### Mock

- 所有 AI findings、originalText、confidence；
- 所谓 Skill 分析没有模型、规则引擎或执行器；
- PortaSplit 项目、Review、Decision 和时间均为 seed/fixture 数据。

### CopyOnly

- Codex Handoff：仅把 JSON 写入剪贴板（`ExportDrawer.tsx:30-31`），没有创建 Codex Task、Bridge Task 或 Runtime run。

### Placeholder

- Shot List；
- Prompt Pack；
- Vendor Brief；
- “尚未运行 Mock Skill 分析”的 fallback 文案不是执行入口；
- Repository、Evaluator、Runtime Adapter 不是 Placeholder 文件，而是**完全缺失**。

## 6. Repository、Evaluator 与 Runtime 边界判断

### Repository

`demoStorage` 不应命名或迁移为 Repository。它直接：

- 依赖浏览器 global `localStorage`；
- 导入 `createDemoState`；
- 使用固定全局 key；
- 把迁移、校验、fallback、reset 混在一个对象；
- 静默吞掉读写错误。

可参考的只有 envelope 字段（schemaVersion/projectId/updatedAt/data）与旧 key 迁移意识。

### Evaluator

仓库没有 Evaluator 接口、实现、运行记录或错误模型。AI output 来自 `scriptProject.ts` 的常量。Sprint 1 若需要 AI，只应先定义 `ReviewEvaluator` 端口和 `EvaluationDraft` DTO，不复用任何“实现”。

### Runtime Adapter

仓库没有 Runtime Adapter。`buildHandoffPayload` 是序列化器，`navigator.clipboard.writeText` 是浏览器 copy adapter，二者均不等于 Codex/Bridge Runtime。OS 必须使用自身 Runtime 设计，不从 Prototype 推导执行语义。

## 7. 测试与运行证据

### 本次只读检查

- `npm run lint`：通过，无输出错误；
- `git diff --check`：通过；
- 审计前后 `git status --porcelain=v1`：均为空；
- 分支：`refactor/reusable-review-core`；
- HEAD：`2a526f833f76d5f441bca81426ddbae9316a082f`。

本次没有运行 `npm run build`，因为该命令会重写旧仓库 `dist/`，违反“不得修改旧仓库任何文件”的只读约束。

### 仓库已有证据

- `docs/DAY3_REVIEW_REPORT.md:36-48` 记录 lint/build、Edge Headless 1366×768 与 1024×768、QA 截图；
- `docs/DAY2_5_BUDDY_REVIEW.md:13-26` 记录独立 lint/build 验证；
- `docs/qa/day3-1366.png`、`docs/qa/day3-1024.png` 为最终视觉证据；
- `README.md:118-122` 记录演示能力与 Mock 边界。

### 可复用测试

**没有自动化测试文件。** `rg --files -g '*test*' -g '*spec*'` 无命中。现有 QA Checklist、阶段报告和截图属于人工证据，不能迁移为回归测试。

### Sprint 1 必补测试

1. Review create/update/status/decisionAction 的 domain tests；
2. Decision projection 或 confirmation 的一致性测试；
3. Locked Elements 合并、去重、来源与不可覆盖规则；
4. Compare 对新增/删除/拆分段落的匹配测试；
5. Markdown/Handoff builder snapshot/schema tests；
6. Repository contract tests（保存、加载、版本不兼容、损坏数据、隔离）；
7. AI Draft 接受/修改/拒绝后转入 Review ledger 的测试；
8. Copy/export adapter 的失败反馈测试。

## 8. 建议迁移顺序与预计文件数量

### Phase 1：领域最小核（约 5–7 个文件）

1. `review-item` 类型；
2. `decision` 类型；
3. `review-target-ref` 类型；
4. `locked-constraint-snapshot` 类型；
5. Review → Decision 的纯 service；
6. domain tests 1–2 个文件。

先决定 Decision 是 projection 还是 confirmed artifact，再编码。

### Phase 2：端口与纯构建器（约 5–7 个文件）

1. ReviewRepository port；
2. Evaluator port（无真实实现也可）；
3. Runtime/Handoff port；
4. Markdown builder；
5. Handoff DTO builder；
6. builder/contract tests 2 个文件。

### Phase 3：OS UI 适配（约 4–7 个文件）

1. Review list/card；
2. Review editor；
3. AI draft disposition；
4. Decision summary/editor；
5. Compare slot 或 adapter；
6. UI integration tests。

预计 Sprint 1 总量：**14–21 个新增/修改文件**。这个估算不包含 OS 已有 Shell、Workspace、Local Core 或 Bridge 的工作，也不替它们设计架构。

### 主要风险

1. 把 Demo `ProjectState` 整包迁移，导致 OS 再次出现双状态源；
2. 把 Decision 的重复字段当成 canonical state，产生漂移；
3. 将 Locked Elements 当普通字符串数组，无法追溯来源与优先级；
4. 将 Mock AI 误接成真实 Evaluator；
5. 将 JSON CopyOnly 误称为 Runtime integration；
6. Compare 继续依赖相同 segment id，无法支持真实版本演进；
7. 先迁 UI 再定领域边界，把旧三栏结构带入 OS。

## 9. 明确不应迁移

- `App.tsx` 的整体状态编排与 Reset Demo；
- 三栏 `app-shell/workspace` 布局；
- `ScriptRail` 导航结构；
- 固定底部 Export Drawer 形态；
- AdFrame `App.css/index.css` 和视觉 token；
- PortaSplit `scriptProject` 生产数据；
- `initialAiDrafts` 作为 AI 能力；
- `createDemoState` 与 JSON stringify/parse clone；
- localStorage 固定 key 和 legacy key；
- `statusFlow` 的循环式按钮逻辑；
- Review ID 的 `Date.now()` 生成方式；
- `EvaluationTab` 从 App 反向导出的依赖；
- `shotId` 这一未实现边界；
- disabled Derived Output 按钮；
- Clipboard Copy 当作 Codex/Bridge Runtime；
- 旧 Prototype 路由、启动壳和品牌资产；
- 旧 QA 截图作为 OS 视觉目标。

## 10. Sprint 1 决策建议

建议 OS 把 AdFrame 视为**业务规则与交互证据库**，不是代码库模块。

Sprint 1 最小 Review 模块应先回答四件事：

1. Review 绑定的 canonical target 是什么；
2. Decision 是可派生投影还是确认后的 artifact；
3. Locked Elements 的来源、继承和覆盖规则是什么；
4. Repository/Evaluator/Runtime 各自只暴露什么端口。

完成上述决策后，优先重写领域类型和纯 builder；最后才在 OS 现有 Shell 中重做 UI。这样能保留 AdFrame 最有价值的广告评审闭环，同时避免旧 Prototype 的布局、Mock 和 Demo 状态侵入 Local Creative OS。

## 11. 验收与阻塞

- Return 文件：`E:\Codex 项目\OS开发\docs\audit\ADFRAME_REUSABLE_REVIEW_AUDIT_RETURN.md`；
- 旧仓库无代码迁移、无依赖变化、无 Git 操作；
- 审计结论均对应具体文件、行号或运行证据；
- 未对 Canvas、Workspace、Local Core 或 Bridge 做目标架构设计；
- 阻塞：**无**；
- 任务书元数据仍显示 `draft_not_dispatched/not_dispatched`，但本报告以正式 delegation 中的 `task_id=os-adframe-review-audit-20260719-001` 为准。

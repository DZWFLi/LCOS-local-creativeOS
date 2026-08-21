# Frontend Interaction Foundation 成熟度记录

> 检查节点：2026-07-21 22:00 Asia/Shanghai（三轮前端成熟度检查点，不是 Alpha 最终交付）  
> Git 基线：`1f85697`  
> 轨道范围：`tests/e2e`、测试 Fixture、测试配置、本文档  
> 执行状态：旧主链浏览器验收已执行；R1 Canvas 输入手感新决策已写入脚本，待前端回传后真实复验。

## 1. 当前判定

**状态：Foundation needs_revalidation**。

旧版 `apps/web` 已可运行，且明确标记为纯前端 Fixture；打开、查看、Command、Run 与 Accept 旧主链可操作。用户反馈 Canvas 手感不合格后，中键平移、Space+左键精确创建、Drop 定位、placeholder、可编辑边、Dock/相机与 Hover/Press 已成为新的优先验收范围，尚无真实浏览器证据，因此不能沿用旧版 `pass`。

状态机以最新工作区的复验结论为准；早期 Return/Accept 的 `completed` 提前显示、Retry stale timer 与 Compare→Activity 均已通过复验。

## 2. 已建立的验收资产

- `tests/e2e/frontend-alpha-acceptance.md`：R1/R2/R3 黑盒成熟度检查脚本；
- `tests/e2e/fixtures/portasplit-alpha/manifest.json`：不含用户文件的受控 PortaSplit Fixture 合同；
- 稳定 selector/role 契约：避免测试绑定 DOM、CSS class、坐标或组件 state。

### 当前组件里程碑口径

当前只验 UI Spec 的前端组件与状态：每个可见控件须有真实前端响应，Fixture 必须持续标注，禁止死按钮。矩阵已覆盖 Workspace 删除/New Run、本地图片 Drop、六类节点、Inspector、Command、Run、异常态、双分辨率、键鼠与 Reduced Motion。真实后端不在本阶段范围；仅检查 UI 通过显式 Adapter/Contract 留口且不冒充 Runtime。

### P0/P1 独立最小浏览器验收（2026-07-20）

环境：`http://127.0.0.1:5173/`、Codex In-app Browser、`1366×768`、纯前端 Fixture。未运行完整质量链。

| 项目 | 实测 | 证据 / 结论 |
|---|---|---|
| 单选 Delete 与清边 | pass | 实测节点 `8 → 7`、边 `7 → 6`，并显示“已删除 1 个 Fixture 节点及连接边”。 |
| 多选 / Shift / Backspace / 框选组拖 | pass（最新复验） | 框选实际选中 `brief`、`reference` 两节点；组拖后两节点均位移 `+65,+55`；框选后 Delete 实测节点 `8 → 6`、边 `7 → 5`。早期 Shift 单点证据已失效。 |
| 输入框保护 | unverified | Composer 输入框已实际聚焦；当前浏览器控制面不能可靠保持 Space 键同时点击 Canvas，待具备可信 chord pointer 序列后复验。 |
| 锚点空白创建三类节点、自动连线、取消 | pass（最新复验） | 从 Working 输出锚点拖至空白区出现菜单；Command、Note、Context 各自令节点 `8 → 9`、边 `7 → 8`；取消后维持 `8/7` 且菜单归零。 |
| Workspace 删除、保留至少一个、内容不删 | pass（最新复验） | 点击“删除 Explore”出现 ConfirmDialog，确认后 Explore 消失、剩余 Workspace 为 3，并显示删除 Toast；此前 failure 为 ConfirmDialog 修复前页面。 |
| New Run / Composer / Not persisted | pass | 右上 New Run 打开 Composer，输入框获焦，且同时显示 `Prototype Data · Runtime not connected` 与 `Prototype session · Not persisted`。 |
| 图片 Drop 真缩略图 / 非图片 PREVIEW UNAVAILABLE | pass（HTML5 File payload） | Playwright 以有效 PNG File 与 DOCX File 触发 Canvas drop；`fixture-image.png` 进入 Fixture image preview，`fixture.docx` 渲染 `PREVIEW UNAVAILABLE`、文件名与 pending Local Core 提示。未通过 OS 桌面原生拖拽器件注入，但实际 Drop handler、Object URL 与预览分支已执行。 |
| 1366×768 / Console | pass | 首屏 Canvas、Dock、Mini-map、Composer 可见；相关 error/warn 为 0。 |

**最新回传：**Workspace ConfirmDialog、框选/组拖/批删、锚点空白创建与 File payload Drop 已独立复验。CSS v0.2 整合前，不对旧视觉切片作通过判定。

Drop 证据：Playwright session `foundation-drop-check` 的 [1366 截图](/E:/Codex%20项目/OS开发/tests/e2e/output/playwright/page-2026-07-20T11-04-05-265Z.png) 与 [语义快照](/E:/Codex%20项目/OS开发/tests/e2e/output/playwright/page-2026-07-20T11-03-13-978Z.yml) 可见 `fixture-image.png` 的 Fixture image preview，以及 `fixture.docx` 的 `PREVIEW UNAVAILABLE`。Playwright CLI 的 `run-code` 包装器在 Drop dispatch 后返回了自身 `__fn__ is not a function`，但页面副作用、语义快照与 console（App errors/warnings=0）均已实际确认；该包装器错误不归因于前端应用。

### CSS v0.2 替换后独立复验（2026-07-20）

环境：`http://127.0.0.1:5173/`、Codex In-app Browser、`1366×768` 与 `1440×900`、纯前端 Fixture。仅执行本 CSS 切片相关浏览器验证；未跑完整质量链。

| 检查项 | 实测 | 实际证据 |
|---|---|---|
| `styles.css → interaction.css` 导入顺序 | pass | `apps/web/src/main.tsx` 先导入 `styles.css`，再导入 v0.2 `interaction.css`。 |
| Porcelain Canvas / 节点材质 | pass | 1366 实测 Canvas 为暖白低饱和底色与环境光；节点为瓷白渐变，预览槽有双层 inset shadow。 |
| 无粗左条 / 节点 Hover 不位移 | pass | 实测节点 `border-left=0.8px`（普通 1px 边框），hover `transform=none`；Hover 仅增加阴影/边框反馈。 |
| 浮动 Inspector / 六类节点 | pass | 1440 实测 Relations Inspector 为 `position:absolute`、`z-index:50`、宽 410px；Source、Working、Generated、Context、Process/Run、Decision 均可见，并保留 Current/Draft/Pending 等 Fixture 状态。 |
| 银线 non-scaling / 动画限制 | pass（本静态切片） | 实测 `vector-effect: non-scaling-stroke`；默认历史线 `animation=none`。CSS 仅对 running/selected/return 类边定义流动动画。 |
| Workspace intent 环境光 | partial | 实际切换并读到 Explore/Build/Decide/Understand 的 intent 与不同 glow；`blank` 为 CSS fallback，当前 UI 未提供可操作的第五 intent。 |
| 1366×768 / 1440×900 | pass | 两个 viewport 首屏 Canvas、Dock、Mini-map、节点、Composer/Inspector 可用；1440 无横向 overflow。 |
| 150 / 300 LOD | pass | `?perf=150`：150 nodes / 149 edges、`lod-simplified`；`?perf=300`：75 个总览代表节点 / 0 edges、`lod-overview`、明确 Fixture 徽标。 |
| Reduced Motion | pass | 以 CDP 真实模拟 `prefers-reduced-motion: reduce`，媒体查询匹配，节点 transition 实测为 `1e-06s`。模拟已在检查后复位。 |
| Console | pass | App 相关 console error/warn 为 0；浏览器插件自身 Statsig 网络超时未出现在 App tab logs，非应用错误。 |
| P0/P1 交互无回退 | pass（最新交互复验） | 单选 Delete 清边、ConfirmDialog 删除、框选/组拖/批删、锚点三类创建/取消均通过；File payload Drop 真实执行图片 Object URL 与非图片 unavailable 分支。 |

**结论：**CSS v0.2 材质与降级策略可用，未发现节点 Hover 位移或银线缩放回退；最新 P0/P1 修复已消除此前 Workspace 删除阻断。Foundation 仍需继续以真实长链使用检验成熟度；原生 OS 桌面拖放路径尚未单独自动化，但 HTML5 File Drop 分支已真实执行。

### 完整 Fixture 状态链独立最小验收（2026-07-20）

环境：`http://127.0.0.1:5173/`、Codex In-app Browser、`1366×768` 与 `1440×900`。仅执行状态链相关浏览器操作，未跑完整质量链。

| 项目 | 实测 | 证据 / 结论 |
|---|---|---|
| New Run progressive disclosure | pass | New Run 打开 Composer；Instruction 获焦，Target/Context 先呈现，`Skill / Executor / Output` 点击后再展开具体值。 |
| queued → running → waiting_input → review | pass | 同一动态 `RUN-044` 依次可见；waiting_input 显示 35% / 30% 选择，选择 35% 后到 review。 |
| Return / Compare / Retry | pass（可点性） | Return 生成 `当前提案_RUN-044_AI.pptx` 与 Compare；Retry 回到 queued，并保留 Command/Context。 |
| Accept Current / Checkpoint | pass（可点性） | Accept 后生成 `Current v7 · Accepted from RUN-044`；Checkpoint 可创建并显示“Checkpoint 已创建”。 |
| failed | pass | waiting_input Activity 内“模拟执行失败”令 pill 进入 `RUN-044 · failed`，并提供 Retry。 |
| Inspector Relations → Preview → Back | pass | 双击 Working 开 Relations；打开 Brief Preview 显示 `PPT · 第 5 页 / 12`；Header Back 返回同一 Relations Inspector。 |
| 连续操作清理 | pass（已测对象） | Inspector 流程结束时 Overlay=0、temporary edge=0、anchor menu=0。 |
| Fixture / Runtime 标识 | pass | App Shell 与 Composer 都有 Prototype Data / Runtime not connected / Not persisted 文案。 |
| 1366×768 / 1440×900 / Console | pass | 两尺寸首屏可用，1440 无横向 overflow；App console error/warn=0。 |
| 状态真相 | 已由最新复验取代 | 本表为修复前历史证据；请见下方“状态真相修复复验”。 |

死控件：本轮状态链涉及的 New Run、Advanced disclosure、35%/30%、Return、Retry、Accept、Checkpoint、failed Retry、Relations、Preview、Back 均有可观察的前端响应，未发现死按钮。

修复前失败项已由最新工作区复验取代；Retry 稳态与 Inspector Activity 已在后续复验通过，见下方更新。

注意：本轮以可访问名称/角色执行；交接所列的大部分 `data-testid` 尚未实际提供，后续自动化仍应补齐稳定契约。

### 状态真相修复复验（最新工作区，1366×768）

| 验收点 | 结果 | 实测证据（同一 `RUN-044`） |
|---|---|---|
| Return 后状态 | pass | Run pill 与 Run node 都是 `RUN-044 · review`；Artifact 卡为 `Pending Return Zone`；Toast 为“Artifact Return 已落入 Pending Return Zone · Run 仍处于 review”。 |
| Accept 后状态 | pass | Run pill 与 Run node 都是 `RUN-044 · completed`；Artifact 卡为 `Current v7 · Accepted from RUN-044` / `Current`；Toast 为“已接受为 Current Revision · Run completed”。 |
| Retry 的新 ID / 初始状态 | pass（瞬时） | 点击后立即为新 `RUN-045 · queued`；Run node 同步为 queued；Toast 为“Retry 已创建 · 新 Run queued · 保留原 Command 与 Context”。 |
| Retry 无残留 `waiting_input` | pass（最新复验） | Retry 新建 `RUN-045 · queued`；等待 2.6 秒仍是 queued，Run pill/Run node 均无 `waiting input`。 |
| Inspector Activity | pass（最新复验） | Compare 点击 `activity` 后切为一个 Activity Inspector，标题为 `RUN-045`，显示 queued；DOM 中 Inspector navigation=1、Activity panel=1。 |
| Command / Toast | partial | Command 在启动 Run 后关闭，无法作为该三阶段的持续状态面；三次 Toast 与 pill/node/card 一致。 |
| Console | pass | 本链 App error/warn 为 0。 |

本表记录浏览器 DOM 状态与 Console 结果，只代表 Fixture 前端演示，非 Runtime 已接通证明。

## 3. 浏览器执行门

### Canvas 手感新基线（待前端回传）

| 新验收项 | 当前状态 | 下一次浏览器判定 |
|---|---|---|
| 中键平移且左键不误平移 | 未验证 | 中键拖 Canvas 相机移动；左键拖空白区保持不动。 |
| Space+左键精确创建 Command | 未验证 | 空白 Canvas 点击点生成 Command；输入聚焦时不得触发。 |
| 文件 Drop、三类 placeholder | 未验证 | 文件在释放点生成；Command/Note/Context 可创建、选择、删除。 |
| 自定义线与实时跟随 | 未验证 | 锚点创建、选中、删除、重连；拖节点实时随动。 |
| Fixture 边同一模型 | 未验证 | 初始边与新边都可编辑，不能一方写死。 |
| Dock/相机/反馈/Reduced Motion | 未验证 | 收展、Add、Active、聚焦和 Hover/Press；reduced motion 不减损可操作性。 |

### Canvas 成熟度切片（待 v0.3 回传）

| 新验收项 | 当前状态 | 下一次浏览器判定 |
|---|---|---|
| 持续框选与组操作 | 待回传 | 框选结束保留 `selection-bounds`；Shift 更新；组拖；空白/Esc 清除。 |
| 空视口定位内容 | 待回传 | 相机进入无节点区域显示“定位内容”；点击后真实 fit 全部有效 node bounds。 |
| 六类节点 resize | 待回传 | 单节点 resize、Shift 保比例、min/max clamp；边/Overlay 跟随；尺寸信息密度可读。 |
| v0.3 视觉约束 | 待回传 | 无粗左色条；普通按钮无彩色/虹彩滥用；一行一个 primary；Inspector 单列信息流。 |
| 单列 Inspector | 待回传 | Preview→Relations→Context→Activity 仅显示有内容 section；折叠、关系点击、单实例 Back、Compare 临时扩展。 |
| 跨分辨率与无回退 | 待回传 | 1366×768、1440×900、Reduced Motion、Console；上述既有 P0/P1 交互无回退。 |

旧的 `C` 创建 Command 与 Space+Drag 平移规则，已被用户新决策覆盖；详细脚本见 `tests/e2e/frontend-alpha-acceptance.md` 的「Canvas 手感优先验收」。

本轮 URL：`http://127.0.0.1:5173/`；浏览器：Playwright CLI Chromium session `frontend-alpha`。

| 运行 | 目标 |
|---|---|
| A | 1440×900，执行完成；主要 Golden Path 实测 |
| B | 1366×768，执行完成；Dock 收拢、Canvas 与 Inspector 主内容可见 |
| C | reduced motion，旧 CLI 会话未完成；已由 CSS v0.2 复验的真实浏览器媒体模拟补测通过 |

浏览器链实测：Workspace Build 聚焦、单击 180ms Overlay、双击 Relations Inspector、Esc、C、Target/Context 3→2、queued→running→waiting_input→review、动态 `RUN-044`、Return、Compare、Accept Current、Checkpoint、刷新恢复与 Console。

证据路径（本机 Playwright CLI 输出）：

- `tests/e2e/output/playwright/page-2026-07-20T05-25-17-622Z.png`：1440×900 初始 Canvas；
- `tests/e2e/output/playwright/page-2026-07-20T05-28-28-809Z.png`：Accept 后 Current v7 与 Checkpoint 建议；
- `tests/e2e/output/playwright/page-2026-07-20T05-28-57-871Z.png`：1366×768 Compare 视图；
- `tests/e2e/output/playwright/page-2026-07-20T05-31-58-507Z.png`：1366×768 Checkpoint 后状态；
- `tests/e2e/output/playwright/console-2026-07-20T05-24-53-206Z.log`：浏览器 console；错误与 warning 查询均为 0。

### 实测结果

| 项目 | 结果 | 说明 |
|---|---|---|
| 1440×900 Canvas / Workspace | pass | Build 可切换为相机语义；无路由跳转。 |
| 单击、双击、Inspector 栈、Esc | pass | Overlay 出现；双击只打开一个 Relations Inspector；Esc 返回。 |
| Command Target / Context | pass | Target 独立呈现；排除参考图后 Context 由 3 变 2。 |
| queued / running / waiting_input / review | pass | 实测动态 `RUN-044`，选择 35% 后继续到 review。 |
| Artifact Return / Compare | pass | 返回文件为 `当前提案_RUN-044_AI.pptx`，Compare 可见。 |
| Accept Current / Checkpoint | pass（局部） | Accept 后生成 `Current v7 · Accepted from RUN-044`，Checkpoint 提示可操作。 |
| Run 状态机 | deferred | 生成 Artifact Return 时状态已显示 `RUN-044 · completed`，Accept 尚未执行；不影响当前 Run/Accept 操作，也未覆盖 Current。 |
| failed | partial | Activity 有“模拟执行失败”入口和 failed 文案；本轮主链未单独驱动该入口。 |
| 节点拖拽 / 连线、Mini-map | partial | Pointer 拖拽与 Mini-map 控件已实际操作；未记录可比较的前后坐标/边路径，不能判完整回归通过。 |
| 刷新恢复 / localStorage | pass（Fixture 边界） | 刷新回到初始 Fixture；localStorage 为空，未把 Project/Run 真相存入浏览器。 |
| Reduced Motion | pass（CSS v0.2 切片） | 真实媒体模拟匹配 reduced；节点 transition 为 `1e-06s`。尚未重跑全部 Golden Path。 |
| Console | pass | errors=0、warnings=0；仅有 React DevTools info。 |

## 4. 质量门记录

正式验收时依次记录实际结果：

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

2026-07-20 本轮实际 `npm run check` 通过：lint、typecheck、Vitest（5 files / 10 tests）、build（1781 modules）与 smoke 全部 exit 0。该结果只证明当前 Foundation Fixture 工程质量门，不证明 Local Core/Bridge/真实文件闭环。

## 5. Buddy / Bridge 边界

本对话当前工具面不提供 Bridge MCP 的 `create_task`/状态工具，未派发 Buddy 外围核对任务。

## 6. 三轮成熟度检查点输出

2026-07-21 22:00 仅输出以下 Foundation 成熟度信息，不宣布 Alpha 完成：

1. 可体验版本与 R1/R2/R3 各自变化；
2. 每轮已验证、未验证与阻断项；
3. 仍缺能力（尤其真实 Runtime/文件/恢复边界）；
4. 为重新冻结 Alpha Scope 提供建议，而非作出正式验收判定；
5. 证据保存在批准的测试输出位置，Fixture 不触碰用户资产。

## 7. 下一步

待前端 v0.3 回传后，本轨道优先独立复验本节 Canvas 成熟度切片；不再以四 Tab Inspector 作为标准。既有 R1 稳定后再依序复验 R2 的组织完整性与 R3 的状态闭环/双分辨率/连续使用；检查点同时给出 Alpha Scope 重新定义建议。

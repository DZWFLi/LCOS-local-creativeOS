# Frontend Interaction Foundation 成熟度检查脚本

> 基线：`1f85697`  
> 执行对象：`apps/web` 的 Frontend Interaction Foundation；不适用于根目录旧 AdFrame Demo  
> 定位：这是交互骨架的三轮成熟度检查，不是 Alpha 验收或 Alpha Scope 承诺。
> 证据规则：每步记录实际 URL、浏览器、viewport、输入、截图/录屏路径、console、结果；没有浏览器实际操作即为“未验证”。

## 0. 前置

1. 使用受控 PortaSplit Fixture，禁止连接真实项目目录或真实 Bridge 写入。
2. 启动 Frontend Interaction Foundation 与其受控 Local Core/Runtime stub（若该阶段尚未接 Runtime，界面必须明确 `Prototype Data`/`Fixture`）。
3. 2026-07-21 22:00 三轮成熟度检查点做完整运行：`1440×900`、`1366×768`，Windows 100% 缩放；另做一次 reduced motion。日常小改动只运行受影响的主交互、启动检查与 console 检查。
4. 浏览器打开后记录首屏与 console；console error 必须为 0。
5. 每一步只能通过用户可见控件、键盘或 Mini-map 操作推进，不用 DevTools、URL 状态注入或刷新跳关。

## 1. 稳定测试契约

实现必须提供语义角色、可见名称或以下稳定 `data-testid`；不依赖 DOM 层级、CSS class、像素坐标或组件内部 state：

```text
project-tab-portasplit
workspace-understand | workspace-build
canvas | canvas-node-<fixture-id>
minimap | minimap-viewport | minimap-fit
node-status-overlay | inspector | inspector-back | inspector-close
selection-toolbar | command-node | command-target | command-context-count
selection-bounds | canvas-locate-content | canvas-node-resize-<node-id>
canvas-command-placeholder | canvas-note-placeholder | canvas-context-placeholder
canvas-pan-surface | canvas-drop-zone | node-anchor-<node-id>-<anchor>
canvas-edge-<edge-id> | edge-delete | edge-reconnect-source | edge-reconnect-target
context-lens | context-item-<fixture-id>
run-<run-id> | run-status-queued | run-status-running
run-status-waiting-input | run-status-review | run-status-failed | run-status-completed
artifact-return-<artifact-id> | changed-files | compare | accept-current | retry
checkpoint | activity
fixture-reset | reduced-motion-state
```

缺失稳定契约本身是测试阻塞；测试轨道不以 selector hack 绑定实现细节。

## 2. Fixture

固定 Project 为 `PortaSplit · 夏季节能 Campaign`，节点与行为由 `fixtures/portasplit-alpha/manifest.json` 定义。

Fixture Reset 必须：

- 只写测试临时目录；
- 创建全新 Project 状态，不复用上一次 Run、布局或 Preference；
- 输出 Fixture manifest hash 与测试根路径；
- 不写入 `.creative-os`、用户源文件或仓库产品数据。

Fixture 状态必须在 App Shell 中持续可见（例如 `Prototype Data` / `Fixture`）。所有仅为前端演示的 Run、文件、错误和恢复状态必须明确标注为 Fixture，不得暗示已经连接真实 Local Core、Bridge 或本地文件写入。

## 2.1 前端组件验收矩阵

当前目标是完成 UI Spec 的全套前端组件与状态，并为未来 Adapter/Contract 保留清晰边界；本矩阵不要求真实后端。每个可见、可操作控件至少要有一个真实前端状态变化、导航、创建、删除、选择或可理解的 disabled/coming-soon 反馈。无响应控件即为死按钮，阻断该组件里程碑。

| 组件/状态 | 最小真实前端响应 | 验收范围 |
|---|---|---|
| App Shell / Fixture 标识 | Project、Fixture 标识与当前 Workspace 同时可见 | 1440×900、1366×768；不伪装 Runtime |
| Workspace Dock | 收起/展开、Overview、Active、Add、删除确认、计数/状态、相机聚焦 | 鼠标与键盘；删除不得删除项目文件或真实数据 |
| Canvas / Mini-map | 中键平移、左键选择/拖动/框选、Mini-map 相机同步与 Fit | 拖动不粘滞；无误触平移 |
| 创建与 Drop | Space+左键精确创建 Command；Command/Note/Context placeholder；本地图片 Drop 按释放坐标生成前端节点 | 输入焦点优先；图片仅作为 Fixture/UI 预览，不能冒充已导入真实文件 |
| 节点六类 | Source、Working、Generated Draft、Context、Process、Decision 均有可区分形态、图标、文本与状态 | 灰度仍可区分；选择、Hover、Press 可见 |
| 关系/连线 | Fixture 初始边与新建边同一数据模型；锚点创建、选中、删除、重连；节点移动实时跟随 | 不得把初始边作为不可编辑装饰 |
| Inspector / Overlay | 单列相关信息流、单实例、局部 Back 栈、关闭、预览/关系/状态入口 | 无内容 section 隐藏；折叠与关系点击可操作；Compare 在同一 Inspector 临时扩展；`?`/Enter 细节入口一致 |
| Command | Target/Context 明确、编辑反馈、Cmd/Ctrl+Enter New Run | `C` 不创建 Command；输入框不触发 Canvas 快捷键 |
| Run / Activity | New Run、动态 ID、queued/running/waiting_input/review/completed/failed、Retry、Return、Compare、Accept、Checkpoint | 全部可以是 Fixture 状态机，但每个动作都必须可见可回退/可解释 |
| 异常与空态 | empty、loading、error、disconnected、conflict、preview 失败 | 结构化文案和可行动作；不假装成功 |
| 运动与反馈 | 所有主要按钮、节点、边、Dock、Mini-map、Inspector、Command 有 Hover/Press/键盘焦点 | `prefers-reduced-motion: reduce` 保持功能与焦点，移除持续装饰动效 |
| Adapter / Contract 留口 | UI 仅依赖显式前端 adapter/contract；无真实后端时展示 Fixture 来源 | 不调用真实文件系统、Bridge 或数据库；不得把 Fixture 当 Runtime |

组件里程碑浏览器执行顺序：先逐项点击/键鼠操作以排除死按钮，再在 1440×900、1366×768 复验布局，最后以 reduced motion 复验动作与焦点。日常只跑变更行对应的最小检查；跨组件里程碑才跑完整质量链。

## 3. R1 — Canvas 输入手感（待真实浏览器回归）

以下项目优先于旧主链。每项需在 1440×900 完成；布局/可见性相关项另在 1366×768 复验。无浏览器连续操作、截图/录屏、console 记录即为未验证。

| ID | 操作 | 通过条件 | 证据 |
|---|---|---|---|
| I01 | 在无节点 Canvas 区域以鼠标中键拖动 | 只有中键平移相机；左键拖 Canvas 不触发相机平移 | `I01-middle-pan` |
| I02 | Space + 左键单击空白 Canvas | 在释放/点击的精确画布坐标生成 Command placeholder；输入框获得焦点时此快捷键不触发 Canvas 创建 | `I02-space-command` |
| I03 | 将受控 Fixture 文件拖入 Canvas 并在两个不同位置释放 | 每次均在释放坐标创建文件节点；不落到固定原点/默认位置 | `I03-file-drop` |
| I04 | 在空白 Canvas 分别创建 Command、Note、Context | 三类 placeholder 均可创建、可选择、可删除；类型同时以图标/形态/文案区分 | `I04-placeholders` |
| I05 | 从节点锚点拖至另一节点锚点 | 创建自定义边；边可选择、删除，且可调整或重连 source/target | `I05-edge-edit` |
| I06 | 拖动带自定义边的任一节点 | 所有相连自定义边在拖动期间实时跟随；松开后连接关系不丢失 | `I06-edge-follow` |
| I07 | 比较 Fixture 初始边与 I05 新边 | 两者均以同一可编辑边数据模型渲染并支持相同的选择、删除、重连能力；不得把 Fixture 边写死为装饰 | `I07-edge-model` |
| I08 | Dock 收起/展开、Add Workspace、切换 Active、切换 Workspace | 所有操作可见、可逆；Add 生成新 Workspace；Active 有明确状态；切换触发对应相机聚焦 | `I08-dock-camera` |
| I09 | 对 Canvas、节点、锚点、边、Dock、Command 控件逐一 hover/press | Hover 与 Press 都有可见反馈，不仅依赖颜色；键盘焦点可见 | `I09-feedback` |
| I10 | 启用 `prefers-reduced-motion: reduce` 后复测 I01/I05/I06/I08 | 无持续装饰动效；拖动、连线、相机和状态反馈仍可感知且可操作 | `I10-reduced-motion` |

### 3.1 已被用户新决策覆盖的旧规则

- 旧的 `C` 创建 Command 规则已废止；Canvas 新建 Command 的唯一验收入口是 **Space + 左键单击空白 Canvas**。`C` 不得在 Canvas 上隐式创建 Command。
- 旧的 **Space + Drag 平移**规则已废止；Canvas 平移的验收入口是 **鼠标中键拖动**。Space 修饰键仅用于上述 Command 创建，且输入焦点内不触发。

### 3.2 Canvas 成熟度切片（待 v0.3 回传后真实浏览器验证）

| ID | 操作 | 通过条件 | 证据 |
|---|---|---|---|
| C01 | 空白区框选两个以上节点后松开 | `selection-bounds` 持续可见并包围当前选择；不会在 pointerup 消失。 |
| C02 | Shift+点击增减选择，再组拖 | bounds 随选择更新；所有已选节点同向移动；空白点击与 Esc 都清除选择/bounds。 |
| C03 | 中键拖相机至空视口 | 出现“定位内容”；点击后真实 fit 到全部有效 node bounds，不是固定坐标或仅隐藏提示。 |
| C04 | 对 Source、Working、Generated、Context、Process、Decision 各执行单节点 resize | 每类节点均可 resize；Shift 保比例；最小/最大尺寸 clamp；相连边与 Overlay 实时跟随；尺寸信息密度随大小变化且仍可读。 |
| C05 | 检查 v0.3 节点与控件 | 无粗左色条；普通按钮不使用彩色/虹彩；每行至多一个 primary；Inspector 是单列纵向流。 |
| C06 | Preview→Relations→Context→Activity | 只显示有内容的 section；可独立折叠；关系条目可点击；Back 保持单实例；Compare 只在同一 Inspector 临时扩展。 |
| C07 | 1366×768、1440×900、Reduced Motion | 无横向遮挡/回退；所有上述交互可用；reduced motion 不移除选择、resize、fit 或焦点反馈；Console error/warn=0。 |

## 4. R2 — 工作组织完整性

R2 聚焦 Workspace Dock、节点分类、关系类型、Command Target/Context、Inspector 导航，以及仅限 UI 偏好的可恢复前端工作现场。以下连续链同时保留 R1 通过后的组织回归。

| # | 操作 | 断言 | 证据 |
|---:|---|---|---|
| 1 | 打开 PortaSplit | 一个 Project、一张 Canvas；Understand 激活；Inspector 关闭 | `S01-default` |
| 2 | 切换 Build | 相机移动/聚焦，无页面路由切换 | `S02-workspace` |
| 3 | 执行 I01–I08 Canvas 手感链 | 中键平移、精确创建、文件 Drop、可编辑边与 Dock/相机全部通过 | `S03-canvas-handling` |
| 4 | 拖动 Mini-map 视口并 Fit | 主相机同步；Fit 回到有效节点范围 | `S04-minimap` |
| 5 | 单击 Working 节点 | 立即选中；约 180ms 后 Overlay；Canvas 布局不变 | `S05-overlay` |
| 6 | 立即双击同一节点 | 单击 Overlay 不闪现或被取消；只开一个 Relations Inspector | `S06-relations` |
| 7 | 打开关联文件 Preview，再 Back | 单实例局部栈；PPT 第 5 页占首屏 ≥65%；Back 回 Relations | `S07-preview` |
| 8 | Esc | Inspector/局部栈按优先级退出 | `S08-esc` |
| 9 | 由 Space + 左键创建的 Command 设置 Target/Context | Target 与 Context 明确分离；不通过 `C` 隐式创建 | `S09-command` |
| 10 | 打开 Context Lens，排除参考图 | Context 从 3 变 2，Command 同步更新 | `S10-context` |
| 11 | Command 内按 Cmd/Ctrl+Enter | 创建 queued Run；Canvas 其他位置按该键不创建 Run | `S11-queued` |
| 12 | 进入 running | 当前 Run 状态与动态 runId 可见；最多两条持续边动画 | `S12-running` |
| 13 | 触发 waiting_input 并选 35% | 同一 runId/conversation 继续到 review；无静默跳过 | `S13-waiting-input` |
| 14 | 检查 review/Return | Changed Files=1 modified；Return 绑定当前动态 runId；进入 Pending Return Zone | `S14-review-return` |
| 15 | Compare | 在当前 Inspector 扩展 Compare，不产生第二 Inspector | `S15-compare` |
| 16 | Retry | 前一 attempt、Changed Files 与 Artifact 保留；新 attempt 可追溯 | `S16-retry` |
| 17 | Accept Current | 生成 Current v7 Revision；Draft 标签消失；AI 来源和父 Revision 保留 | `S17-accept` |
| 18 | Create Checkpoint | 保存关联 Run/Context/Change Set；completed Run 收拢 Activity | `S18-checkpoint` |
| 19 | 刷新/重启受控前端 | 仅恢复 Fixture 允许的 Workspace、viewport、UI preference；不以 localStorage 恢复 Project Graph 或 Run 真相 | `S19-recovery` |

## 5. R3 — 日常可用成熟度

R3 覆盖完整状态闭环、错误反馈、快捷键一致性、双分辨率、视觉层级与连续使用稳定性。六类 Run 状态与失败路径属于本轮，而不是当前 Foundation 已完成的能力声明。

每个状态均须单独截图，并至少验证可见文案、图标/形态、可行动作及动态 runId：

```text
queued → running → waiting_input → review → completed
                       └────────→ failed
```

- `waiting_input`：显示问题、选择和取消；选择形成同一 Run 的 continuation。
- `failed`：显示结构化错误摘要、Retry/降级入口；Command、Context 与旧 attempt 不丢失。
- `completed`：只能在用户 Accept 后出现，执行器不得从 running 直接完成。

## 6. R3 Failure Path

| ID | 注入 | 必须断言 |
|---|---|---|
| F01 | executor unavailable | 结构化失败/可恢复状态；不显示成功 |
| F02 | Bridge/SSE 断线 | 断线提示；重连后按 sequence 回放，无重复 Run |
| F03 | 外部改写目标 hash | stale → waiting_input；新版本/覆盖留回滚/取消三选一 |
| F04 | 并发同路径写 | 第二写者不进入 running |
| F05 | Artifact Return 无目标 | Pending Return Zone，保留动态 runId |
| F06 | Preview 失败/文件缺失/无权限 | Missing/Stale/Error 可理解；原生打开/Retry 可用；界面不崩溃 |
| F07 | migration/restart 恢复失败 | 停止危险写入；显示 RECOVERY_REQUIRED 或结构化失败；不得静默 completed |

## 7. R3 可访问性、视觉与性能

- 1366×768 无横向溢出、文本截断或 Inspector 覆盖主操作；
- 灰度下六类节点仍可区分；关键文本 ≥12px；
- reduced motion 关闭持续银线，保留状态变化和焦点可见；
- 键盘覆盖 Enter、Space+左键、Cmd/Ctrl+Enter、Esc；输入焦点内 Space+左键不创建 Canvas Command，焦点不逃逸 Overlay/Inspector；
- 记录 20/80/150/300 节点的响应、内存和 LOD；80 完整目标 60fps、150 简化 ≥45fps、300 聚合 ≥30fps；
- 点击反馈 ≤100ms；Workspace 相机 320–520ms；App Shell ≤1s、Canvas ≤3s 为实测目标。

## 8. 日常验证与阶段质量门

日常小改动只需执行与变更直接相关的最小验证：能启动、受影响核心交互可操作、无阻断 console error，并按需要运行局部 typecheck/unit/smoke。

仅在跨轨整合、稳定 Git 提交、阶段报告和 2026-07-21 22:00 三轮成熟度检查点时，必须记录以下真实 exit code：

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

日常非核心失败可记录后移；打开、拖动、查看、Command、Run、Accept 阻断则判 `needs_fix`。不得用 build、静态截图或 Mock 状态代替真实核心交互。三轮检查结果只描述 Foundation 的可体验程度，不得用作 Alpha 已完成声明。

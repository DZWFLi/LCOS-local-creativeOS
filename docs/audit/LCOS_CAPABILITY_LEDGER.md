# LCOS Capability Ledger v1.0

> 版本：v1.0  
> 日期：2026-08-03  
> 审计基线：`codex/backend-hardening-20260802 @ 1a95b5c`  
> 审计方：WorkBuddy (task_702b2800)  
> 来源：`LCOS_JULY_PLAN_FULFILLMENT_GAP_AND_BUDDY_WORK_ORDER_20260803.md`

## 阅读指南

| 列 | 含义 |
|---|---|
| ID | 工作单中的能力编号 |
| GUI | 用户可在浏览器中真实操作 |
| Core | Local Core 持久化/API/逻辑成立 |
| Bridge | Light Bridge 任务生命周期成立 |
| CLI | `lcos` CLI 命令成立 |
| MCP | stdio MCP 工具成立 |
| Skill | `lcos-project-context` Skill 文档与实现一致 |
| E2E | 完整浏览器→Core→Bridge→Agent 闭环成立 |
| 状态 | ✅ 已兑现 / 🟡 部分兑现 / 🟠 接口存在 / 🔴 未兑现 / ⚫ 已被替代 |

---

## A. GUI、Canvas 与用户可触达性

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| UI-01 | 单击选择/双击预览 | ✅ | — | — | — | — | — | — | ✅ 双击文件→右侧预览，双击 Scope→进入关系（实测 E） |
| UI-02 | 右侧 Artifact Workbench | ✅ | — | — | — | — | — | — | ✅ 单实例/预览⇄概览/Esc 关闭（实测 E） |
| UI-03 | 统一 Viewer Host | ✅ | — | — | — | — | — | — | ✅ Viewer Registry 统一入口；DOCX 走诚实 fallback（DATA-04 未变） |
| UI-04 | Editor Host 预留 | ✅ | — | — | — | — | — | — | ✅ 接口已预留，无假编辑器（E） |
| UI-05 | 三处共用 ActiveContext | 🟠 | ✅ | — | — | 🔴 | — | 🟠 Core PUT 存在，Web 未写回 |
| UI-06 | 功能可见性 | 🔴 | — | — | — | — | — | 🔴 入口分散，无命令面板 |
| UI-07 | Checkpoint | ✅ | ✅ | — | — | — | — | 🔴 | ✅ 按钮真实写 Core，重启后存在（F） |
| UI-08 | Feedback/Decision | 🟡 | — | — | — | — | — | 🟡 Note 存在，结构化操作不完整 |
| UI-09 | Diff / Compare | 🟡 | — | — | — | — | — | 🟡 仅卡片式 ReviewSurface |
| UI-10 | 失败恢复入口 | 🔴 | — | — | — | — | — | 🔴 无恢复派发 UI |

## B. Run Output Intent 与结果生命周期

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| RUN-01 | create/revise/analyze 真实产品语义 | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | 🔴 | 🟡 Intent 显式必填（D），CLI/MCP 已传，浏览器链待 F |
| RUN-02 | analyze 零文件 | 🟠 | ✅ | ✅ | — | — | — | 🔴 | 🟠 Core/Bridge 零文件路径成立（B-1），GUI 展示待 F |
| RUN-03 | create 多 Artifact | 🔴 | ✅ | ✅ | — | — | — | 🔴 | 🟠 Return Group 成立（B-2），GUI/E2E 待 F |
| RUN-04 | revise 绑定 Target+Base | 🟡 | ✅ | ✅ | — | — | — | 🟡 | 🟡 派发前 Guard 成立（B-3），GUI 消歧缺失 |
| RUN-05 | Provider 不覆盖源文件 | ✅ | ✅ | — | — | — | — | ✅ | staging 隔离成立 |
| RUN-06 | Adapter Registry | — | ✅ | — | — | — | — | 🔴 | ✅ Intent×Kind×MIME（B-3），unsupported 派发前失败 |
| RUN-07 | expectedOutputs 反映真实 | — | ✅ | ✅ | — | — | — | 🔴 | ✅ 三 Intent 各自合同（B-1/2/3） |
| RUN-08 | ResultEnvelope 三种 Intent | 🟠 | ✅ | ✅ | — | — | — | 🟠 | 🟠 Ingestion 三路成立，浏览器链待 F |
| RUN-09 | Retry=New Run | 🟡 | 🟡 | — | — | — | — | 🟡 | 基础存在，GUI 未完整 |
| RUN-10 | RunEvent/Activity | 🔴 | 🔴 | — | — | — | — | 🔴 | 无 durable Event 存储 |
| RUN-11 | waiting_input 恢复 | 🔴 | 🔴 | — | — | — | — | 🔴 | Fixture 存在，真实未闭合 |
| RUN-12 | Mutation 不绕过 Accept | 🟠 | 🟠 | — | — | — | ✅ | 🟠 | Guard 未完全封死 |

## C. Runtime Host、Bridge 与执行可用性

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| RT-01 | Launcher 管理 Core+Bridge+Web | — | ✅ | ✅ | — | — | — | 🔴 | ✅ 实测三端口在线（Slice C） |
| RT-02 | GUI 关闭 Core/Bridge 仍运行 | — | ✅ | ✅ | — | — | — | 🔴 | ✅ 实测关 GUI 仅停 Web（Slice C） |
| RT-03 | 无 CMD 窗口 | — | ✅ | ✅ | — | — | — | 🔴 | ✅ 隐藏启动+文件日志（Slice C） |
| RT-04 | 托盘宿主 | 🔴 | — | — | — | — | — | 🔴 | 无桌面托盘 |
| RT-05 | Bridge 崩溃恢复 | — | ✅ | ✅ | — | — | — | 🔴 | ✅ 限次退避重启+崩溃循环保护，实测恢复（Slice C） |
| RT-06 | Bridge 唯一写路径 | 🟡 | 🟡 | ✅ | — | — | — | 🟡 | Legacy 路径未盘 |
| RT-07 | Capabilities Handshake | 🟠 | 🟠 | ✅ | — | — | — | 🟠 | GUI/Adapter 未使用 |
| RT-08 | WorkBuddy 主动取件 | 🟡 | 🟡 | ✅ | ✅ | ✅ | 🟡 | 🟡 | claim/start/submit 有，零点击唤醒未证明 |
| RT-09 | Provider Task 与 Run 分离 | ✅ | ✅ | ✅ | — | — | — | ✅ | 投影层分离 |
| RT-10 | 重启恢复 | 🟡 | ✅ | ✅ | — | — | — | 🟡 | ✅ 真实 Core+Bridge+Agent 重启恢复实测（F） |

## D. CLI、MCP 与 Agent Product Surface

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| CLI-01 | CLI P0 覆盖 | — | — | — | 🟡 | — | — | — | 🟡 部分命令完整 |
| CLI-02 | doctor/capabilities | — | — | — | ✅ | — | — | — | ✅ `lcos doctor` / `lcos capabilities` 实测（D） |
| CLI-03 | project current/inspect | — | — | — | 🟡 | — | — | — | 🟡 current/inspect/--json 已加（D）；多项目 current 需显式 id |
| CLI-04 | Artifact inspect/compare | — | — | — | 🔴 | — | — | — | 🔴 缺失 |
| CLI-05 | Feedback/Decision | — | — | — | 🔴 | — | — | — | 🔴 缺失 |
| CLI-06 | Run events/cancel | — | — | — | 🟡 | — | — | — | 🟡 dry-run 已加（D）；events 需 Event 表（红区），cancel 待决策 |
| CLI-07 | Checkpoint/Preview | — | — | — | 🔴 | — | — | — | 🔴 缺失 |
| CLI-08 | GUI-only 边界表 | — | — | — | 🟠 | — | — | — | 🟠 无明确边界 |
| MCP-01 | Agent 创建 Run | — | — | — | — | ✅ | — | — | ✅ create/dispatch/recover/finalize 实测绑定真实 Bridge（D） |
| MCP-02 | Agent 读 GUI Selection | — | — | — | — | ✅ | — | — | ✅ 浏览器点选→PUT→CLI 立读实测（D） |
| MCP-03 | Agent 确认 Revision | — | — | — | — | 🟡 | — | — | 🟡 accept/reject/retry 已加（D）；compare 缺失 |
| MCP-04 | Skill 与代码同步 | — | — | — | — | 🟡 | 🟡 | — | 🟡 Skill 已同步 Intent/MCP 声明（D）；E2E 一致性待 F |

## E. Project Truth、文件与 Preview

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| DATA-01 | 真实目录导入 | ✅ | ✅ | — | — | — | — | — | ✅ 大目录体验待验 |
| DATA-02 | 常用文件导入 | 🟡 | ✅ | — | — | — | — | — | 🟡 部分预览缺口 |
| DATA-03 | Preview 统一 | 🟡 | 🟡 | — | — | — | — | — | 🟡 Viewer Host 与 Cache 未统一 |
| DATA-04 | DOCX 预览 | 🔴 | — | — | — | — | — | — | 🔴 无正式预览 |
| DATA-05 | Watcher | 🔴 | 🔴 | — | — | — | — | — | 🔴 未实现 |
| DATA-06 | Safe Write | 🟡 | 🟡 | — | — | — | — | — | 🟡 默认 Draft，覆盖协议未完成 |
| DATA-07 | 删除 View 不删 Artifact | ✅ | ✅ | — | — | — | ✅ | — | ✅ 架构测试覆盖 |
| DATA-08 | Truth 不落 localStorage | 🟡 | ✅ | — | — | — | — | — | 🟡 Fixture 分支仍存在 |

## F. Golden Path、恢复与诚实验收

| ID | 简述 | GUI | Core | Bridge | CLI | MCP | Skill | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| QA-01 | 浏览器 Golden Path | 🟡 | ✅ | ✅ | — | — | — | 🟡 | 🟡 Runtime/Bridge/Agent 全链实测（F）；GUI 全链待手工 |
| QA-02 | Bridge 离线不假装执行 | 🟡 | 🟡 | — | — | — | — | 🟡 | 按钮仍允许创建 Run |
| QA-03 | Fixture 不接管 Runtime | 🟡 | — | — | — | — | — | 🟡 | App 保留 Fixture 状态机 |
| QA-04 | Restart Recovery | — | 🟡 | 🟡 | — | — | — | 🟡 | 数据层有，GUI 无 |
| QA-05 | 失败矩阵 | 🟡 | — | — | — | — | — | 🟡 | 分散存在，不统一 |
| QA-06 | 宣传与能力一致 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | Handoff 夸大完成 |

## 汇总

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 已兑现 | 6 | 10% |
| 🟡 部分兑现 | 20 | 33% |
| 🟠 接口存在 | 8 | 13% |
| 🔴 未兑现 | 26 | 43% |
| ⚫ 已被替代 | 0 | 0% |

## 保护性测试（Slice A 产出）

| 测试 | 覆盖项 | 预期状态 |
|---|---|---|
| ActiveContext PUT 未被 Web 调用 | UI-05 | 🔴 fail until fixed |
| analyze 默认被 revise 替代 | RUN-01/02 | 🔴 fail until fixed |
| Adapter 硬编码 Markdown | RUN-06 | 🔴 fail until fixed |
| Bridge 离线可派发 | QA-02 | 🔴 fail until fixed |
| Checkpoint 假按钮 | UI-07 | 🔴 fail until fixed |

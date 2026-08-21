# Dz 修改原意台账 — 逐项修复对照表

> 日期：2026-08-03 ｜ 基线：`codex/backend-hardening-20260802 @ b1e6fcf` ｜ 验证：385 测试全绿 + 真实冒烟 + 真实库 v9→v12 迁移副本验证
> 状态口径：✅ 真实完成 ｜ 🟡 施工中（后端已就绪/部分完成） ｜ 🔴 未做 ｜ ⛔ 阻塞（需协议扩展或外部依赖） ｜ 前端=需 UI 接手项

## 18.2 产品本质与总体方向

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-CORE-01 | 🟡 | Context/Target/Agent/过程/版本/交接的后端全部就绪（ActiveContext target、propose、inspect、projection、session）；GUI 尚未整体消费 |
| DZ-CORE-02 | 🟡 | 跨项目/Session 恢复成立（workspace state、session summaries、revision 溯源）；跨机器搬迁（.lcosproj）未做 |
| DZ-CORE-03 | ✅ | 确定性 proposeRun 先归纳一行摘要，LCOS 规则兜底（意图/结果去向 Guard），用户可纠正；模型版待接 |
| DZ-CORE-04 | 🟡 | 后端已支持“说人话”编排（propose/search/CLI 自然语言入口）；Composer UI 未接 |
| DZ-CORE-05 | ✅ | 未推倒任何核心：Revision/Bridge/Domain/Runtime Host 原样保留，全部 additive 迁移（v10–v12） |
| DZ-CORE-06 | ✅ | 单一真相（membership 独立表）、additive 迁移、真实错误、真实 E2E、独立回滚 |
| DZ-CORE-07 | ✅ | 同类面一起修：格式 Registry、中文路径全链、迁移/幂等/级联测试矩阵 |

## 18.3 新用户、Project 与工程文件

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-PROJ-01 | ✅ | Native Directory Picker + Base64 回传，中文路径乱码修复（真机 round-trip 验证） |
| DZ-PROJ-02 | ✅ | 拖入与 Picker 走同一真实导入服务（imports/import-archive/upload-session） |
| DZ-PROJ-03 | ✅ | 递归索引为节点+目录集合（project-root-indexer），中文目录冒烟通过 |
| DZ-PROJ-04 | ✅ | inspect 返回 requiresConfirmation+文件数；大目录一次性确认逻辑就绪（UI 文案待接） |
| DZ-PROJ-05 | ✅ | “打开文件夹”→ 自动命名 + 自动索引 + 默认 Workspace，直接进 Canvas |
| DZ-PROJ-06 | 🔴 | 五步浏览器计数需 UI + Playwright 用户路径，未做 |
| DZ-PROJ-07 | 🔴 | 三步已有项目路径依赖 Composer UI，未做 |
| DZ-PROJ-08 | 🔴 | .lcosproj 需先 ADR（文档 16.7 步骤 1），未获批未施工 |
| DZ-PROJ-09 | 🔴 | relativePath+hash 重绑定随 .lcosproj 一起，未做 |
| DZ-PROJ-10 | 🔴 | 同上（工程 ID 稳定机制未做） |
| DZ-PROJ-11 | ✅ | open intent 默认文件夹名、无需重复表单（后端）；UI 表单简化待前端 |

## 18.4 导入、格式与内容视觉

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-DATA-01 | ✅ | MIME/扩展 Registry（analyzers/reader），MD/TXT/图片/PDF/PPTX/DOCX/ZIP/链接统一导入 |
| DZ-DATA-02 | 🟡 | 可导入/可预览/可分析/可编辑四能力后端字段齐备；能力展示 UI 待接 |
| DZ-DATA-03 | ✅ | DOCX 导入成功建档；预览走诚实 fallback（不冒充支持） |
| DZ-DATA-04 | ✅ | PDF/PPTX 只读预览在 Viewer Registry 稳定可用 |
| DZ-DATA-05 | ✅ | Viewer Registry → Artifact Workbench 单一路由（Modal 已删） |
| DZ-DATA-06 | ✅ | 单击选择/Overlay；双击文件=Preview；双击 Scope=进入（探针+截图证据） |
| DZ-DATA-07 | 🟡 | Canvas 缩略图渲染属 UI；后端 previewDataUrl 已就绪 |
| DZ-DATA-08 | 🔴 | 内容对象弱框架视觉属 UI，未做 |
| DZ-DATA-09 | 🟡 | link 分析保存标题/URL/来源（前序）；favicon/摘要 UI 待接 |
| DZ-DATA-10 | 🟡 | 飞书链接按网页处理，用户可命名；授权取标题未做 |
| DZ-DATA-11 | 🔴 | 网页嵌套预览明确非核心，未做（受 CSP 限制外部打开） |
| DZ-DATA-12 | 🔴 | 图片拖动与节点拖动事件隔离属 UI，未做 |
| DZ-DATA-13 | ✅ | 导入=真实索引：冒烟验证 Graph/SQLite 计数一致 |

## 18.5 Canvas、Workspace 与直接操作

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-WS-01 | ✅ | v11 `workspace_memberships` 独立多对多表，成员=单一真相 |
| DZ-WS-02 | ✅ | POST /workspaces/:id/members 批量加入（HTTP/CLI/MCP） |
| DZ-WS-03 | ✅ | remove/move/list 全链（HTTP/CLI/MCP + 测试） |
| DZ-WS-04 | 🟡 | 后端 add API 就绪（addedBy user/agent/run/import）；自动归属+Undo 属 UI |
| DZ-WS-05 | 🟡 | 成员/意图/上下文范围后端成立；Workspace 范围 UI 待接 |
| DZ-WS-06 | ✅ | Membership 与位置彻底分离（不同表/字段） |
| DZ-WS-07 | ✅ | UNIQUE(workspace_id, artifact_view_id) 多对多 |
| DZ-WS-08 | ✅ | Workspace State：保存现场（成员/Revision/视口/Intent/关联 Run）、列表、恢复 |
| DZ-WS-09 | ✅ | Checkpoint 底层复用，产品语义合并为“保存现场/里程碑”（UI 文案待前端） |
| DZ-WS-10 | 🟡 | 选择→ActiveContext→propose 链后端通；Composer UI 未接 |
| DZ-WS-11 | 🟡 | 单选/多选/Workspace 范围在 active-context 与 projection 中可区分；UI 入口未接 |
| DZ-WS-12 | 🟡 | Workspace/Membership/Session 的 MCP 工具就绪；canvas link/arrange 工具未做 |
| DZ-WS-13 | 🔴 | 连续缩放 UI，未做 |
| DZ-WS-14 | 🔴 | 空格新建节点 UI，未做 |
| DZ-WS-15 | 🔴 | 选择态动作/命令面板 UI，未做 |

## 18.6 Composer、Context 与 Run 发起

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-RUN-01 | 🟡 | proposeRun 后端就绪；选区下方 Composer 属 UI |
| DZ-RUN-02 | 🟡 | Context Shelf 数据源就绪（contextItems/pinned）；Chip UI 属 UI |
| DZ-RUN-03 | 🟡 | 右栏全局对话模式后端无依赖（workspace 范围 active-context）；UI 待接 |
| DZ-RUN-04 | 🔴 | 删除 RunConfirmDialog 主路径属 UI（Phase 5） |
| DZ-RUN-05 | 🟡 | intent/provider/resultPolicy 三字段契约与校验就绪；三级选项 UI 属 UI |
| DZ-RUN-06 | ✅ | GET /runtime/providers（Auto/workbuddy/codex，manual 门禁） |
| DZ-RUN-07 | ✅ | ActiveContext targetArtifactId/targetRevisionId + editTargets 契约 |
| DZ-RUN-08 | ✅ | analyze/create 无 Target 可 Run（Context-only 实测） |
| DZ-RUN-09 | ✅ | 三 Intent 显式必填、平等（缺省即拒绝） |
| DZ-RUN-10 | ✅ | create 禁 Target；revise 只 Draft；analyze 零文件 |
| DZ-RUN-11 | ✅ | artifacts.managed；外部 Reference 作 revise 目标直接拒绝 |
| DZ-RUN-12 | ✅ | proposeRun 一行摘要可见可纠正，用户值优先 |
| DZ-RUN-13 | ✅ | 无歧义 0 问；有歧义 1 个最小问题（测试锁定） |
| DZ-RUN-14 | ✅ | contextItems 与 editTargets 契约分离，Manifest 冻结在发送后 |
| DZ-RUN-15 | ✅ | Intent 与节点类型解耦（Run 只存 outputIntent） |
| DZ-RUN-16 | 🔴 | 备注归一为 Text Artifact 的 UI/导入改动，未做 |
| DZ-RUN-17 | 🔴 | 单次发送交互属 UI |
| DZ-RUN-18 | ✅ | 确定性归纳（proposeRun）；模型判断源待接 |

## 18.7 Revision、Prompt、过程与 Review

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-REV-01 | ✅ | artifact inspect 返回每个 Revision 的来源 Run/Prompt/Provider |
| DZ-REV-02 | ✅ | 溯源只读；无原地编辑接口；“基于此版本继续”只能走新 Draft（Guard） |
| DZ-REV-03 | 🟡 | revision list/compare 后端完成；GUI 链待 UI |
| DZ-REV-04 | ✅ | Staging+Draft+人工 Accept，修改永不直接写 Current |
| DZ-REV-05 | ✅ | GET /projects/:id/process-projection 真实事件投影 |
| DZ-REV-06 | ✅ | projection 含状态/时间/摘要/来源 Run；LOD 展示属 UI |
| DZ-REV-07 | ✅ | session_summaries 表 + 增查 API + handoffRef |
| DZ-REV-08 | 🟡 | 创建时间/来源/版本字段齐备；Canvas 近距离展示属 UI |
| DZ-REV-09 | 🟡 | 发起与观察分离后端成立；右栏模式切换属 UI |
| DZ-REV-10 | ✅ | 统一 Workbench/Viewer（Modal 已删，探针+截图） |
| DZ-REV-11 | 🟡 | Workbench/NodeInfoPopover 已提供信息；选择态快捷动作属 UI |

## 18.8 CLI、MCP、Skill 与本地 Agent

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-AGENT-01 | 🟡 | MCP 覆盖 Project/Selection/Workspace/Membership/Run/Proposal/Provider；Canvas 写工具未齐 |
| DZ-AGENT-02 | 🟡 | CLI 覆盖 project/workspace/context/target/run/revision/artifact/session/process/providers；剩余动词待补 |
| DZ-AGENT-03 | 🟡 | Skill 已同步主要声明；自动一致性测试未做 |
| DZ-AGENT-04 | ⛔ | 零点击 claim/start/submit 需真实 executor；AutoSync 已就绪，Provider 标 manual |
| DZ-AGENT-05 | 🟡 | Membership/Workspace/Session/Revision MCP 就绪；canvas link/arrange 未做 |
| DZ-AGENT-06 | 🔴 | 内置浏览器视觉上下文，未做 |
| DZ-AGENT-07 | 🟡 | 飞书链接按 Link Descriptor 处理；授权内容快照未做 |
| DZ-AGENT-08 | 🔴 | Storyboard 本质的右栏工作台视觉，属 UI |
| DZ-AGENT-09 | ✅ | 同一 Contracts/Domain，CLI/MCP/Web 共用类型 |
| DZ-AGENT-10 | ✅ | 自然语言 → proposeRun → 命令编排；模型版待接 |

## 18.9 Runtime Host、Bridge 与后台体验

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-RT-01 | ✅ | dev:open 一次拉起 Web/Core/Bridge，健康点确认 |
| DZ-RT-02 | ✅ | 隐藏启动 + 文件日志 + 状态命令 |
| DZ-RT-03 | ✅ | 关 GUI 只停 Web；Core/Bridge 常驻；dev:stop 全停 |
| DZ-RT-04 | ✅ | 托盘 v1（runtime-host-tray.ps1，零依赖）；UX 待人工确认 |
| DZ-RT-05 | ⛔ | 零点击接单需真 executor；AutoSync 已做，未证明前 manual |
| DZ-RT-06 | 🟡 | Bridge kernel 提纯/凭证外置未系统盘点 |
| DZ-RT-07 | ✅ | Dispatch/Binding 与 Canonical Run 分离（投影层） |
| DZ-RT-08 | ✅ | Ingestion → ArtifactReturn → Revision → Review 归位链（Golden Path 实测） |
| DZ-RT-09 | ✅ | Runtime 不可用时明确 Offline/Failed，无 Fixture 静默接管 |
| DZ-RT-10 | ✅ | PID/签名/工作目录识别，只清 LCOS 进程 |

## 18.10 UI 操作性与可发现性

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-UX-01~06 | 🔴 | 全部属 UI 视觉/入口/可发现性，未做（后端接口已就绪） |
| DZ-UX-07 | 🟡 | 真实持久化+错误提示后端成立；数据源标识 UI 待接 |
| DZ-UX-08 | ✅ | Editor Host 接口预留且值为 null，不扩成编辑器 |

## 18.11 开发、测试与交接习惯

| ID | 状态 | 怎么修的 |
|---|---|---|
| DZ-DEV-01 | ✅ | 独立 worktree/分支，红区树已并入主线 |
| DZ-DEV-02 | ✅ | 每片定向测试，阶段收口全量 385 测试 |
| DZ-DEV-03 | ✅ | 审计快速定位阻塞，施工后集中验证 |
| DZ-DEV-04 | ✅ | 每份 Handoff 附启动/测试步骤 |
| DZ-DEV-05 | ✅ | Handoff 记录 branch/HEAD/完成点 |
| DZ-DEV-06 | ✅ | 台账入库并原样保留，新增反馈先登记 |
| DZ-DEV-07 | ✅ | 真实 E2E/冒烟；manual/阻塞如实标记，无 Mock 冒充 |
| DZ-DEV-08 | ✅ | Registry/矩阵覆盖同类（格式、路径、迁移） |
| DZ-DEV-09 | 🔴 | 真实项目 dogfood 待 UI 落地后由 Dz 手工验收 |
| DZ-DEV-10 | ✅ | 小提交、不自动 Push、不重写历史 |

## 汇总

| 状态 | 数量（约） |
|---|---|
| ✅ 真实完成 | 61 |
| 🟡 施工中（后端就绪/部分） | 27 |
| 🔴 未做（多为 UI/需批准） | 23 |
| ⛔ 阻塞 | 2 |
| 合计 | 113 |

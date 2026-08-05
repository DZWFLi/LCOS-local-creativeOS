# LCOS Gate F 收口后仍欠清单（给开发）

> 基线：Gate F 全栈候选包已入库（`bcd7f7a` + `75565ca` + `a6aab15`），Windows 实机质量链全绿，
> 但“真实 Codex 会话闭环”未验证。这份清单按用户产品需求优先排序，不是工程问题清单。

## 一、用户明确要求过、现在仍没做/没做完（优先级最高）

1. **真实 Codex 自动接单闭环（最大缺口）**：GUI 发 Run → 看门狗 resume 真实 Codex 会话 →
   自动认领/执行/回传 → 画布出现结果 → 使用/放弃。目前只被脚本模拟验证过，真实会话一次没跑通。
2. **自然语言上下文指令**：“把第二张也加进来”“参考这些帮我改一下”→ Skill 自动执行。
   底层命令有，真实链路没通（依赖第 1 条）。
3. **waiting_input（Agent 需要你补充信息）**：Bridge 协议没有此状态，整条“Agent 有歧义时问你一次”
   的链路缺失。
4. **小错误自动修正一次**：validate-plan 失败后 Agent 应自动重读上下文、修正一次再打扰用户；
   该循环没有写进 Skill 指令。
5. **手动接单后成为首选会话 + 会话失效只新建一次**：逻辑有（Session Affinity），真实流程未验证。
6. **Agent 浏览器实时上下文 1 秒内刷新**：数据层 `afterVersion` 短轮询有，但浏览器 Agent 面板
   本身没接这个轮询，未验证“1 秒内看到新版本”。
7. **UI 术语降噪**：普通界面仍有“Local Core 连接异常”“Runtime 项目加载失败”等开发话；
   右侧仍是 WorkRail + 节点浮层 Composer + 面板并存，不是“一次只有一个上下文工作台”；
   错误人话 + 一键复制诊断未实现。
8. **多选后 Agent 自动识别 Target/Context**：UI 只有本地静态人话摘要，真实 Skill 识别未验证。
9. **一组验收场景未真实跑**：长 Prompt 端到端恢复、同项目连续 5 Run 无重复、
   从选中到发送 ≤3 个核心动作。

## 二、GPT 大盘点里的能力，Gate F 后仍欠的

| 能力 | 现在状态 | 还缺什么 |
|---|---|---|
| `.lcosproj` 日常化 | 后端已到 v14，导出/导入可用 | GUI 打开/另存入口、双击打开、Windows 关联、自动发现、live store、状态栏保存状态 |
| 批量导出工程 | CLI/API 有 | 项目管理页备份/迁移入口 |
| Run Event 时间线 | SQLite/API 有 | Activity UI：人话任务过程、去重、错误定位 |
| Runtime Recovery | recover API 有 | GUI“重新连接/继续任务”按钮和故障解释 |
| Watcher / stale | Core 有测试 | UI 外部变化提示、重新读取、冲突处理 |
| Checkpoint | 保存/历史按钮有 | 项目时间线、命名、恢复与对比 |
| Preview | 缓存/注册表基础有 | 统一右侧 Viewer、外部打开 |
| Handoff / ContextManifest | 后端 manifest 有 | “交给另一个对话”/Context Pack 导出入口 |
| 文件夹扫描与项目索引 | Core 有 | 确认页、自动分组、节点合集与布局 |
| 对话导入 Session | 无 | 按范围把对话整理成画布上的会话节点/章节锚点（新方向） |
| 托盘 Runtime Host | 脚本存在、曾修编码 | Windows 实机验收：单实例、自启动、退出、恢复、状态菜单 |
| Eagle/Obsidian/IMA/收藏夹连接器 | 无 | 统一资源连接器（远期） |

## 三、Gate F 已补、不需要再做（防止重复开发）

- 极简 Composer：参考芯片 + 人话输入 + Agent + “结果作为新节点” + 发送，人话摘要提示。
- CommandDraft 持久化：长 Prompt 切节点/刷新/重启不丢。
- Ctrl/Cmd/Shift 多选、框选、组移动。
- Workspace Membership GUI：加入空间 / 移出空间 / 移至空间。
- 撤回任务 + 迟到结果隔离（脚本验证）。
- Context 命令与 Proposal：加/移参考、设 Target、聚焦；提案持久化 + Agent 模式卡片。
- Provider 能力门：只有可自动执行的 Agent 出现在普通列表。
- ActiveContext v14 持久化 + CAS + afterVersion（CLI/MCP 可 watch）。
- Session Affinity 表 + 看门狗零注册 resume。
- CLI/MCP 49 工具 + Skill 语义决策入口 + Core 最小 Guard。
- Process Projection 修正：只投影真实 Run，画布最多 3 个。
- 结果四按钮：使用这个版本 / 补充修改要求 / 重新执行 / 放弃这个结果。
- 质量链全绿：381 单测 + 48 架构 + 5 集成 + 32 pytest + 7 E2E + Golden Path。

## 四、验收标准（别被糊弄）

`有类型 / 有 API / 有按钮 / 有测试 / 文档写完成` 都不算完成。
只有满足以下才算：

```text
用户能自然找到入口并完整用完
或 Agent 能通过 Skill 自动调用并得到可恢复结果
刷新和重启后还在
出错能恢复，错误是人话
```

Codex 必须是第一个真实通过全部 P0/P1 场景的本地 Agent；
不允许用模拟 Agent、脚本 claim 或“CLI 命令存在”代替真实浏览器上下文与自动执行闭环。


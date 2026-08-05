# LCOS Gate F Final Closeout 实机验收报告（2026-08-05）

> 输入：`LCOS_Fullstack_GateF_Final_Closeout_20260805.zip`（SHA-256 `4D9CCB0A…5E`）
> 基线：入库提交 `6280398`；本轮验收修复提交 `bd5614b / 387c602 / d755fb9 / 788668c`
> 结论：**候选包通过 Windows 实机质量链与真实 Codex 核心场景，但仍有两类遗留需要开发处理（见 §5）。**

## 1. 入库与源码

- zip 树覆盖入库（跳过 zip 内乱码 `OS项目文档` 目录，worktree 已有正确版本）；
- 68 文件变更（+4196/−368），包含 waiting_input、Obsidian 连接器、Skill/MCP 安装器、
  `run-codex-task.mjs` runner、Core v15、UI 降噪等；
- MANIFEST 已按仓库真实树重生成（646 文件）并通过校验。

## 2. 质量链（全部通过）

```text
npm ci → lint → typecheck → 单测 387（web 130 + local-core 248 + domain 5 + contracts 4）
架构 57/57 → 集成 5/5 → web build → local-core build → smoke
Bridge pytest 35/35 + compileall → Core smoke（schema v15 全 true）→ Obsidian smoke（readOnly/sourceUnchanged）
closeout 静态校验 → Golden Path 全链 → Playwright E2E 7/7 → 4 个浏览器探针全绿
Skill 安装（含 references）→ MCP 安装（codex mcp get 返回配置）
```

## 3. 验收中修复的问题（都来自 closeout 新代码，非旧债）

1. web 测试 mock 缺 Obsidian / waiting_input 客户端方法（typecheck 失败）；
2. v07 测试断言旧技术文案（已随 UI 降噪更新）；
3. `/imports` 公开响应不再含 `fileRecord`，测试改用 `revision.fileRecordId`（防内部记录外泄的新合同）；
4. 架构测试仍按旧实现找 `Resolve-CodexSessionId` 与旧安装器路径（已对齐 runner / join 路径）；
5. Golden Path 事件链按新语义补“agent 启动后显式 sync”（run.started 现在表示 canonical 真正 running）；
6. E2E 文案断言随 UI 降噪更新；
7. **相机回归（重要）**：打开项目时恢复持久化相机，但陈旧相机把所有主节点推到视口外（用户看到空画布、点不到节点——即“单点节点不行”的根因之一）。修复：内容节点可见率 <50% 时在 8 秒窗口内自动 fit；过程/投影节点不参与判定；
8. **runner 卡死（重要）**：`run-codex-task.mjs` 在 codex 子进程退出后因孙进程继承 stdout 管道而不退出，阻塞看门狗主循环（已取消的 Run 卡住、后续 Run 全部排不上）。修复：结果写完后强制 `process.exit` 并销毁管道；
9. **resume 缺参数**：已有会话 resume 未带 `--skip-git-repo-check`，非 git 项目目录直接拒绝执行。修复：resume 分支补参数；
10. 探针适配 afterVersion 长轮询（networkidle 永不触发）与 fixture→runtime 切换时序。

## 4. 真实 Codex 场景结果（真实 CLI、真实会话、真实任务）

测试项目：`docs/testing/fixtures/gatef-disposable-project` 复制到临时目录（6 文件导入成功）。

| 场景 | 结果 | 证据 |
|---|---|---|
| A 新会话 analyze | ✅ | run `8315db15`：spawn_new → 会话 `019fd094` claim/start/submit → completed；事件 queued→started→completed；绑定=进程真实返回的 session id |
| B 会话复用 | ✅ | run `f8b10ca7`、`e2b86711` 均由看门狗 `resume 019fd094` 完成；绑定不变；无重复事件/窗口 |
| E waiting_input | ✅ | run `3042fb98`：Agent 提问（含选项+自由文本）→ Run 进入 waiting_input → 回答“全部文件” → 同一会话续跑 attempt 2 → completed；事件链 queued→started→waiting_input→input_resolved→queued→started→completed；零文件 |
| G 撤回 | 🟡 部分 | cancel API 对排队 Run 生效（幂等）；Golden Path 脚本覆盖 cancel event；真实“运行中撤回进程树”未实测 |
| H 浏览器 1s 同步 | 🟡 部分 | Agent 面板版本实时递增（v345→v372，afterVersion 长轮询在跑）；未做逐毫秒测量 |
| I Obsidian 只读 | 🟡 部分 | smoke/单测覆盖 readOnly + sourceUnchanged；原生目录选择器无法 headless 自动化，未走 UI 点选 |
| J 连续 5 Run | 🟡 部分 | 完成 4 个真实 Run（1 spawn + 2 resume + 1 waiting_input resume），含复用；revise/create 真实变体未跑 |

## 5. 给开发的遗留（诚实）

1. **MCP 仍未进真实会话**：`lcos:install-mcp` 注册成功，但真实 `codex exec` 会话内没有
   `local-creative-os` MCP 工具（Agent 明确报告“无 MCP，用等价 REST 完成”；另有
   `127.0.0.1:8920/mcp` 配置连不上）。清单要求“不得接受 MCP 缺失时偷偷用 REST”，
   本轮 Agent 是显式上报 fallback（诚实），但 MCP 集成本身仍需开发修通并真实验证。
2. **看门狗同步阻塞**：主循环同步等待 runner；runner 已强制退出，但单线程设计仍脆弱，
   建议改为异步/超时护栏（本轮卡死已暴露一次）。
3. `run.started` 新语义依赖 10s 自动同步捕获 running；极短任务可能跳过 started（UI 不依赖事件，可接受）。
4. 过程/投影节点不应参与相机可见性判定（本轮已排除），但“主内容最少可见比例”建议作为 UI 常量集中管理。

## 6. 复跑入口

```powershell
npm run audit:manifest:verify
npm run check:fast
npm run smoke:gatef-closeout
npm run test:golden:full
npm run test:e2e        # 先 npm run dev:stop
npm run dev:open
node tests/e2e/closeout-diag.mjs
node tests/e2e/single-click-probe.mjs
```


# LCOS Gate F 最终能力账本
## 2026-08-05 Closeout Candidate

| 能力 | Contract | Core / Bridge | CLI / MCP / Skill | Web | 本环境验证 | Windows 还需验证 |
|---|---|---|---|---|---|---|
| create / revise / analyze | ✅ | ✅ | ✅ | ✅ | Core build/smoke | 真实 Codex 固定矩阵 |
| waiting_input | ✅ | ✅ | ✅ | ✅ | pytest 35/35、Core build | 同 Session 回答后 resume |
| 自动修正一次 | Skill 合同 | Core 结构化错误 | ✅ | 不暴露内部参数 | 静态合同 | 真实自然语言 E2E |
| Session Affinity | ✅ | ✅ SQLite | ✅ Runner/Skill | Diagnostics 基础 | Fake Runner 合同 | 连续 3–5 Run 复用 |
| 精确 Codex resume | 运行合同 | Watchdog | ✅ | N/A | 参数与 Session 解析 Smoke | Windows codex.exe |
| 闭环确认 | Task 状态 | Bridge Task | Runner `closureObserved` | Activity 投影 | Fake Bridge review Smoke | 真实任务结果回收 |
| ActiveContext afterVersion | ✅ | ✅ 持久化/CAS | ✅ watch tool | ✅ Agent 模式轮询 | Core smoke | 内置浏览器 ≤1秒 |
| select / focus / move View | ✅现有对象 | ✅ Mutation/CAS | ✅ | 已有 Canvas | 静态/MCP tools | Playwright/真实浏览器 |
| Prompt Draft | ✅ | ✅ SQLite | 可读 | ✅ | 基线能力检查 | 浏览器刷新/重启 |
| Cancel / Late Result | ✅ | ✅ | Runner 进程树 | ✅ | Core/Bridge逻辑测试 | Windows 信号行为 |
| Skill 安装 | 文件包 | Launcher Guard | ✅完整树 Hash | N/A | Temp CODEX_HOME Smoke | 用户 Codex Home |
| MCP 安装 | Codex CLI 合同 | Launcher Guard | ✅ | N/A | Fake CLI Smoke | `codex mcp get` |
| Resource Connector Port | ✅ | ✅ Registry | ✅ capability tool | 入口基础 | Core smoke | 无 |
| Obsidian 只读 | ✅ | ✅ | ✅ | ✅选择导入 | 源 Hash 不变 Smoke | Windows 原生目录选择器 |
| UI 术语降噪 | N/A | 结构化错误 | Diagnostics | 🟡进一步收口 | 静态/语法 | 真实用户走查 |
| 完整右侧单工作台 | N/A | N/A | N/A | 🟡未彻底重构 | 未声称完成 | 后续视觉收口 |
| screenshotRef | 未冻结实现 | ❌ | ❌ | ❌ | 未实现 | 后续浏览器 Observation |
| Windows 安装器 | N/A | N/A | N/A | N/A | 后置 | Gate W |

## 宣传规则

只有一行同时具备：

```text
Contract → 实现 → Agent 接口 → 用户入口 → 真实验证
```

才可在普通 UI 或 README 中宣称完整可用。黄色项只能写“基础已接入”或“待实机验证”。

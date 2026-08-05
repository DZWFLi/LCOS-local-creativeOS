# LCOS Fullstack Gate F Plus（P0 对话导入设计版）

> 日期：2026-08-05
> 分支：`codex/backend-hardening-20260802`
> HEAD：见随包 `BUILD_INFO.md`（打包时生成，含 commit 与质量链摘要）
> 代码基线：Gate F Final Closeout 入库提交 `6280398` + 实机验收修复
> `bd5614b / 387c602 / d755fb9 / 788668c`；此后仅新增文档，无代码改动。
> 目的：给开发的全栈源码候选 + P0 对话导入项目描述 + 剩余问题总账。

## 包内容

```text
apps/web
apps/local-core
packages/domain / contracts / skills / ui
tools/light-bridge-kernel
tools/lcos-agent
tools/codex-orchestrator
scripts
tests
docs
```

本轮新增文档：

```text
docs/product/LCOS_P0_CONVERSATION_IMPORT_PROJECT_BRIEF_20260805.md   # P0 项目描述（Core/MCP/Skill/CLI 接入点）
docs/audit/LCOS_FULLSTACK_REMAINING_ISSUES_MASTER_20260805.md        # 全栈剩余问题总账（给开发）
docs/audit/LCOS_GATEF_REMAINING_GAPS_FOR_DEV_20260805.md             # 轻量导入设计 + 开源借鉴清单
docs/audit/LCOS_MCP_COMPLETION_HELP_20260805.md                      # MCP 完全完善（第一优先）帮助文档
docs/architecture/LCOS_MCP_BRIDGE_DECOUPLING_DESIGN_20260805.md      # MCP/Bridge 解耦设计 + 开源借鉴
docs/testing/fixtures/conversation-import-sample/                    # 真实 Codex 会话导入样本（854KB）
```

额外包含：

```text
docs/testing/fixtures/gatef-disposable-project
```

该测试项目不含数据库、Runtime 数据、Token、日志或 Provider Session。

## 已排除

```text
.git
node_modules
dist
build
.codex-runtime
.dev-launcher runtime state
SQLite / DB
logs
cache
credentials / tokens
Python virtualenv / egg-info / pyc
```

## 验证摘要

```text
本轮为文档增量包，代码基线未变，沿用 Gate F Final Closeout 实机验收成绩：
lint / typecheck / 单测 387 / 架构 57 / 集成 5 / web build / local-core build /
smoke / Bridge pytest 35/35 / Core smoke（schema v15）/ Obsidian smoke /
Golden Path / Playwright E2E 7/7 / 浏览器探针全绿

真实 Codex 场景：A 新会话 analyze ✅ / B 会话复用 3 次 ✅ / E waiting_input ✅
```

遗留（诚实标注，见总账文档）：

```text
MCP 注册成功但真实 codex exec 会话未加载工具（显式走 REST fallback）——待开发修通；
  已定位根因线索（fnm 临时 node 路径 / ai_bridge 残留），解耦设计见 architecture 文档
看门狗主循环仍为单线程同步等待——待异步化 + 超时护栏
连续 5 Run 只完成 4 个真实 Run；revise/create 真实变体未跑
```

完整 Windows Web 质量链和真实 Codex 会话复测见：

```text
docs/audit/LCOS_GATEF_CLOSEOUT_WINDOWS_VERIFICATION_20260805.md
docs/audit/LCOS_FULLSTACK_REMAINING_ISSUES_MASTER_20260805.md
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260805.md
```

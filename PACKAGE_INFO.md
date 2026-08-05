# LCOS Fullstack Gate F Final Closeout Candidate

> 日期：2026-08-05
> 原始基线：`7cdf8c3e4d19c024d6dc302fc3c486ef277424d5`
> 目的：真实 Windows / Codex 最终复测前的完整全栈源码候选。

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
Domain build：PASS
Local Core build：PASS
TS/TSX syntax：PASS
MJS syntax：PASS
Core schema/HTTP smoke：PASS
Connector/Obsidian smoke：PASS
Light Bridge pytest：35/35 PASS
MCP tools/list：58 tools
Skill installer / MCP installer / Codex Runner contract smoke：PASS
```

完整 Windows Web 质量链和真实 Codex 会话复测见：

```text
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260805.md
```

# LCOS Gate F Development Candidate

> 日期：2026-08-04  
> 状态：全栈开发候选包，正式合并与 Windows 安装器尚未执行。

## 先看

```text
docs/handoffs/LCOS_FULLSTACK_GATEF_DEVELOPMENT_REPORT_20260804.md
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260804.md
docs/audit/LCOS_GATE_F_CAPABILITY_LEDGER_20260804.md
```

## Windows 实机起步

```powershell
npm ci
npm run audit:manifest:verify
npm run check:gatef-capabilities
npm run dev:open
npm run dev:status
```

安装 Codex Skill：

```powershell
npm run lcos:install-skill
```

## 当前边界

```text
已完成：全栈代码收口、Core 构建、Bridge、CLI/MCP、持久化、Golden Path。
待实机：完整 npm 质量链、浏览器 E2E、真实 codex exec resume、Windows Watcher。
后置：正式 Git 合并、Windows 安装器、自动更新。
```

# LCOS Gate F Final Closeout Candidate

> 日期：2026-08-05
> 基线：原始源码 HEAD `7cdf8c3` + 用户提供的真实 Windows Codex 证据
> 状态：等待 Windows 实机复测；正式主线合并与 Windows 安装器后置。

## 先看

```text
docs/handoffs/LCOS_GATEF_FINAL_CLOSEOUT_REPORT_20260805.md
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260805.md
docs/audit/LCOS_GATE_F_CLOSEOUT_CAPABILITY_LEDGER_20260805.md
docs/handoffs/LCOS_GATEF_FINAL_CLOSEOUT_IMPLEMENTATION_PLAN_20260805.md
```

## Windows 起步

```powershell
npm ci
npm run audit:manifest:verify
npm run check:gatef-closeout
npm run check:gatef-capabilities
npm run lcos:install-skill
npm run lcos:install-mcp
npm run dev:open
npm run dev:status
```

## 本轮重点

```text
真实 waiting_input
一次自动修正
精确 Codex Session resume
结果闭环确认
Codex Skill + MCP 安装
Agent Browser afterVersion
安全 Canvas Actions
Obsidian 只读连接器
```

## 当前边界

```text
完成代码：全栈收口候选、Schema v15、Bridge v4、Skill/MCP/Connector。
待实机：真实 Windows Codex、PowerShell Watchdog、Web/Vitest/Playwright 全量回归。
后置：正式合并、Windows 安装器、screenshotRef、更多连接器与广泛 Canvas 自动布局。
```

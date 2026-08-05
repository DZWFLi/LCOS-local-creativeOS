# LCOS Fullstack Gate F Plus — Build Info

> 归档日期：2026-08-05
> 分支：`codex/backend-hardening-20260802`
> HEAD：见随包 `PACKAGE_INFO.md`（本文件由打包时更新）

## 关键提交

```text
6280398  Gate F Final Closeout 包入库
bd5614b / 387c602 / d755fb9 / 788668c   实机验收修复
a0ee8ec  P0 轻量导入设计 + 开源借鉴清单
d7497a4  P0 对话导入项目描述 + 全栈剩余问题总账 + 包清单刷新
833852c  重生成 MANIFEST.sha256（651 文件，verify PASS）
```

## 质量链（代码基线自 Gate F 实机验收后无改动）

```text
lint / typecheck / 单测 387 / 架构 57 / 集成 5 / web build / local-core build /
smoke / Bridge pytest 35/35 / Core smoke（schema v15）/ Obsidian smoke /
Golden Path / Playwright E2E 7/7 / 浏览器探针全绿
```

## 真实 Codex 场景

```text
A 新会话 analyze：PASS（run 8315db15）
B 会话复用 3 次：PASS（session 019fd094）
E waiting_input 问答续跑：PASS（run 3042fb98）
```

## 已知遗留

```text
A1: MCP 注册成功但真实 codex exec 会话未加载工具（显式 REST fallback）——开发必修
A2: 看门狗主循环单线程同步等待 runner——建议异步化 + 超时护栏
B1/B2: 真实 Run 完成 4 个，未跑满连续 5 Run；revise/create 真实变体未跑
```

详见 `docs/audit/LCOS_FULLSTACK_REMAINING_ISSUES_MASTER_20260805.md`。

## 启动

```powershell
npm ci
npm run dev:stack
npm run dev:open
```

## 检查

```powershell
npm run check:fast
npm run smoke:gatef-closeout
npm run test:golden:full
npm run test:e2e
```

## 新增交付文档

```text
docs/product/LCOS_P0_CONVERSATION_IMPORT_PROJECT_BRIEF_20260805.md
docs/audit/LCOS_FULLSTACK_REMAINING_ISSUES_MASTER_20260805.md
docs/audit/LCOS_GATEF_REMAINING_GAPS_FOR_DEV_20260805.md（轻量导入设计）
docs/testing/fixtures/conversation-import-sample/（真实会话导入样本）
```

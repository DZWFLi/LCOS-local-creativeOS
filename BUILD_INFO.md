# LCOS Fullstack — Build Info

> 归档日期：2026-08-11
> 分支：`research/huabu-gap-audit-20260811`（冻结基线 pre-huabu-audit-2026-08-11）
> HEAD：<打包时自动填充>

## 近期关键提交（A-H 施工，自 2026-08-11 起）

```text
21a754d  chore: freeze LCOS pre-Huabu audit baseline（docs/provenance/）
c8584c3  docs(audit): H-GUI Completion Gate 逐项证据
4cca5b4  feat(phase-h): GUI closeout + 全阶段 Golden Regression
67192cf  feat(phase-g): Session Context Continuity + Web Chat provider adapter
2b34904  feat(phase-f): Native sqlite-vec KNN + local-ai CLI
d0355dc  feat(phase-e): Indexed Skill Runtime V2
feb8b1d  feat(phase-d): Agent Reorganize + auto-pin
f5c4052  feat(phase-c): Capture Plane + browser extension
21d392e  feat(phase-b): Project Affinity + Capture Staging
0cc7a73  feat(phase-a): Runtime Registry + Zero Naming + Ollama probe
```

## 当前基线

```text
web 单测 251/251（50 文件） / 架构测试 70/70 / E2E 3/3（Phase E）
真实会话导入验证：713 消息 / 91 章节 → 画布 91 节点 + Context Strands 94 节点（9/9 浏览器检查 PASS）
```

注：本包打包前未重跑全量 check:fast；以上为最近一次验证链（Phase E 验收 + 会话实体化浏览器验证）实测结果。

## 已知遗留（详见架构盘点）

```text
G1  Presentation（Strands/大纲/来源）无 Core 契约：前端内存，重启丢失
G2  Context Pack 不含 Conversation/Section/Decision/OpenLoop
G3  L3（Ollama + sqlite-vec）代码存在、运行时未激活（.runtime 空、无测试）
G4  Provider 导入只有 Codex + Manual；ChatGPT/Claude/Gemini/Aider 为枚举占位
G5  Run 状态三份副本（runs/bridge_tasks/runtime_bindings），10s 轮询收敛
G6  相机双写（localStorage + active_contexts.viewport）
G7  Metrics / Memory Graph / Outbox 独立表 ABSENT
```

完整清单：`docs/audit/LCOS_CURRENT_ARCHITECTURE_CENSUS_20260810.md`

## 启动

```powershell
npm ci
npm run dev:stack
npm run dev:open
```

## 检查

```powershell
npm run check:fast
npm run smoke:gatef-core
npm run test:e2e
```

## 本包新增/重点文档

```text
docs/audit/LCOS_CURRENT_ARCHITECTURE_CENSUS_20260810.md（本次全栈盘点）
docs/handoffs/HANDOFF_REAL_CONVERSATION_CANVAS_20260810.md（会话实体化）
docs/handoffs/PHASE_E_ACCEPTANCE_20260810.md（Spatial Phase E）
docs/design/LCOS_PRODUCTION_INTERACTION_CONSOLIDATION_CONSTRUCTION_PLAN_20260803.md
```

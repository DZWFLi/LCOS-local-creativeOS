# LCOS 0.1 Desktop + Capture + Skill V4.3 Standalone Baseline · PASS9

日期：2026-08-18  
状态：Standalone Source Baseline / Windows Full QA Pending

## 这是什么

PASS9 = PASS8 Desktop + Capture standalone baseline + LCOS Skill Runtime V4.3 inheritance upgrade。

这是完整源码快照，不要求先拥有 PASS6/PASS7/PASS8，也不要求做 patch merge。

包含：

- Web GUI / Local Core / contracts / domain / ui
- S10 产品化主链
- Electron Desktop Host / Runtime Supervisor / Tray
- Capture Space / Capture Float / Browser Capture canonical extension
- Semantic Drop / Material Transfer
- Codex MCP / executor / orchestrator
- Skill Runtime V4.3
- `managed-skills.json` 单一 managed truth
- Skill V2 validator + architecture contracts
- Forge / Squirrel.Windows config + Bridge bundle build scripts

## 不包含

- `.git`
- `node_modules`
- build/dist
- Windows installer
- bundled Bridge executable
- Token / DB / logs / user cache

## 首次运行

```bash
npm run baseline:bootstrap
```

然后：

```bash
node scripts/validate-lcos-skills.mjs
npm run test:architecture
npm run typecheck
npm run test
npm run build
npm run check:0.1:deterministic
npm run desktop:doctor -- --ready
```

## Skill V4.3 边界

- Saved Context 由 Curator 管；ActiveContext / ContextManifest 由 Project Context 管。
- Curator 不创建 Managed Run。
- `filesystem_organize` 0.1 plan-only / fail-closed。
- Context/Workflow Agent write 只有 capability census 标成 READY 后才能暴露真实写命令。
- Huabu item-level Keep/Revert 在 Core live review 存在前不得宣称完成。

## Source lineage

历史 Git base：`950acba9fca90bbe03872e7bf0fed552b9de2321`。

PASS9 已汇总到单目录，历史 patch 只用于审计，不是施工入口。

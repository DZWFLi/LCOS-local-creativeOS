# LCOS Phase Snapshot · 0.1 Desktop + Capture Standalone Baseline PASS8

日期：2026-08-18

## 当前一句话

**不再做历史 patch merge。PASS8 直接成为下一棵 LCOS 工作树的源码起点。**

## 权威基线

```text
PASS8
├─ S10 产品化收口源码
├─ PASS5 Interface Productization
├─ PASS6 Electron Desktop Alpha
├─ PASS7 Capture Space / Capture Float
└─ PASS8 Standalone hardening / bootstrap
```

历史 base HEAD：`950acba9fca90bbe03872e7bf0fed552b9de2321`，仅用于 lineage。

## 0.1 当前主链

```text
Browser / Agent / Explorer / Clipboard
                  ↓
             Capture Float
                  ↓
             Capture Space
                  ↓
       Semantic Drop → Project
                  ↓
             Main Canvas
                  ↓
               Context
                  ↓
              Workflow
                  ↓
      Agent / Proposal / Revision
                  ↓
        Continuity / Reopen
```

## Capture Freeze

### Capture Float

- Electron 独立 BrowserWindow。
- frameless / always-on-top / skipTaskbar。
- 可拖动，PASS8 起记住屏幕位置。
- 收文件、文字、URL。
- 默认全部进入 Capture Space。
- 只显示最近 Capture / pending count / 打开 Capture Space。

### Capture Space

- 系统级，不属于任何 Project。
- 是项目之前的轻量 Canvas。
- 没有 Context / Workflow。
- 保留空间编辑、Region、Semantic Drop、真实预览、AI 整理。
- AI 只做匹配、分组、摆放，不自动归项目。

### Capture → Existing Project

- 用户显式 Semantic Drop。
- materialize 为 Artifact / View / ImportBatch。
- Project 只增量摆放新节点，旧节点不移动。
- Capture cache 保留。

## Desktop Freeze

Electron Host 当前包含：

- Main Window
- Capture Window
- Tray
- Runtime Supervisor
- Core / Bridge lifecycle
- local static Web host + Core proxy
- persistent runtime token
- native directory picker / reveal
- Codex managed MCP + Skills setup
- Squirrel.Windows Forge config

当前仍没有经过真实 Windows make 的 installer binary。不要把 source-complete 写成 release-complete。

## 新工作树启动纪律

Codex 解压 PASS8 后：

```bash
npm run baseline:bootstrap
npm run typecheck
npm run test
npm run build
npm run check:0.1:deterministic
npm run desktop:start
```

第一次不能 `npm ci`，因为源码包中的 lockfile 来自 Desktop workspace 加入前；`baseline:bootstrap` 会刷新一次。刷新后的 lockfile 成为新权威 lock。

## 明确不再做

- PASS5/PASS6/PASS7 patch merge。
- PowerShell Capture Assistant 正式化。
- 43123 wake canonical path。
- StagingDialog 恢复为主入口。
- AI 自动把 Capture 归项目。
- 0.1 真实本地项目目录 AI move/rename。
- Desktop installer 未过真机 Gate 就宣布 0.1 release。

## 下一阶段

新工作树跑绿后只剩：

1. Context GUI 最后一轮；
2. Workflow GUI 最后一轮；
3. Canvas → Context → Workflow Golden User Flow；
4. Windows Desktop 真机 release make。

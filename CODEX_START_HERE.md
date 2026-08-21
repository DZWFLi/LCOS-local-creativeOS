# CODEX START HERE · LCOS 0.1 GUI + Context Cache + Windows RC

日期：2026-08-18

你拿到的是 **LCOS 0.1 当前唯一全栈源码候选基线**，不是增量 Patch。

本基线已经合并：

- PASS9 Desktop + Capture + Skill V4.3；
- 0.1 GUI Final；
- PASS8 Buddy Windows deterministic / lockfile / Desktop test fixes；
- Context Cache-Friendly Runtime（deterministic stable prefix）；
- Windows 0.1 fail-closed finalization script。

> **不要再应用 PASS5 / PASS6 / PASS7 / PASS8 / GUI 历史 patch。**

---

## 0. 当前主链

```text
Capture Float / Browser Capture
          ↓
     Capture Space
          ↓
  Project Main Canvas
          ↓
       Context
          ↓
      Workflow
          ↓
 Agent / Proposal / Revision
          ↓
 Continuity / Reopen
```

Project Truth 仍然独立于 Surface / Session / Harness。

---

## 1. Skill V4.3 当前真相

Canonical source：`packages/skills/`

Managed truth：`packages/skills/managed-skills.json`

7 个 managed skills：

- `lcos-project-context`
- `lcos-project-curator`
- `lcos-skill-author`
- `lcos-executor-run`
- `local-creative-os-backend-flow`
- `local-creative-os-frontend-loop`
- `workbuddy-orchestrator`

Curator V4.3 capability 状态仍遵守：READY 才接真实 CLI/MCP；PARTIAL/MISSING 必须 fail-closed。

---

## 2. Context Cache-Friendly 0.1

新增运行时链：

```text
Saved Context Presentation membership
              ↓
       ContextManifest V0
              ↓
   ContextPromptSerializerV1
       ↙                 ↘
Stable Prefix          Dynamic Tail
       ↓                 ↓
 stable hash       task / selection
       └────────┬────────┘
          RuntimeInputPack
                ↓
         Agent / Provider
```

冻结要求：

- 同一 Saved Context semantic snapshot → 同一 stable prefix / hash；
- Presentation 坐标、viewport、Selection、Run/Session metadata 不进入 stable prefix；
- Saved Context membership / revision / logical source anchor 改变时 stable hash 改变；
- file move/rename 不因为 absolute path 无谓打碎 semantic prefix；
- no Cache GUI；
- no Provider-specific cache runtime；
- no Snapshot+Delta runtime in 0.1。

Agent executor 的 `get_lcos_run_context` 已统一读取 `/runs/:id/context-prompt`，不再直接把旧 ContextManifest 当最终 Agent 输入。

---

## 3. 安装依赖

PASS8 Buddy 回传的正式 `package-lock.json` 已经合并。

因此新 Windows worktree 直接：

```bash
npm ci
```

**不要再为 Desktop workspace 重新运行旧 PASS8 `baseline:bootstrap` 来刷新 lockfile。**

---

## 4. Full automated Gate

```bash
npm run check:context-cache-static
npm run check:gui:0.1-final
node scripts/validate-lcos-skills.mjs
npm run test:architecture
npm run typecheck
npm run test
npm run build
npm run check:0.1:deterministic
npm run desktop:doctor -- --ready
```

如果只接管当前 0.1 Windows 收口，优先使用下一节的一键脚本，它会保存 evidence。

---

## 5. Windows 0.1 一键预检

```powershell
npm run windows:finalize:0.1 -- -LaunchDesktop
```

脚本会 fail-fast 执行：

1. `npm ci`
2. Context Cache static gate
3. GUI Final gate
4. full typecheck
5. Context Cache targeted Vitest + ContextManifest / RuntimeAdapter / RuntimeApplication tests
6. deterministic release gate
7. Desktop ready doctor
8. Desktop prepare
9. 生成 8 项 Windows Desktop QA JSON 模板
10. 可选启动 Desktop dev process

手工 QA 必须检查：

1. Main Window 启动并自动托管 Core / Bridge。
2. Tray 工作。
3. Capture Float 独立、always-on-top、可移动并记住位置。
4. Explorer 文件 / 文本 / URL Drop → Capture Space。
5. Capture Space reload 后 presentation 不丢。
6. AI 整理只改 Capture Space，不自动归项目。
7. Semantic Drop → Existing Project 成功，目标项目旧节点不移动。
8. 关闭/重启后 Runtime 与 Capture 正常。

把模板改成 `status=PASS`、8 项 `passed=true`，并填入真实截图路径后，才允许 make installer。

---

## 6. Windows installer（fail-closed）

```powershell
npm run windows:finalize:0.1 -- -SkipNpmCi -MakeInstaller -QaEvidenceFile "<WINDOWS_DESKTOP_QA_PASS.json>"
```

脚本会先验证：

- QA JSON 为 PASS；
- 恰好 8 项检查全部通过；
- 至少有一份真实截图且路径存在；

然后才运行：

```bash
npm run desktop:doctor -- --release
npm run desktop:make:win
```

并确认 `LCOS-Setup.exe` 实际存在。

---

## 7. 0.1 冻结边界

不要恢复：

- PowerShell Capture Assistant 为正式 Capture UI；
- `43123/wake` 为 canonical Capture 路径；
- StagingDialog 为主暂存体验；
- Browser Capture 默认自动投最近项目；
- Capture AI 无确认自动归项目；
- 真实本地项目文件 AI move / rename；
- 第二套 Fragment / Proposal / Presentation organizer；
- 把 Saved Context 和 ActiveContext 混成一个东西；
- Context 强制 Signal Track / Mind Map 二选一；
- Workflow 把 Material 冒充 Step；
- 16×16 重新做文件类型 icon；
- Cache GUI / Provider Cache Manager / Delta Runtime。

`filesystem_organize` 继续 capability-gated、plan-only / fail-closed。

---

## 8. Codex 当前职责

只做：

1. 把当前目录作为唯一工作树；
2. `npm ci` + Full Gate；
3. 修真实 Gate blocker，不重新设计产品；
4. 跑 Windows 8 项真机 QA 并保存截图；
5. QA 全绿后才 make installer；
6. 回传唯一 clean HEAD、Gate evidence、真机截图、`LCOS-Setup.exe`。

不要再 merge 历史 patch，也不要重新打开 GUI / Context / Workflow / Cache 世界观。

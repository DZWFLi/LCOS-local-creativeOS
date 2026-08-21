# LCOS 0.1 · PASS8 合并 + Context Cache-Friendly + Windows RC 最终报告

日期：2026-08-18  
最终源码 HEAD：`80f6d3d767aac6912634616a1d0537918e390c9d`

## 0. 一句话状态

PASS8 Buddy 补全修复已经**语义合并**进最新 PASS9 GUI Final；Context Cache-Friendly 0.1 基础层已经实现并接入真实 Run / Agent 输入；当前唯一不能在本 Linux 执行环境完成的是 **Windows Desktop 8 项人工 QA + installer make**。

因此当前状态是：

`LCOS 0.1 source RC = READY_FOR_WINDOWS_NATIVE_GATE`

不是：`RELEASE_DONE`。

---

## 1. PASS8 Buddy 合并结果

输入 delta：`LCOS_PASS8_BUDDY_CODEX_CHANGES_20260818.patch`

合并基线：PASS9 + Skill V4.3 + GUI Final。

### 处理方式

不能整包盲贴，因为 PASS9/GUI Final 已提前吸收部分 PASS8 修改，且少数同文件后来发生过新修改。

最终按 73 个 patch 文件做：

- 已存在等价修复 → 保留新代码，不重复覆盖；
- 无冲突修复 → 合并；
- 同文件语义重叠 → 手工保留 PASS9/GUI 新逻辑并吸收 PASS8 blocker fix。

所有 73 个 patch 文件最终都完成语义归并。

额外补齐：

- `apps/local-core/tests/active-context-store.test.ts` 不再写死 `C:\LCOS\sample`；
- 改用 OS temp root，避免 Windows 根目录权限造成 deterministic gate 假失败。

PASS8 合并 commit：`834a949`。

---

## 2. Context Cache-Friendly Owner Census

没有新建平行 Context Runtime。

| Concern | 当前唯一 Owner | 本轮处理 |
|---|---|---|
| Saved Context membership | `PresentationViewV0.memberViewIds` | 作为 stable membership order |
| Context freeze | `ContextManifestService` | 增加 stable items + cachePlan |
| Active selection / task | Run / ContextManifest dynamic items | 只进入 dynamic tail |
| Prompt compiler | `context-prompt-serializer.ts` | deterministic compiler |
| Immutable runtime pack | `RuntimeAdapterService` | compiled prompt + telemetry |
| Agent read path | `/runs/:id/context-prompt` | Executor 统一读取 |
| Provider cache | Provider adapter（未来） | 0.1 不绑定单一 Provider |

运行链：

`Saved Context → ContextManifest → ContextPromptSerializerV1 → stablePrefix + dynamicTail → RuntimeInputPack → Agent/Provider`

---

## 3. 已实现 Cache 能力

### Contracts

新增：

- `ContextPromptCachePlanV1`
- `CompiledContextPromptV1`
- `ContextCacheTelemetryV1`
- `CONTEXT_PROMPT_SERIALIZER_V1 = context-prompt-v1`

### Deterministic Prompt Compilation

`apps/local-core/src/context-prompt-serializer.ts`

冻结：

- Unicode NFC；
- LF newline；
- fixed section layout；
- Saved Context stable order；
- SHA-256 stable hash；
- semantic snapshot id；
- provider-neutral cacheFamily；
- stable / dynamic size + token estimate telemetry。

### Stable Prefix

包含：

- serializer identity；
- route；
- optional Skill/version identity；
- capability profile；
- project baseline；
- Saved Context semantic snapshot；
- stable artifact/revision/sourceAnchor/content identity。

明确不包含：

- node x/y；
- viewport / zoom；
- current Selection；
- run id / session id；
- timestamp / heartbeat / pid / runtime port；
- absolute file path。

### Dynamic Tail

包含：

- current target；
- Selection / Focus；
- task-local active items；
- locked elements；
- resource refs；
- run constraints；
- current user task。

同 Artifact + Revision 已在 stable prefix 时，dynamic tail 不重复 dump 正文。

---

## 4. 一个关键稳定性修复

如果 Saved Context 成员同时又是本轮 target/reference，不能复用 task-local Manifest item。

否则：

`role=context ↔ role=target`

会导致 Saved Context 语义没变但 stable hash 漂移。

现在 Saved Context 使用独立 stable identity：

`saved:<artifact>:<revision>[:anchor-hash]`

并且 stable items 在 task-local material 之前编译，避免动态内容消耗 character budget 后反向改变 stable baseline。

---

## 5. Agent 路径已经真正接入

不是只把 serializer 放在仓库里。

### RuntimeInputPack

现在携带：

- `compiledContextPrompt`
- `contextCacheTelemetry`

### Executor

`get_lcos_run_context` 已改为读取：

`GET /runs/:id/context-prompt`

因此 Bridge/Executor 对同一 Run 使用同一个 stablePrefix + dynamicTail 语义。

旧 ContextManifest endpoint 保留 debug / compatibility，不再是 Agent 最终输入主入口。

---

## 6. Contract Tests

新增 7 个要求中的测试族：

1. `context-prompt-determinism.test.ts`
2. `context-prompt-presentation-independence.test.ts`
3. `context-prompt-runtime-metadata.test.ts`
4. `context-prompt-membership.test.ts`
5. `context-prompt-fragment-anchor.test.ts`
6. `context-prompt-revision.test.ts`
7. `context-prompt-file-relocation.test.ts`

同时扩展：

- ContextManifest tests；
- RuntimeAdapter tests；
- RuntimeApplication tests。

覆盖：

- 100 次 determinism；
- NFC / LF；
- Presentation independence；
- Selection/task/run metadata dynamic-only；
- membership/order；
- sourceAnchor；
- current/pinned revision；
- physical relocation；
- stable/dynamic body dedup；
- 两个不同 task Run 共享 stable hash、dynamic hash 不同。

---

## 7. 本环境实际 Gate 证据

### PASS

- Context Cache static gate：**18/18**
- GUI Final static gate：**23/23**
- A4/A5/A6/B1/B3/B3R4/B3R5/B3R6/B4/B5/B6 legacy static gates：全部 PASS
- working tree TS/TSX syntax gate：**20/20**（commit 前）
- targeted `ContextPromptSerializerV1` TypeScript typecheck：PASS
- executable serializer behavior gate：PASS
  - 100x deterministic
  - presentation independence
  - runtime split
  - membership
  - anchor
  - revision
  - stable/dynamic dedup
- real SQLite + Saved Context integration smoke：PASS
  - real MetadataRepository
  - Saved Context order
  - anchor
  - physical relocation
  - dynamic split
- `git diff --check`：PASS
- final worktree：clean

### 本环境不能宣称 PASS

`npm ci` 在当前 Linux 容器 180 秒内无法完成且没有形成完整 `node_modules`。

因此**新 Cache 代码**没有在这里宣称：

- full workspace Vitest PASS；
- full workspace typecheck PASS；
- new production build PASS。

PASS8 Buddy 的旧 Windows baseline 曾对当时源码跑过完整 typecheck/test/build；但本报告不会拿旧 baseline 的绿灯冒充新 Cache commit 的完整回归。

---

## 8. Windows 0.1 最终 Gate

新脚本：

`scripts/windows-finalize-lcos-01.ps1`

入口：

`npm run windows:finalize:0.1 -- -LaunchDesktop`

自动 fail-fast：

1. npm ci
2. Context Cache static
3. GUI Final static
4. full typecheck
5. Context Cache targeted Vitest + ContextManifest/Runtime tests
6. deterministic gate
7. desktop doctor --ready
8. desktop prepare
9. 生成 Windows QA evidence template
10. 可选启动 Desktop

### 人工 8 项 QA

1. Main Window 启动并自动托管 Core / Bridge。
2. Tray 工作。
3. Capture Float 独立、always-on-top、可移动并记住位置。
4. Explorer 文件 / 文本 / URL Drop → Capture Space。
5. Capture Space reload 后 presentation 不丢。
6. AI 整理只改 Capture Space，不自动归项目。
7. Semantic Drop → Existing Project 成功，目标项目旧节点不移动。
8. 关闭/重启后 Runtime 与 Capture 正常。

### Installer Fail-Closed

只有 QA JSON：

- `status=PASS`
- 恰好 8 项全部 `passed=true`
- 至少一份真实截图路径存在

才允许：

`npm run windows:finalize:0.1 -- -SkipNpmCi -MakeInstaller -QaEvidenceFile "<QA_PASS.json>"`

之后才运行 release doctor + `desktop:make:win` 并检查 `LCOS-Setup.exe` 实际存在。

---

## 9. Context Cache-Friendly DoD

- [x] Owner census
- [x] 无平行 Context Truth
- [x] versioned deterministic serializer
- [x] Saved Context stable / Active task dynamic
- [x] NFC/LF canonicalization
- [x] stable SHA-256 hash
- [x] Presentation move 不影响 stable contract
- [x] Selection 不影响 stable hash
- [x] Run/session metadata 不进入 stable
- [x] membership 改变 stable
- [x] membership order 稳定
- [x] sourceAnchor 改变 stable
- [x] revision 语义正确
- [x] pinned revision 语义正确
- [x] physical file path 不进入 stable serializer
- [x] telemetry 只存 hash/refs/size/token 等，不存完整 Prompt
- [x] Agent read path 接入 compiled prompt
- [x] no Cache GUI
- [x] no full Delta Runtime
- [x] no Provider-specific cache manager
- [x] contract tests present
- [ ] Windows fresh-install full Vitest/typecheck/build/deterministic native rerun
- [ ] Windows Desktop 8 项 Human QA
- [ ] Windows LCOS-Setup.exe

最后三项是**原生 Windows 发布 Gate**，不是 Context Cache 架构欠账。

---

## 10. 允许留到 0.1 之后的 Debt

- Provider-specific prompt cache breakpoint/key adapter；
- Provider cached-token telemetry ingestion；
- Snapshot + Delta Overlay；
- automatic compaction；
- 真正经过 Skill Runtime 的 route 自动注入 Skill resolver/version identity；
- MaterialTransfer fragment provenance → stable logical sourceAnchor 自动解析；
- large result store；
- advanced ContextBudgetGovernor。

这些不是当前 Windows RC blocker。

---

## 11. 冻结结论

0.1 当前保证的是：

> **同一 Saved Context semantic snapshot，可以稳定地产生同一 Agent stable prefix 与 stable hash。**

它不承诺 Provider 一定 cache hit。

GUI 不新增缓存概念，Project Truth 不因缓存改变，Executor 继续可替换。

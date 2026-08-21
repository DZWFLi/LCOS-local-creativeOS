# LCOS 0.1 · Context Cache-Friendly + Windows RC Handoff

日期：2026-08-18

## 状态

本工作树基于 PASS9 GUI Final，已语义合并 PASS8 Buddy 测试/lockfile 修复，并实现 0.1 Context Cache-Friendly 基础层。

### 已完成

- PASS8 Buddy 73-file delta 归并，不回滚 PASS9/GUI 新代码；
- `active-context-store.test.ts` 的 `C:\LCOS\sample` blocker 改为 OS temp root；
- `ContextPromptSerializerV1`（pure deterministic compiler）；
- Saved Context stable prefix / Active task dynamic tail；
- SHA-256 stablePrefixHash / snapshotId / cacheFamily；
- provider-neutral cache telemetry；
- RuntimeInputPack 统一携带 compiled prompt；
- Agent executor `get_lcos_run_context` 统一读取 run context prompt；
- Saved Context membership order / pinned revision 支持；
- Presentation / selection / run metadata / physical path 与 stable prefix 解耦；
- 7 个 Cache contract test families；
- Windows fail-closed finalization script。

### 明确没有做

- Cache GUI；
- Provider-specific cache breakpoint/key runtime；
- Snapshot + Delta Overlay；
- automatic compaction；
- cross-provider cache manager；
- Advanced ContextBudgetGovernor；
- filesystem auto organize；
- item-level Review 假能力。

## Owner census

| Concern | Canonical owner | Cache change |
|---|---|---|
| Saved Context membership | `PresentationViewV0.memberViewIds` | 冻结为 stable membership order |
| Context freeze | `ContextManifestService` | 生成 cachePlan + stable item identity |
| Active task / selection | Run + ContextManifest dynamic items | 只进入 dynamic tail |
| Prompt compiler | `context-prompt-serializer.ts` | deterministic stable/dynamic compiler |
| Immutable Run pack | `RuntimeAdapterService` | 写入 compiled prompt + telemetry |
| Agent read path | `/runs/:id/context-prompt` | Executor 统一读取 |
| Provider cache | Provider adapter（未来） | 0.1 不绑定 provider API |

## Cache DoD

- [x] 不新增第二套 Context Truth
- [x] versioned deterministic serializer
- [x] stable / dynamic split
- [x] NFC + LF canonicalization
- [x] stable SHA-256 identity
- [x] Presentation move 不进入 stable contract
- [x] Selection / task / run constraints 只影响 dynamic
- [x] Saved Context membership 改变 stable
- [x] membership order 稳定
- [x] revision 改变 stable
- [x] pinned revision 可冻结 stable
- [x] logical sourceAnchor 参与 stable serialization
- [x] file physical relocation 不进入 serializer
- [x] same-revision dynamic body 不重复 dump
- [x] telemetry 不存完整 prompt
- [x] no Cache GUI
- [x] no Provider-specific cache runtime
- [x] 7 个 contract test families

## Windows 收口

执行：

```powershell
npm run windows:finalize:0.1 -- -LaunchDesktop
```

完成 8 项人工 Desktop QA 后，编辑生成的 QA JSON，再执行：

```powershell
npm run windows:finalize:0.1 -- -SkipNpmCi -MakeInstaller -QaEvidenceFile "<QA_PASS.json>"
```

安装包 gate 必须 fail-closed，不得在没有真实 Windows QA evidence 时 make。

## Remaining Debt（允许进入 0.1 之后）

- Provider-specific prompt cache breakpoint / key adapter；
- provider cached-token telemetry ingestion；
- Snapshot + Delta Overlay / compaction；
- automatic Skill resolver/version identity injection for routes that actually run through Skill Runtime；
- MaterialTransfer fragment provenance → stable logical sourceAnchor 的自动解析（当前 serializer/manifest contract 已支持 sourceAnchor，但现有 MaterialTransfer provenance 仍主要通过 reference relation 保存）；
- large result store / advanced context budget governor。

这些不属于 0.1 当前 blocker。

# Slice B-3 Handoff：Adapter Registry 去硬编码（RUN-06 / RUN-07）

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commit：`611a3fb`

## Decision

Slice B 第三步完成：Runtime 输出合同不再由 `runtime-adapter.ts` 硬编码 Markdown，改为 Adapter Registry 按 `Intent × Artifact Kind × MIME` 解析；不支持的 revise 目标在派发前（Bridge 调用前）失败。直接对应工作单 RUN-06 / RUN-07 与验收条件「unsupported 在派发前失败」。

## Exact files

- `apps/local-core/src/adapter-registry.ts`（新增）：`RuntimeAdapterRegistry` 接口 + `defaultRuntimeAdapterRegistry` 默认实现 + `AdapterUnsupportedError`
  - `resolveRevise(artifact.kind, fileRecord.mimeType)`：markdown / text-plain → `markdown_script_revision`（.md / text/markdown）；image / pdf / presentation / other → `UNSUPPORTED_OUTPUT_FORMAT`
  - `resolveCreate()` → `creative_run` 开放合同（不预声明输出）
  - `resolveAnalyze()` → `creative_run` 零输出合同
- `apps/local-core/src/runtime-adapter.ts`：
  - `RuntimeProjectReader` 扩展 `getArtifact`，`getArtifactRevision`/`getFileRecord` 返回结构增加 kind/mimeType（结构子集，不泄漏完整实体）
  - `materialize()` 改用 `resolveProfile()`：revise 先取 target Artifact + Base Revision + FileRecord，再经 Registry 解析；无 target 在派发前 `CONTRACT_UNSUPPORTED`
  - 输出路径由 profile 生成（`${outputName}-${run.id}${fileExtension}`），mediaType/taskType 全部来自 profile
  - constraints 按 Intent 区分：analyze 禁止写文件；create 只写 staging 输出根；revise 只写声明输出
  - `recover()` 对 `AdapterUnsupportedError` 直接抛出，不再标记 `recovery_required`
  - `BridgeTaskEnvelopeV1.expectedOutputs.mediaType` 放宽为 string（内核本就接受任意 media type）
- `tests/architecture/july-plan-gap-protection.test.ts`：GAP-RUN-01 / GAP-RUN-06 从「锁定缺口存在」改为正向锁定（Registry 存在、无硬编码回潮）
- 测试：`adapter-registry.test.ts`（新增 6 例）、`runtime-adapter.test.ts`（新增 2 例：unsupported 目标与无 target 均在 Bridge 调用前失败）

## Schema

无迁移。

## Before / After flow

```text
Before: revise 一律生成 script-draft-*.md + text/markdown + markdown_script_revision，
        即使目标是 PDF/图片；无 target 的 revise 也能进 Bridge
After:  Intent × Kind × MIME → Registry → profile（taskType/mediaType/扩展名/输出名）
        支持：markdown/text revise；create 开放合同；analyze 零文件
        不支持：PDF/PPTX/图片 revise → UNSUPPORTED_OUTPUT_FORMAT，createTask 未被调用
```

## Security impact

- 格式能力 Gate 前移：不支持的输出格式不会生成任何 Bridge Task / RuntimeBinding
- 输出路径仍由 Registry profile 生成并受 `assertWithin(runtimeRoot)` 约束
- 无新依赖、无 Schema 变更

## Failure recovery

- 不支持格式 revise → `UNSUPPORTED_OUTPUT_FORMAT`（retryable:false），dispatch 状态保持 planned
- revise 无 target → `CONTRACT_UNSUPPORTED`，派发前失败
- target 证据缺失（Artifact/Revision/FileRecord）→ `RUNTIME_STORAGE_CORRUPT`
- recover 遇到 unsupported → 原样抛出，不进入 recovery_required 循环

## Tests actually run

- 定向 35/35（registry 6 + adapter 10 + analyze/create ingestion 11 + protection 8）
- local-core 全套 + architecture + integration：46 文件 / 237 测试全绿
- 全仓库 typecheck 4/4 全绿；lint 无新增错误（仅存量 warning）

## Known limitations

- Registry 目前只注册 markdown/text 的 revise 格式；PDF/PPTX 等 revise 能力留待未来按格式逐项注册
- create 仍未选择「目标格式/工作流」，使用通用 creative_run 开放合同（符合工作单当前语义）
- 浏览器级真实 E2E 待 Slice F

## Rollback

Revert `611a3fb`；无 Schema/数据迁移影响。若回滚，保护性测试会恢复为锁定缺口的失败断言。

## Worktree clean / STOP-GO

- Commit 后工作区干净
- **GO → Slice C**：Runtime Host 与 Bridge 常驻（Launcher 管理 Core/Bridge/Web）

---

_Codex 2026-08-03，全部结论基于本次实测。_

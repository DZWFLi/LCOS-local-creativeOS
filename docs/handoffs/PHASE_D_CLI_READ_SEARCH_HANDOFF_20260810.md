# Phase D Handoff

## Completed

- **Curation 契约扩展**：`CurationNodeV0`（viewId / urlHints / truncated）、`CurationReadBudgetV0`、`CurationReadResultV0.budget`
- **CurationQueryService**：View → Artifact → Current Revision → content（文本前缀读取，无解析逻辑复制）；conversation 节点标记 + 摘要；resource/url hints；预算钳制（默认 20/8k/60k，硬上限 100/300k）与 truncation
- **HTTP**：`POST /projects/:id/curation/read`、`GET /projects/:id/related`（1-hop）、`GET /projects/:id/search`（federated）
- **ProjectSearchService**：Artifact title/文本、Notes、Conversation FTS、Resource descriptor 统一为 `SearchHitV0`；显式 V0 排序（exact title 100 > title 80 > text 50 > note 50 > conversation FTS 40 > resource title 60 > descriptor summary 20——已按代码实际值对齐）
- **CLI**：`lcos node read` / `lcos selection read`（读 ActiveContext.selectedViewIds）/ `lcos presentation show` / `lcos search --project --limit --types`；commands/ 新模块，dispatcher 只路由；stdout 纯 JSON、stderr 诊断

## Files changed

```text
packages/contracts/src/curation.ts / search.ts / index.ts
apps/local-core/src/curation-query-service.ts
apps/local-core/src/project-search-service.ts
apps/local-core/src/routes/curation.ts
apps/local-core/src/compose.ts / server.ts
apps/local-core/tests/curation-query.test.ts / project-search.test.ts
tools/lcos-agent/cli.mjs
tools/lcos-agent/commands/curation-query.mjs / search.mjs
```

## Contracts frozen

```text
CurationReadBudgetV0 / CurationNodeV0（含 viewId/truncated/urlHints）
SearchHitV0 / SearchQueryV0 / SearchResultV0（schemaVersion 0）
```

## Migrations

```text
无
```

## Tests run

```text
npm run lint / typecheck                    : PASS
npm run test                                : web 274/274 · core 272/272 · domain 5/5 · contracts 4/4
npm run test:architecture                   : 86/86
npm run build                               : PASS
CLI real-process smoke                      : node read / selection read / presentation show / search 全过
```

## Acceptance evidence

```text
lcos node read disposable-mvp-sample view-brief
  → boundedText 完整 Brief 内容 + fileHints + sourceRefs(revision/hash) + budget
lcos selection read disposable-mvp-sample
  → ActiveContext 选中「Mr. Ideal 创意构思」→ conversation-section 节点摘要
lcos presentation show ... presentation:context:scope-mvp-root
  → memberViewIds/hierarchy/edges/version 完整
lcos search "PortaSplit" --project disposable-mvp-sample
  → artifact-text 命中 Brief/Script + conversation-fts 命中真实会话（跨源联邦）
lcos search "Brief" --project ... → exact title score 100 第一
```

## Known compatibility paths still present

```text
GUI 顶部 Search 未迁移（D11）
Conversation read 通过会话摘要（真实消息走 Phase F Curator / conversation 工具）
```

## Explicitly NOT implemented

```text
写节点 / relation provenance migration / vector / Curator Skill / GUI search 迁移
```

## Risks for next phase

```text
Ranking 是显式启发式，不声称最终质量（Phase G 语义检索再迭代）。
`lcos search` 项目解析：唯一项目自动选最近打开；多项目必须 --project。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commit  : 9bfc18d
HEAD    : 9bfc18d
```

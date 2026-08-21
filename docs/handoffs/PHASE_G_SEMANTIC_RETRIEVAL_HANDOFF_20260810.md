# Phase G Handoff

## Completed

- **schema v23**：`search_documents`（derived index，UNIQUE(project,type,id)）+ `search_documents_fts`（fts5）+ `search_document_embeddings`；删除可重建，非 Project Truth
- **SemanticIndexService**：通用 embed/index/delete/searchVectors + health；Ollama loopback 守卫；vector 从不成为硬依赖
- **Search Pipeline V1**：FTS 候选 + vector 候选（可用时）+ 1-hop related expansion（seed ≤10 / neighbor ≤5）+ 按实体去重保留最高分
- **CLI doctor**：新增 `semantic.ollama` / `semantic.sqliteVec` 诊断
- **Environment Acceptance**：vec0.dll native 就绪（289KB，install 脚本修复为下载平台包）；Ollama 未装（用户自装）；hybrid 管线就绪待 Ollama；fallback 保证 FTS+Relation 正常
- **Curator V2**：dedupe-and-update 加入语义/邻居候选，明确「相似 ≠ 相同」
- **Long Project Golden Case**：case6 加入 fixtures（50+ 节点、多会话、重复讨论）

## Files changed

```text
apps/local-core/src/metadata-repository.ts（v23 + search document CRUD/FTS/vec 查询/loadExtension）
apps/local-core/src/semantic-index-service.ts
apps/local-core/src/project-search-service.ts（pipeline 升级）
apps/local-core/src/compose.ts
apps/local-core/tests/semantic-search.test.ts（4 用例）
tools/lcos-agent/cli.mjs（doctor）
scripts/install-sqlite-vec.mjs（平台包下载修复）
packages/skills/lcos-project-curator/references/dedupe-and-update.md（V2）
docs/audit/SEMANTIC_WINDOWS_ACCEPTANCE_20260810.md
tests/skill-fixtures/lcos-project-curator/case6-long-project/
tests/architecture/lcos-project-curator-contract.test.ts（case6 覆盖）
```

## Contracts frozen

```text
SearchHitV0（schemaVersion 0，扩展 source: vector/related/search-document-fts）
SemanticIndexHealthV0
```

## Migrations

```text
v22 → v23：3 张派生表 + indexes；user_version=23
```

## Tests run

```text
npm run lint / typecheck / build         : PASS
npm run test                             : web 274/274 · core 281/281 · domain 5/5 · contracts 4/4
npm run test:architecture                : 93/93
```

## Acceptance evidence

```text
vec0.dll 289,280 bytes native 就绪（.runtime/sqlite-vec/vec0.dll）
FTS 派生检索：indexEntity → search('zebra catalyst') → search-document-fts 命中
去重语义：同实体多来源保留最高分；related budget ≤ 50
vector 不可用时 searchVectors=[]（不崩溃、不影响 FTS+Relation）
```

## Known compatibility paths still present

```text
ConversationImportService 的对话 embedding 保留（compat）；search_documents 面向新实体
Ollama 未装：vector 路径等待用户安装（SEMANTIC_WINDOWS_ACCEPTANCE 已记录待办命令）
```

## Explicitly NOT implemented

```text
memory_nodes / graph DB / community detection / vector 启动硬依赖
```

## Risks for next phase

```text
Ollama 就绪后需跑 smoke:conversation-semantic + 验证 native KNN 与 hybrid 合并分数。
search_documents 为 derived：未来删除重建不会影响 Project Truth。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commit  : 1ddf1a1
HEAD    : 1ddf1a1
```

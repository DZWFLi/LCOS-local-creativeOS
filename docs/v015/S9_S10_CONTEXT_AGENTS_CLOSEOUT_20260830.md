# LCOS v0.15 · Context Index + AGENTS Renewal + S9/S10 Closeout

日期：2026-08-30  
输入 RC：`LCOS_FULLSTACK_0.1_RC_44ab06b_20260830.zip`  
输入 SHA256：`2d96a7bd483c03dc3558d542b2754edb27605d24f74c6d54513b50a486b911c5`

## 1. 本轮命题

本轮只处理三件事：

1. 建立 Codex v0.15 上下文追溯机制，降低跨 Session / 上下文压缩后的语义误判。
2. 完全替换旧 `AGENTS.md` / `CODEX_START_HERE.md` 的 0.1/PASS8/PASS9/Phase2.5 指导语义。
3. 收口 S9（Embedding/Retrieval Provider 化）和 S10（多格式 Search Content Extraction coverage）。

不做 Final E2E、不重做 Curator/Skill Author、不重写 SemanticIndex、不合并历史 GPT patch。

---

## 2. Context / Agent 规则变更

### 新增

- `docs/v015/CONTEXT_TRACE_INDEX.md`
- `docs/v015/CODEX_START_HERE_V015.md`

### 完全替换

- `AGENTS.md`
- `CODEX_START_HERE.md`

### 新规则核心

- 遇到产品/代码语义模糊，固定走：Context Index → current code/contracts/tests → v0.15 closeout → `CONTEXT_GAP`。
- 旧 0.1 / PASS8/PASS9 / Phase2.5 / prototype 文档默认只具 historical evidence 权限。
- GPT `651043f` 不作为 Git base，仅作 semantic reference。
- 禁止因 commit 不存在而重 apply 已被本地线吸收的历史 patch。
- Current canonical truth / projection ownership / interaction grammar / runtime truth / Skill ownership / Curator/Skill Author / Search provider / E2E 层级均进入索引。

---

## 3. S9 · Embedding / Retrieval Provider 化

### KEEP

完全保留：

- `chunkEntity`
- chunkAnchor
- per-chunk hash differential indexing
- `contentHash` late-write guard
- sqlite-vec native retrieval
- blob fallback
- project-scoped vector retrieval
- mutation-driven reindex

### ADD / EXTEND

新增：

`apps/local-core/src/semantic-provider-registry.ts`

定义：

- `EmbeddingProvider`
- `RetrievalProvider`
- `ContentExtractor`
- `VisualEmbeddingProvider`
- `SemanticProviderRegistry`
- `OllamaEmbeddingProvider`
- `RepositoryChunkRetrievalProvider`

`SemanticIndexService` 不再直接实现 `/api/embed` HTTP；Ollama 调用移动到 adapter。

`searchVectors()` 仍先调用当前 `embed()`，再把已生成 vector 交 `RetrievalProvider`，因此旧测试里通过实例 override `semantic.embed` 的测试 seam 仍可保留。

### Visual embedding

未注册任何默认 `VisualEmbeddingProvider`。

状态：**PARKING / honest unsupported**。

不使用 filename、OCR 空结果或规则向量冒充 visual embedding。

### S9 test

新增：

- `apps/local-core/tests/semantic-provider-registry.test.ts`
- `scripts/validate-v015-s9.mjs`
- `npm run check:v015-s9`

fake embedding + fake retrieval 可通过 registry 注入，证明 SemanticIndex 不依赖 Ollama concrete implementation。

---

## 4. S10 · 多格式 Search Content Extraction census

### 新的 coverage truth

新增：

- `apps/local-core/src/search-format-coverage.ts`
- `apps/local-core/tests/search-format-coverage.test.ts`
- `scripts/validate-v015-s10.mjs`
- `npm run check:v015-s10`

`file-format-registry.ts` 的 33 个 known extensions 必须逐格标：

```text
SUPPORTED + real extractor
或
UNSUPPORTED + explicit reason
```

没有 `PLANNED` 状态。

### 已有能力保留并注册化

- Markdown / TXT → plain-text extractor
- PDF → pdfjs text-layer extractor
- DOCX / PPTX → OOXML extractor
- PNG/JPG/JPEG/WebP/GIF/BMP → persisted OCR evidence extractor

### 本轮真实补洞

以下格式本来就是文本文件，但此前 `readArtifactIndexBody` 没进入正文索引：

- CSV
- JSON
- YAML / YML
- XML
- HTML

现在通过 `plain-text` extractor 进入 Search body index。

### 明确 UNSUPPORTED

包括：

- TIFF（当前 RapidOCR service 不接受）
- SVG（没有真实 SVG text/visual extractor）
- DOC / PPT / XLS legacy binary
- XLSX
- generic ZIP search flattening
- MP3/WAV/M4A
- MP4/MOV/WebM
- PSD
- AI/PostScript

这些仍可有标题/Resource fallback understanding，但不宣称 Search body extractor support。

### Mutation-driven reindex census

确认现有真实挂点继续 KEEP：

- `import-copy-service.ts`
- `capture-application-service.ts`
- `curation-command-service.ts`
- `runtime-review-service.ts`
- `routes/runtime.ts`

`ProjectSearchService` 的 ensure path 继续只是 TTL stale/missing repair。

不新增第二套 reindex scheduler。

---

## 5. 验证证据

### 已执行并 PASS

```text
node --experimental-strip-types --check
  semantic-provider-registry.ts
  search-artifact-body.ts
  search-format-coverage.ts
  semantic-index-service.ts
  semantic-provider-registry.test.ts
  search-format-coverage.test.ts

node scripts/validate-v015-s9.mjs
→ S9 gate PASS

node scripts/validate-v015-s10.mjs
→ S10 gate PASS
→ 33 known formats explicit coverage
```

### 未能在当前沙箱执行

```text
npm run typecheck --workspace @local-creative-os/local-core
vitest S9/S10 tests
existing semantic-search / semantic-chunking / vector-knn / spatial-retrieval full regression
```

原因不是测试失败，而是上传 RC 不包含 `node_modules`；尝试 `npm ci` 时当前沙箱访问 npm registry 失败：

```text
GET https://registry.npmjs.org/@napi-rs%2fcanvas
EAI_AGAIN
```

因此状态必须记为：

```text
STATIC/SYNTAX GATES = PASS
DEPENDENCY-REQUIRING TYPECHECK/VITEST = BLOCKED_ENV
```

本地真实施工树应用 patch 后必须补跑：

```bash
npm ci
npm run check:v015-s9
npm run check:v015-s10
npm run typecheck --workspace @local-creative-os/local-core
npx vitest run \
  apps/local-core/tests/semantic-provider-registry.test.ts \
  apps/local-core/tests/search-format-coverage.test.ts \
  apps/local-core/tests/semantic-search.test.ts \
  apps/local-core/tests/semantic-chunking.test.ts \
  apps/local-core/tests/vector-knn.test.ts \
  apps/local-core/tests/spatial-retrieval-service.test.ts
npm run test --workspace @local-creative-os/local-core
```

任何回归先修 S9/S10，不进入 Final Convergence / Full E2E。

---

## 6. Schema / capability

- SQLite schema：**无变更**。
- Domain persistence schema：**无变更**。
- 新增 infrastructure capabilities：provider registry / content extractor registry / format coverage truth。
- Product GUI：**不新增 Search mode，不暴露 embedding/RAG/provider 术语**。

---

## 7. 下一入口

本轮完成后，Codex 应首先补跑依赖型测试；全部绿后才进入 Final Convergence audit。

Final Convergence 第一已知 blocker 仍需单独处理：Web Runtime HUD 在缺少 `ExecutionItemV1` 时不得由 `activeRun.status` 猜 `availableActions`，必须 fail-close。

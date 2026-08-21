# Semantic Windows Acceptance（Phase G1）

日期：2026-08-10
基线：worktree `mvp-fast-build` @ Phase G

## 环境状态

| 项 | 状态 | 证据 |
|---|---|---|
| sqlite-vec（vec0.dll） | ✅ native 就绪 | `.runtime/sqlite-vec/vec0.dll`（289,280 bytes，0.1.9 windows-x64）；`scripts/install-sqlite-vec.mjs` 修复后幂等安装成功 |
| FTS5 | ✅ 可用 | `search_documents_fts` 派生索引；`conversation_messages_fts` 既有；测试命中验证 |
| vector KNN | ⚠️ native 路径就绪，无数据 | `querySearchVectors` 走 embedding_blob 点积；需要 Ollama 产生 embedding |
| Ollama | ❌ 未安装 | 127.0.0.1:11434 拒绝连接；按用户约定由用户自行下载安装 |
| hybrid（FTS+vector） | ⚠️ 待 Ollama | 管线已实现（FTS 候选 + vector 候选 + 按实体去重保留最高分）；Ollama 就绪后 `lcos search` 自动启用 |

## CLI doctor 新增诊断

```text
semantic:
  ollama: available/unavailable
  sqliteVec: native-file-present/unavailable
```

## Fallback 保证

```text
Ollama/vector 不可用 → FTS + Relation 正常返回
Curator / CLI read-write / GUI 不受影响（无启动硬依赖）
```

## 待办（用户安装 Ollama 后）

```bash
ollama pull nomic-embed-text
npm run smoke:conversation-semantic
lcos doctor
lcos search "..." --project <id>
```

期望：doctor 显示 ollama available；semantic smoke 走 sqlite-vec native KNN；search 出现 vector 命中（source: vector）。

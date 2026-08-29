#!/usr/bin/env node
// S0 census-search：机器提取搜索/索引能力覆盖。
// 锚点（S0-1 摸底实测）：
//   实体类型：packages/contracts/src/search.ts 的 SearchEntityTypeV0
//   分析器：apps/local-core/src/resources/analyzers/*-analyzer.ts（id/version 从源码读）
//   FTS5 / vec0 表：local-core src 全量扫描 CREATE VIRTUAL TABLE
//   embedding provider：semantic-index-service.ts 的 Ollama 默认配置
//   文件格式：file-format-registry.ts 的 MIME_BY_EXTENSION + artifactKindForFile 分支
//   OCR：ocr-service.ts 存在性 + 引用锚点
import { existsSync } from 'node:fs'
import { listFiles, readText, extractStringUnion, repoPath } from './census-shared.mjs'

const SEARCH_CONTRACT = 'packages/contracts/src/search.ts'
const SEMANTIC_INDEX = 'apps/local-core/src/semantic-index-service.ts'
const FILE_FORMAT_REGISTRY = 'apps/local-core/src/file-format-registry.ts'
const OCR_SERVICE = 'apps/local-core/src/ocr-service.ts'

export function censusSearch() {
  const searchContract = readText(SEARCH_CONTRACT)
  const semanticSource = readText(SEMANTIC_INDEX)
  const fileFormatSource = readText(FILE_FORMAT_REGISTRY)

  // 分析器清单：文件即事实；id/version 从各 analyzer 源码提取
  const analyzers = listFiles('apps/local-core/src/resources/analyzers', { extension: '-analyzer.ts' }).map((file) => {
    const source = readText(file)
    return {
      file,
      id: /readonly id = ['"]([^'"]+)['"]/.exec(source)?.[1] ?? null,
      version: /readonly version = ['"]([^'"]+)['"]/.exec(source)?.[1] ?? null,
    }
  })

  // FTS5 / vec0：local-core 全量扫描（含模板字面量表名，如实记录原文）
  const coreFiles = listFiles('apps/local-core/src', { recursive: true, extension: '.ts' })
  const ftsTables = []
  const vectorStores = []
  for (const file of coreFiles) {
    const source = readText(file)
    for (const match of source.matchAll(/CREATE VIRTUAL TABLE IF NOT EXISTS (\S+) USING fts5\(/g)) {
      ftsTables.push({ table: match[1], file })
    }
    for (const match of source.matchAll(/CREATE VIRTUAL TABLE IF NOT EXISTS (\$\{[^}]+\}|\S+) USING vec0\(/g)) {
      vectorStores.push({ table: match[1], file })
    }
  }

  // embedding provider：从 semantic-index-service 默认配置推导（不假设 provider 名）
  const embeddingModel = /DEFAULT_EMBEDDING_MODEL = process\.env\.(\w+) \?\? ['"]([^'"]+)['"]/.exec(semanticSource)
  const ollamaUrl = /DEFAULT_OLLAMA_URL = process\.env\.(\w+) \?\? ['"]([^'"]+)['"]/.exec(semanticSource)

  // 文件格式：MIME 映射键 + artifactKind 分支扩展名
  const mimeBlock = /const MIME_BY_EXTENSION[^=]*= \{([\s\S]*?)\}/.exec(fileFormatSource)
  const knownExtensions = mimeBlock === null ? [] : [...mimeBlock[1].matchAll(/'(\.[\w.]+)':/g)].map((m) => m[1])
  const artifactKindBranches = [...fileFormatSource.matchAll(/extension === '(\.[\w.]+)'/g)].map((m) => m[1])

  const ocrReferencedBy = []
  for (const file of coreFiles) {
    if (file === OCR_SERVICE) continue
    if (readText(file).includes("ocr-service")) ocrReferencedBy.push(file)
  }

  return {
    source: {
      entityTypes: SEARCH_CONTRACT,
      analyzers: 'apps/local-core/src/resources/analyzers/*-analyzer.ts',
      tables: 'apps/local-core/src/**/*.ts (CREATE VIRTUAL TABLE scan)',
      embeddingProvider: SEMANTIC_INDEX,
      fileFormats: FILE_FORMAT_REGISTRY,
      ocr: OCR_SERVICE,
    },
    entityTypes: extractStringUnion(searchContract, 'SearchEntityTypeV0'),
    lexicalIndex: { engine: 'fts5', tables: ftsTables },
    vectorIndex: { engine: 'vec0 (sqlite-vec)', stores: vectorStores },
    embeddingProvider: {
      providerEvidence: {
        envVarModel: embeddingModel?.[1] ?? null,
        defaultModel: embeddingModel?.[2] ?? null,
        envVarUrl: ollamaUrl?.[1] ?? null,
        defaultUrl: ollamaUrl?.[2] ?? null,
      },
      note: 'embedding 绑定单一本地 provider（Ollama 默认配置）；S9 Provider 化缺口由该事实登记',
    },
    analyzers,
    fileFormats: {
      knownExtensions,
      artifactKindBranchExtensions: [...new Set(artifactKindBranches)],
      registry: FILE_FORMAT_REGISTRY,
    },
    ocr: {
      present: existsSync(repoPath(OCR_SERVICE)),
      referencedBy: ocrReferencedBy,
    },
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-search.mjs')) {
  console.log(JSON.stringify(censusSearch(), null, 2))
}

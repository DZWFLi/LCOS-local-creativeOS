/**
 * Embedding benchmark：nomic-embed-text vs qwen3-embedding（本地 Ollama）。
 *
 * 用法：
 *   node scripts/embedding-benchmark.mjs                  # 默认 nomic-embed-text
 *   node scripts/embedding-benchmark.mjs qwen3-embedding  # 指定模型（可多次调用）
 *
 * 测量：首次 embed 延迟、单条平均延迟、batch 吞吐、维度；
 * 质量：mini corpus + 3 个 query 的余弦召回（人工核对 top1 是否语义正确）。
 */
const model = process.argv[2] ?? 'nomic-embed-text'
const url = process.env.LCOS_OLLAMA_URL ?? 'http://127.0.0.1:11434'

const corpus = [
  'LCOS 把跨会话上下文持续可视化，让本地 Agent 接手任意项目时不用重新解释一遍。',
  '画布节点支持锚定备注：点击定位会跳转到锚定对象并高亮。',
  'Handoff 可以把当前上下文打包成 zip 交给另一个对话继续。',
  'Reorganize 提案先生成幽灵预览，确认后再应用，并支持安全回滚。',
  '语义检索使用 sqlite-vec 向量索引，检索时同时考虑关键词和语义。',
  'Capture 会自动把新素材放到画布不重叠的位置，避免全部叠在同一个点。',
  'Workflow 是自由视觉结构，不强制 Skill 开始或固定阶段。',
  'Context 快照保存工作现场，可以在历史栏对比两个快照的差异。',
]
const queries = [
  '如何把上下文打包交给另一个对话？',
  '向量检索怎么做到关键词之外的语义匹配？',
  '快照之间怎么对比差异？',
]

async function embed(texts) {
  const response = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  })
  if (!response.ok) throw new Error(`embed ${model} failed: HTTP ${response.status}`)
  const body = await response.json()
  return body.embeddings
}

function cosine(left, right) {
  let dot = 0, la = 0, lb = 0
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i]
    la += left[i] * left[i]
    lb += right[i] * right[i]
  }
  return dot / (Math.sqrt(la) * Math.sqrt(lb) || 1)
}

const out = { model, url, corpusSize: corpus.length, queriedAt: new Date().toISOString() }

// 预热 + 单条延迟
await embed(['预热'])
const single = []
for (let i = 0; i < 8; i++) {
  const started = performance.now()
  await embed(['基准测试句：本地语义检索与上下文管理。'])
  single.push(Math.round((performance.now() - started) * 10) / 10)
}
out.singleEmbedMs = {
  median: single.sort((a, b) => a - b)[Math.floor(single.length / 2)],
  samples: single,
}

// batch 吞吐
const batchStarted = performance.now()
const batchEmbeddings = await embed(corpus)
out.batch16 = {
  count: corpus.length,
  totalMs: Math.round((performance.now() - batchStarted) * 10) / 10,
  perItemMs: Math.round(((performance.now() - batchStarted) / corpus.length) * 10) / 10,
}
out.dimensions = batchEmbeddings[0]?.length ?? 0

// 质量：query → top3
out.queries = []
for (const query of queries) {
  const [q] = await embed([query])
  const ranked = corpus
    .map((text, index) => ({ index, text, score: cosine(q, batchEmbeddings[index]) }))
    .sort((a, b) => b.score - a.score)
  out.queries.push({ query, top3: ranked.slice(0, 3).map((hit) => ({ score: Math.round(hit.score * 10000) / 10000, text: hit.text.slice(0, 40) })) })
}

console.log(JSON.stringify(out, null, 2))

#!/usr/bin/env node
// S9 gate: embedding/retrieval/content/visual provider seams are real and the existing
// SemanticIndexService delegates without reimplementing a second index pipeline.
import { readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] four provider interfaces + registry')
{
  const source = readText('apps/local-core/src/semantic-provider-registry.ts')
  for (const name of ['EmbeddingProvider', 'RetrievalProvider', 'ContentExtractor', 'VisualEmbeddingProvider']) {
    if (!source.includes(`interface ${name}`)) errors.push(`missing interface ${name}`)
  }
  if (!source.includes('class SemanticProviderRegistry')) errors.push('missing SemanticProviderRegistry')
  ok('provider interfaces + registry')
}

console.log('[2/4] Ollama is adapterized; SemanticIndexService no longer owns HTTP embed fetch')
{
  const semantic = readText('apps/local-core/src/semantic-index-service.ts')
  const providers = readText('apps/local-core/src/semantic-provider-registry.ts')
  if (semantic.includes("new URL('/api/embed'")) errors.push('SemanticIndexService still directly implements Ollama HTTP embedding')
  if (!providers.includes("new URL('/api/embed'")) errors.push('OllamaEmbeddingProvider does not own the existing HTTP embed implementation')
  if (!semantic.includes('provider.embed({ model, input })')) errors.push('SemanticIndexService.embed does not delegate to EmbeddingProvider')
  if (!semantic.includes('provider.retrieve({ model, vector, limit')) errors.push('SemanticIndexService.searchVectors does not delegate to RetrievalProvider')
  ok('Ollama/retrieval delegation')
}

console.log('[3/4] default visual embedding remains honestly unimplemented')
{
  const search = readText('apps/local-core/src/search-artifact-body.ts')
  const semantic = readText('apps/local-core/src/semantic-index-service.ts')
  if (search.includes('VisualEmbeddingProvider implements')) errors.push('fake/default visual embedding implementation detected')
  if (semantic.includes('registerVisualEmbedding(')) errors.push('SemanticIndexService auto-registers a visual embedding provider')
  ok('no fake visual provider')
}

console.log('[4/4] fake provider injection regression exists')
{
  const test = readText('apps/local-core/tests/semantic-provider-registry.test.ts')
  if (!test.includes("id: 'fake-embedding'")) errors.push('fake embedding provider injection test missing')
  if (!test.includes("id: 'fake-retrieval'")) errors.push('fake retrieval provider injection test missing')
  if (!test.includes("expect(listed.visualEmbedding).toEqual([])")) errors.push('visual-empty honesty assertion missing')
  ok('injection tests anchored')
}

if (errors.length > 0) {
  console.error(`\nS9 gate FAIL (${errors.length}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('\nS9 gate PASS')

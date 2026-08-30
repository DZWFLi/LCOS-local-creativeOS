#!/usr/bin/env node
// S10 gate: every known file format has an explicit search-index extraction state;
// supported formats resolve to a real extractor in tests, unsupported formats are honest.
import { readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] coverage policy spans file-format registry')
{
  const formats = readText('apps/local-core/src/file-format-registry.ts')
  const coverage = readText('apps/local-core/src/search-format-coverage.ts')
  const extensions = [...formats.matchAll(/'((?:\.[a-z0-9]+))':\s*'[^']+'/g)].map((match) => match[1])
  const unique = [...new Set(extensions)]
  for (const extension of unique) {
    if (!coverage.includes(`'${extension}': {`)) errors.push(`missing explicit coverage row: ${extension}`)
  }
  if (coverage.includes('PLANNED') || coverage.includes('TODO support')) errors.push('coverage contains a planned/TODO support state')
  ok(`${unique.length} known formats have explicit policy rows`)
}

console.log('[2/4] supported text gaps are actually wired')
{
  const body = readText('apps/local-core/src/search-artifact-body.ts')
  for (const mime of ['text/csv', 'application/json', 'application/yaml', 'application/xml', 'text/html']) {
    if (!body.includes(`'${mime}'`)) errors.push(`plain text extractor missing ${mime}`)
  }
  for (const id of ['plain-text', 'pdf-text-layer', 'ooxml-docx-pptx', 'image-ocr-evidence']) {
    if (!body.includes(`'${id}'`)) errors.push(`extractor id missing: ${id}`)
  }
  ok('real extractor registrations anchored')
}

console.log('[3/4] mutation-driven reindex remains the primary path')
{
  const anchors = [
    'apps/local-core/src/import-copy-service.ts',
    'apps/local-core/src/capture-application-service.ts',
    'apps/local-core/src/curation-command-service.ts',
    'apps/local-core/src/runtime-review-service.ts',
    'apps/local-core/src/routes/runtime.ts',
  ]
  for (const file of anchors) {
    if (!readText(file).includes('reindexArtifact')) errors.push(`mutation reindex anchor missing: ${file}`)
  }
  const semantic = readText('apps/local-core/src/semantic-index-service.ts')
  if (!semantic.includes('contentHash')) errors.push('contentHash stale/index idempotency guard missing')
  ok('mutation-driven reindex + contentHash guard kept')
}

console.log('[4/4] executable coverage tests exist')
{
  const test = readText('apps/local-core/tests/search-format-coverage.test.ts')
  if (!test.includes('validateSearchFormatCoverage(registry)')) errors.push('coverage runtime validation test missing')
  if (!test.includes('JSON/YAML/CSV/XML/HTML')) errors.push('new plain-text format regression test missing')
  if (!test.includes("mimeType: 'image/tiff'")) errors.push('unsupported TIFF honesty test missing')
  ok('coverage tests anchored')
}

if (errors.length > 0) {
  console.error(`\nS10 gate FAIL (${errors.length}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('\nS10 gate PASS')

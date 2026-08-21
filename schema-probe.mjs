import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteMetadataRepository } from './apps/local-core/src/metadata-repository.ts'

const dir = mkdtempSync(join(tmpdir(), 'schema-probe-'))
const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
console.log('SCHEMA:', repo.schemaVersion)
repo.close()

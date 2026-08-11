import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'

const cleanup: string[] = []

function vector(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer)
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* ignore */ })))
})

describe('Native sqlite-vec KNN (Phase F)', () => {
  it('loads vec0 when the extension is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lcos-vec-'))
    cleanup.push(dir)
    const repository = new SqliteMetadataRepository(join(dir, 'm.sqlite'))
    const repoRoot = resolve(join(process.cwd(), '..', '..'))
    const dll = join(repoRoot, '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so')
    const loaded = repository.loadVectorExtension(dll)
    expect(loaded).toBe(true)
    expect(repository.vectorStatus().loaded).toBe(true)
  })

  it('querySearchVectors returns nearest neighbors via vec0', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lcos-vec-'))
    cleanup.push(dir)
    const repository = new SqliteMetadataRepository(join(dir, 'm.sqlite'))
    const repoRoot = resolve(join(process.cwd(), '..', '..'))
    const dll = join(repoRoot, '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so')
    repository.loadVectorExtension(dll)
    const projectRoot = join(dir, 'root')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(projectRoot, { recursive: true })
    repository.createProject({ id: 'p1' as never, name: 'Vec', rootPath: projectRoot })

    // 造 search document + embedding（A 与 query 接近，B 远离）
    repository.upsertSearchDocument({ id: 'doc-a', projectId: 'p1', entityType: 'artifact', entityId: 'a', title: 'Alpha', body: 'hello alpha', contentHash: 'h1', updatedAt: new Date().toISOString() })
    repository.upsertSearchDocument({ id: 'doc-b', projectId: 'p1', entityType: 'artifact', entityId: 'b', title: 'Beta', body: 'hello beta', contentHash: 'h2', updatedAt: new Date().toISOString() })
    repository.upsertSearchDocumentEmbedding({ entityId: 'a', model: 'test-model', dimensions: 4, contentHash: 'h1', embeddingBlob: vector([1, 0, 0, 0]), indexedAt: new Date().toISOString() })
    repository.upsertSearchDocumentEmbedding({ entityId: 'b', model: 'test-model', dimensions: 4, contentHash: 'h2', embeddingBlob: vector([0, 0, 1, 0]), indexedAt: new Date().toISOString() })

    const hits = repository.querySearchVectors('test-model', [0.95, 0.1, 0, 0], 2)
    expect(hits[0]?.entityId).toBe('a')
    expect(hits[1]?.entityId).toBe('b')
    expect(hits[0]?.distance).toBeLessThan(hits[1]!.distance)
  })

  it('falls back to blob scan when vec0 is unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lcos-vec-'))
    cleanup.push(dir)
    const repository = new SqliteMetadataRepository(join(dir, 'm.sqlite'))
    const projectRoot = join(dir, 'root')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(projectRoot, { recursive: true })
    repository.createProject({ id: 'p1' as never, name: 'Vec', rootPath: projectRoot })
    repository.upsertSearchDocument({ id: 'doc-a', projectId: 'p1', entityType: 'artifact', entityId: 'a', title: 'Alpha', body: 'hello', contentHash: 'h1', updatedAt: new Date().toISOString() })
    repository.upsertSearchDocumentEmbedding({ entityId: 'a', model: 'm', dimensions: 4, contentHash: 'h1', embeddingBlob: vector([1, 0, 0, 0]), indexedAt: new Date().toISOString() })
    const hits = repository.querySearchVectors('m', [1, 0, 0, 0], 5)
    expect(hits[0]?.entityId).toBe('a')
  })
})

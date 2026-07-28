import { fileURLToPath, pathToFileURL } from 'node:url'

import { createLocalCoreServer, LOCAL_CORE_DEV_PORT } from './server.js'
import { SqliteMetadataRepository } from './metadata-repository.js'
import { ensureMvpSampleProject } from './mvp-sample-project.js'

export { getHealthStatus } from './health.js'
export { ExplicitProjectCatalog } from './project-catalog.js'
export { validateProjectRoot } from './project-root.js'
export { createLocalCoreServer, LOCAL_CORE_DEV_PORT } from './server.js'
export { SqliteMetadataRepository } from './metadata-repository.js'
export { FileRegistryService, TrustedFileSelectionRegistry } from './file-registry-service.js'
export { guardTrustedFilePath } from './path-guard.js'
export { RendererRegistry, DEFAULT_RENDERERS } from './renderer-registry.js'
export { PreviewCacheService } from './preview-cache-service.js'
export { PreviewWorkerService } from './preview-worker-service.js'
export { ensureMvpSampleProject, createMvpSampleSnapshot, MVP_SAMPLE_PROJECT_ID } from './mvp-sample-project.js'

async function main(): Promise<void> {
  const databasePath = process.env.LOCAL_CORE_DB_PATH
    ?? fileURLToPath(new URL('../.data/phase2.sqlite', import.meta.url))
  const testPort = process.env.LOCAL_CORE_TEST_PORT
  const port = testPort === undefined ? LOCAL_CORE_DEV_PORT : Number(testPort)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('LOCAL_CORE_TEST_PORT must be a valid TCP port.')
  }
  const metadataRepository = new SqliteMetadataRepository(databasePath, { disposableOnly: false })
  if (process.env.LOCAL_CORE_DISABLE_MVP_SAMPLE !== '1') {
    const sampleRoot = process.env.LOCAL_CORE_MVP_SAMPLE_ROOT
      ?? fileURLToPath(new URL('../.data/mvp-sample-project', import.meta.url))
    ensureMvpSampleProject(metadataRepository, sampleRoot)
  }
  const server = createLocalCoreServer({ port, metadataRepository })
  const address = await server.start()
  process.stdout.write(`Local Core Phase 2 listening on http://${address.host}:${address.port}\n`)

  const shutdown = () => {
    void server.close().then(() => {
      metadataRepository.close()
      process.exit(0)
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

const entryUrl = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href
if (entryUrl === import.meta.url) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown startup error'
    process.stderr.write(`Local Core failed to start: ${message}\n`)
    process.exitCode = 1
  })
}

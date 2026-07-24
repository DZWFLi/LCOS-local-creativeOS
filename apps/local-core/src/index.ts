import { fileURLToPath, pathToFileURL } from 'node:url'

import { createLocalCoreServer, LOCAL_CORE_DEV_PORT } from './server.js'
import { SqliteMetadataRepository } from './metadata-repository.js'

export { getHealthStatus } from './health.js'
export { ExplicitProjectCatalog } from './project-catalog.js'
export { validateProjectRoot } from './project-root.js'
export { createLocalCoreServer, LOCAL_CORE_DEV_PORT } from './server.js'
export { SqliteMetadataRepository } from './metadata-repository.js'

async function main(): Promise<void> {
  const databasePath = process.env.LOCAL_CORE_DB_PATH
    ?? fileURLToPath(new URL('../.data/phase2.sqlite', import.meta.url))
  const metadataRepository = new SqliteMetadataRepository(databasePath)
  const server = createLocalCoreServer({ port: LOCAL_CORE_DEV_PORT, metadataRepository })
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

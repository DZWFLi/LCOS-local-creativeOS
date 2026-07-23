import { pathToFileURL } from 'node:url'

import { createLocalCoreServer } from './server.js'

export { getHealthStatus } from './health.js'
export { ExplicitProjectCatalog } from './project-catalog.js'
export { validateProjectRoot } from './project-root.js'
export { createLocalCoreServer } from './server.js'

async function main(): Promise<void> {
  const server = createLocalCoreServer()
  const address = await server.start()
  process.stdout.write(`Local Core read-only Phase 1A listening on http://${address.host}:${address.port}\n`)

  const shutdown = () => {
    void server.close().then(() => process.exit(0))
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

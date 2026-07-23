import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import type {
  ProjectCatalog,
  ValidateProjectRootInput,
} from '@local-creative-os/contracts'

import { failure } from './errors.js'
import { getHealthStatus } from './health.js'
import { ExplicitProjectCatalog } from './project-catalog.js'
import { validateProjectRoot } from './project-root.js'

const LOOPBACK_HOST = '127.0.0.1'
const MAX_BODY_BYTES = 64 * 1024
export const LOCAL_CORE_DEV_PORT = 43121

export interface LocalCoreServerOptions {
  readonly host?: string
  readonly port?: number
  readonly catalog?: ProjectCatalog
  readonly allowedRoot?: string
}

export interface LocalCoreAddress {
  readonly host: typeof LOOPBACK_HOST
  readonly port: number
}

export interface LocalCoreServer {
  start(signal?: AbortSignal): Promise<LocalCoreAddress>
  close(): Promise<void>
  address(): LocalCoreAddress | undefined
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RangeError('Request body is too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function statusForError(code: string): number {
  if (code === 'PROJECT_ROOT_NOT_FOUND') return 404
  if (code === 'ABORTED') return 499
  if (code === 'INTERNAL') return 500
  return 400
}

export function createLocalCoreServer(options: LocalCoreServerOptions = {}): LocalCoreServer {
  const host = options.host ?? LOOPBACK_HOST
  if (host !== LOOPBACK_HOST) {
    throw new Error('Local Core may only bind to 127.0.0.1.')
  }

  const catalog = options.catalog ?? new ExplicitProjectCatalog([])
  let server: Server | undefined
  let currentAddress: LocalCoreAddress | undefined

  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.once('aborted', abort)
    response.once('close', () => {
      if (!response.writableEnded) abort()
    })

    try {
      const url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`)
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, getHealthStatus())
        return
      }
      if (request.method === 'GET' && url.pathname === '/projects') {
        const result = await catalog.list(controller.signal)
        sendJson(response, result.ok ? 200 : statusForError(result.error.code), result)
        return
      }
      if (request.method === 'POST' && url.pathname === '/project-roots/validate') {
        let input: unknown
        try {
          input = await readJsonBody(request, controller.signal)
        } catch (error: unknown) {
          const result = error instanceof DOMException && error.name === 'AbortError'
            ? failure('ABORTED', 'Request was aborted.')
            : failure('INVALID_ARGUMENT', 'Request body must be valid JSON under 64 KiB.')
          sendJson(response, statusForError(result.error.code), result)
          return
        }
        if (
          typeof input !== 'object'
          || input === null
          || !('rootPath' in input)
          || typeof input.rootPath !== 'string'
        ) {
          const result = failure('INVALID_ARGUMENT', 'rootPath must be a string.')
          sendJson(response, 400, result)
          return
        }
        const result = await validateProjectRoot((input as ValidateProjectRootInput).rootPath, {
          signal: controller.signal,
          ...(options.allowedRoot === undefined ? {} : { allowedRoot: options.allowedRoot }),
        })
        sendJson(response, result.ok ? 200 : statusForError(result.error.code), result)
        return
      }
      sendJson(response, 404, failure('INVALID_ARGUMENT', 'Route not found.'))
    } catch {
      if (!response.headersSent) sendJson(response, 500, failure('INTERNAL', 'Unexpected Local Core error.'))
      else response.destroy()
    }
  }

  return {
    async start(signal?: AbortSignal): Promise<LocalCoreAddress> {
      if (signal?.aborted) throw new DOMException('Start aborted', 'AbortError')
      if (server !== undefined) throw new Error('Local Core server is already started.')

      const nextServer = createServer((request, response) => {
        void handleRequest(request, response)
      })
      server = nextServer

      const onAbort = () => nextServer.close()
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        await new Promise<void>((resolvePromise, reject) => {
          nextServer.once('error', reject)
          nextServer.listen(options.port ?? 0, host, () => {
            nextServer.off('error', reject)
            resolvePromise()
          })
        })
      } catch (error: unknown) {
        server = undefined
        throw error
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }

      const bound = nextServer.address()
      if (bound === null || typeof bound === 'string') {
        await new Promise<void>((resolvePromise) => nextServer.close(() => resolvePromise()))
        server = undefined
        throw new Error('Local Core did not receive a TCP address.')
      }
      currentAddress = { host: LOOPBACK_HOST, port: bound.port }
      return currentAddress
    },

    async close(): Promise<void> {
      const activeServer = server
      if (activeServer === undefined) return
      await new Promise<void>((resolvePromise, reject) => {
        activeServer.close((error) => {
          if (error) reject(error)
          else resolvePromise()
        })
        activeServer.closeAllConnections()
      })
      server = undefined
      currentAddress = undefined
    },

    address(): LocalCoreAddress | undefined {
      return currentAddress
    },
  }
}

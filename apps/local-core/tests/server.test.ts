import { createServer } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import type { ProjectCatalog } from '@local-creative-os/contracts'

import { ExplicitProjectCatalog } from '../src/project-catalog.js'
import {
  createLocalCoreServer,
  LOCAL_CORE_DEV_PORT,
  type LocalCoreServer,
} from '../src/server.js'

const activeServers: LocalCoreServer[] = []

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((server) => server.close()))
})

async function startServer(server = createLocalCoreServer()): Promise<{
  server: LocalCoreServer
  baseUrl: string
  port: number
}> {
  activeServers.push(server)
  const address = await server.start()
  return {
    server,
    baseUrl: `http://${address.host}:${address.port}`,
    port: address.port,
  }
}

describe('Local Core HTTP server', () => {
  it('publishes one stable loopback development port', () => {
    expect(LOCAL_CORE_DEV_PORT).toBe(43121)
  })

  it('serves health on loopback with no CORS grant', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'local-core',
      mode: 'phase_2_lite',
      version: '0.3.0-phase2',
    })
  })

  it.each(['0.0.0.0', '::', '192.168.1.10'])('rejects non-loopback host %s', (host) => {
    expect(() => createLocalCoreServer({ host })).toThrow('only bind to 127.0.0.1')
  })

  it.each([0, -1, Number.POSITIVE_INFINITY])('rejects invalid request timeout %s', (requestTimeoutMs) => {
    expect(() => createLocalCoreServer({ requestTimeoutMs })).toThrow('positive finite number')
  })

  it('serves only the explicitly injected project catalog', async () => {
    const entry = { id: 'p1', name: 'PortaSplit', rootPath: 'E:\\PortaSplit' }
    const catalog = new ExplicitProjectCatalog([entry])
    const { baseUrl } = await startServer(createLocalCoreServer({ catalog }))
    const response = await fetch(`${baseUrl}/projects`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, value: [entry] })
  })

  it('rejects duplicate ids from the explicit catalog at the HTTP boundary', async () => {
    const catalog = new ExplicitProjectCatalog([
      { id: 'duplicate', name: 'One', rootPath: 'E:\\One' },
      { id: 'duplicate', name: 'Two', rootPath: 'E:\\Two' },
    ])
    const { baseUrl } = await startServer(createLocalCoreServer({ catalog }))
    const response = await fetch(`${baseUrl}/projects`)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    })
  })

  it('validates a project root through the HTTP boundary', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/project-roots/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath: process.cwd() }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      value: { exists: true, isDirectory: true, readable: true },
    })
  })

  it('returns a stable error instead of a system stack', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/project-roots/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath: '' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(JSON.stringify(body)).not.toContain('stack')
  })

  it('enforces the configured allowed root at the HTTP boundary', async () => {
    const { baseUrl } = await startServer(createLocalCoreServer({ allowedRoot: process.cwd() }))
    const response = await fetch(`${baseUrl}/project-roots/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath: process.env.SystemRoot ?? 'C:\\Windows' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'PATH_OUTSIDE_ALLOWED_ROOT' },
    })
  })

  it('rejects malformed JSON with a stable error', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/project-roots/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT', origin: 'runtime' },
    })
  })

  it('rejects request bodies larger than the read-only limit', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/project-roots/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rootPath: 'x'.repeat(2 * 1024 * 1024) }), // 2 MiB > 1 MiB limit
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    })
  })

  it('returns a stable error for an unknown route', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}/not-a-route`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    })
  })

  it('aborts a slow boundary operation when the request timeout expires', async () => {
    const neverCompletes: ProjectCatalog = {
      async list() {
        return await new Promise(() => undefined)
      },
    }
    const { baseUrl } = await startServer(createLocalCoreServer({
      catalog: neverCompletes,
      requestTimeoutMs: 20,
    }))
    const response = await fetch(`${baseUrl}/projects`)

    expect(response.status).toBe(408)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'ABORTED', message: 'Request timed out.' },
    })
  })

  it('supports an aborted start signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const server = createLocalCoreServer()

    await expect(server.start(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(server.address()).toBeUndefined()
  })

  it('does not lose an abort raised while the server is starting', async () => {
    const controller = new AbortController()
    const server = createLocalCoreServer()
    const started = server.start(controller.signal)
    controller.abort()

    await expect(started).rejects.toMatchObject({ name: 'AbortError' })
    expect(server.address()).toBeUndefined()
  })

  it('uses the lifecycle signal to close an already started server', async () => {
    const controller = new AbortController()
    const { server, port } = await startServer(createLocalCoreServer())
    await server.close()

    const lifecycleServer = createLocalCoreServer({ port })
    activeServers.push(lifecycleServer)
    await lifecycleServer.start(controller.signal)
    controller.abort()

    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 20))
    expect(lifecycleServer.address()).toBeUndefined()

    const rebound = createServer()
    await new Promise<void>((resolvePromise, reject) => {
      rebound.once('error', reject)
      rebound.listen(port, '127.0.0.1', () => resolvePromise())
    })
    await new Promise<void>((resolvePromise) => rebound.close(() => resolvePromise()))
  })

  it('gracefully closes and releases its port for immediate rebinding', async () => {
    const { server, port } = await startServer()
    await server.close()

    const rebound = createServer()
    await new Promise<void>((resolvePromise, reject) => {
      rebound.once('error', reject)
      rebound.listen(port, '127.0.0.1', () => resolvePromise())
    })
    await new Promise<void>((resolvePromise, reject) => {
      rebound.close((error) => error ? reject(error) : resolvePromise())
    })
  })
})

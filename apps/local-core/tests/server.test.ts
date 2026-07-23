import { createServer } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

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
      mode: 'read_only_phase_1a',
      version: '0.1.0',
    })
  })

  it.each(['0.0.0.0', '::', '192.168.1.10'])('rejects non-loopback host %s', (host) => {
    expect(() => createLocalCoreServer({ host })).toThrow('only bind to 127.0.0.1')
  })

  it('serves only the explicitly injected project catalog', async () => {
    const entry = { id: 'p1', name: 'PortaSplit', rootPath: 'E:\\PortaSplit' }
    const catalog = new ExplicitProjectCatalog([entry])
    const { baseUrl } = await startServer(createLocalCoreServer({ catalog }))
    const response = await fetch(`${baseUrl}/projects`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, value: [entry] })
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

  it('supports an aborted start signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const server = createLocalCoreServer()

    await expect(server.start(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(server.address()).toBeUndefined()
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

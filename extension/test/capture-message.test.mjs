import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { buildCaptureRequestV1, validateCaptureRequest, KINDS } = require('../shared/capture-message.js')
const { submitCapture } = require('../shared/localhost-client.js')

describe('Phase 5 Slice 3 — extension capture message', () => {
  it('exposes exactly the six V1 source kinds', () => {
    expect([...KINDS]).toEqual(['page', 'selection', 'image', 'link', 'screenshot', 'text'])
  })

  it('builds and validates a page capture request', () => {
    const request = buildCaptureRequestV1({ kind: 'page', pageUrl: 'https://example.com', pageTitle: 'Example' })
    expect(validateCaptureRequest(request)).toBe(request)
    expect(request.schemaVersion).toBe(1)
    expect(request.target).toEqual({ mode: 'staging' })
    expect(request.operationId).toMatch(/^ext-/)
  })

  it('rejects invalid kinds, schemas and targets', () => {
    expect(() => buildCaptureRequestV1({ kind: 'nope', mode: 'auto' })).toThrow(/Unsupported source kind/)
    expect(() => buildCaptureRequestV1({ kind: 'page', mode: 'other' })).toThrow(/target.mode/)
    expect(() => validateCaptureRequest({ schemaVersion: 0 })).toThrow(/schemaVersion 1/)
  })

  it('submits through the localhost gateway', async () => {
    const seen = []
    globalThis.fetch = async (url, init) => {
      seen.push({ url, method: init?.method, token: init?.headers?.['x-lcos-token'] })
      if (String(url).endsWith('/runtime/extension-token')) {
        return { ok: true, json: async () => ({ ok: true, value: { token: 'test-token' } }) }
      }
      return { ok: true, json: async () => ({ ok: true, value: { receipt: { status: 'staged' }, destinationLabel: '暂存区', destination: 'staging' } }) }
    }
    const result = await submitCapture(buildCaptureRequestV1({ kind: 'text', text: 'hello', mode: 'staging' }))
    expect(result.destination).toBe('staging')
    expect(seen.some((entry) => String(entry.url).includes('/capture/v1') && entry.token === 'test-token')).toBe(true)
    delete globalThis.fetch
  })
})

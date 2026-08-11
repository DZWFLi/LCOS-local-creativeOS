import { describe, expect, it, vi } from 'vitest'
import { LocalIntelligenceService } from '../src/local-intelligence-service.js'

describe('LocalIntelligenceService', () => {
  it('reports unavailable when Ollama is not reachable', async () => {
    const service = new LocalIntelligenceService('http://127.0.0.1:1')
    const status = await service.status()
    expect(status.available).toBe(false)
    expect(status.embeddingModels).toEqual([])
  })

  it('rejects non-loopback endpoints', async () => {
    const service = new LocalIntelligenceService('http://example.com:11434')
    const status = await service.status()
    expect(status.available).toBe(false)
    expect(status.provider).toBe('none')
  })

  it('reports available with model split when Ollama responds', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = String(input)
      if (path.endsWith('/api/version')) {
        return { ok: true, json: async () => ({ version: '0.8.0' }) } as Response
      }
      if (path.endsWith('/api/tags')) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: 'nomic-embed-text:latest' },
              { name: 'qwen2.5:0.5b' },
            ],
          }),
        } as Response
      }
      return { ok: false, json: async () => ({}) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const service = new LocalIntelligenceService('http://127.0.0.1:11434')
      const status = await service.status()
      expect(status.available).toBe(true)
      expect(status.version).toBe('0.8.0')
      expect(status.embeddingModels).toEqual(['nomic-embed-text:latest'])
      expect(status.generativeModels).toEqual(['qwen2.5:0.5b'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports unavailable when Ollama returns non-OK', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    try {
      const service = new LocalIntelligenceService('http://127.0.0.1:11434')
      const status = await service.status()
      expect(status.available).toBe(false)
      expect(status.provider).toBe('ollama')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

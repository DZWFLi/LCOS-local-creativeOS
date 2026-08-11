/**
 * Phase A：Local Intelligence capability probe。
 *
 * 只探测，不启动、不下载、不阻塞主链。
 * probe 失败 → available=false，Runtime/Core 照常工作。
 */
export interface LocalIntelligenceStatusV0 {
  readonly provider: 'ollama' | 'none'
  readonly available: boolean
  readonly endpoint?: string
  readonly version?: string
  readonly embeddingModels: readonly string[]
  readonly generativeModels: readonly string[]
}

const DEFAULT_OLLAMA_URL = process.env.LCOS_OLLAMA_URL ?? 'http://127.0.0.1:11434'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

function unavailable(): LocalIntelligenceStatusV0 {
  return { provider: 'none', available: false, embeddingModels: [], generativeModels: [] }
}

export class LocalIntelligenceService {
  readonly #baseUrl: string

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL) {
    this.#baseUrl = baseUrl
  }

  async status(): Promise<LocalIntelligenceStatusV0> {
    try {
      const url = new URL(this.#baseUrl)
      if (!LOOPBACK_HOSTS.has(url.hostname)) return unavailable()
      const [versionResponse, tagsResponse] = await Promise.all([
        fetch(`${this.#baseUrl}/api/version`, { signal: AbortSignal.timeout(2_500) }),
        fetch(`${this.#baseUrl}/api/tags`, { signal: AbortSignal.timeout(2_500) }),
      ])
      if (!versionResponse.ok || !tagsResponse.ok) {
        return { provider: 'ollama', available: false, endpoint: this.#baseUrl, embeddingModels: [], generativeModels: [] }
      }
      const versionBody = (await versionResponse.json()) as { version?: unknown }
      const tagsBody = (await tagsResponse.json()) as { models?: Array<{ name?: unknown }> }
      const models = (tagsBody.models ?? [])
        .map((model) => (typeof model?.name === 'string' ? model.name : ''))
        .filter((name) => name.length > 0)
      const embeddingModels = models.filter((name) => /embed|bge|nomic/i.test(name))
      const generativeModels = models.filter((name) => !/embed|bge|nomic/i.test(name))
      return {
        provider: 'ollama',
        available: true,
        endpoint: this.#baseUrl,
        ...(typeof versionBody.version === 'string' ? { version: versionBody.version } : {}),
        embeddingModels,
        generativeModels,
      }
    } catch {
      return unavailable()
    }
  }
}

import type { OcrResultV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

let client: Pick<LocalCoreClient, 'ocr'> | null = null
const cache = new Map<string, OcrResultV1 | 'failed'>()

export function setOcrClient(value: Pick<LocalCoreClient, 'ocr'> | null): void {
  client = value
}

export function clearOcrCache(): void {
  cache.clear()
}

/** 悬停触发 OCR：按 artifactId 缓存，识别失败也缓存，避免重复打扰。 */
export async function runOcr(artifactId: string): Promise<OcrResultV1 | null> {
  if (client === null) return null
  const cached = cache.get(artifactId)
  if (cached !== undefined) return cached === 'failed' ? null : cached
  try {
    const call = await client.ocr(artifactId)
    if (!call.result.ok) {
      cache.set(artifactId, 'failed')
      return null
    }
    cache.set(artifactId, call.result.value)
    return call.result.value
  } catch {
    cache.set(artifactId, 'failed')
    return null
  }
}

import { createContext, useContext } from 'react'
import type { LocalCoreClient } from './localCoreClient'

const LocalCoreClientContext = createContext<LocalCoreClient | null>(null)

export const LocalCoreClientProvider = LocalCoreClientContext.Provider

/** 可空版本：client 缺席时返回 null，可选能力据此诚实降级（按钮禁用）而不是抛错。 */
export function useLocalCoreClientOrNull(): LocalCoreClient | null {
  return useContext(LocalCoreClientContext)
}

export function useLocalCoreClient(): LocalCoreClient {
  const client = useContext(LocalCoreClientContext)
  if (client === null) {
    throw new Error('useLocalCoreClient must be used within a LocalCoreClientProvider')
  }
  return client
}

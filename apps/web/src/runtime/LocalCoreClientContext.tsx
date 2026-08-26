import { createContext, useContext } from 'react'
import type { LocalCoreClient } from './localCoreClient'

const LocalCoreClientContext = createContext<LocalCoreClient | null>(null)

export const LocalCoreClientProvider = LocalCoreClientContext.Provider

export function useLocalCoreClient(): LocalCoreClient {
  const client = useContext(LocalCoreClientContext)
  if (client === null) {
    throw new Error('useLocalCoreClient must be used within a LocalCoreClientProvider')
  }
  return client
}

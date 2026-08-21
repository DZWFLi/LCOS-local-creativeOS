import type { ProjectEventOrigin } from '@local-creative-os/contracts'

const CLIENT_ID_KEY = 'lcos:realtime-client-id:v1'
const sessionId = crypto.randomUUID()
let clientSeq = 0

function clientId(): string {
  if (typeof window === 'undefined') return 'lcos-web-test'
  const existing = window.localStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(CLIENT_ID_KEY, created)
  return created
}

export function nextMutationOrigin(sourceSurface?: string): ProjectEventOrigin {
  clientSeq += 1
  return {
    clientId: clientId(),
    sessionId,
    clientSeq,
    operationId: crypto.randomUUID(),
    ...(sourceSurface === undefined ? {} : { sourceSurface }),
  }
}

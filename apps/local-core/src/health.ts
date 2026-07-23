import type { HealthStatus } from '@local-creative-os/contracts'

export const LOCAL_CORE_VERSION = '0.2.0-lite'

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: 'local-core',
    mode: 'phase_2_lite',
    version: LOCAL_CORE_VERSION,
  }
}

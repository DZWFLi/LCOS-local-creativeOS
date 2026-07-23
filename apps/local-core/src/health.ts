import type { HealthStatus } from '@local-creative-os/contracts'

export const LOCAL_CORE_VERSION = '0.1.0'

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: 'local-core',
    mode: 'read_only_phase_1a',
    version: LOCAL_CORE_VERSION,
  }
}

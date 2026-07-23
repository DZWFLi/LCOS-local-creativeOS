import { describe, expect, it } from 'vitest'

import { getHealthStatus } from '../src/health.js'

describe('health', () => {
  it('reports only the real Phase 1A read-only capability', () => {
    expect(getHealthStatus()).toEqual({
      status: 'ok',
      service: 'local-core',
      mode: 'read_only_phase_1a',
      version: '0.1.0',
    })
  })
})

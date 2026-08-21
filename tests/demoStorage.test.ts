import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoState, DEMO_SCHEMA_VERSION } from '../src/demo/seed'
import { demoStorage } from '../src/infrastructure/demoStorage'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('demoStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  it('saves and restores a versioned project envelope', () => {
    const state = createDemoState()
    demoStorage.save('portasplit', state)

    const stored = JSON.parse(localStorage.getItem('adframe.demo-state.v1') ?? '{}') as {
      schemaVersion?: number
      projectId?: string
    }

    expect(stored.schemaVersion).toBe(DEMO_SCHEMA_VERSION)
    expect(stored.projectId).toBe('portasplit')
    expect(demoStorage.load('portasplit')).toEqual(state)
  })

  it('falls back to a fresh seed when stored data is corrupt', () => {
    localStorage.setItem('adframe.demo-state.v1', '{invalid json')

    expect(demoStorage.load('portasplit')).toEqual(createDemoState())
  })

  it('reset removes legacy keys and writes the deterministic seed', () => {
    localStorage.setItem('adframe.script-versions.v2', 'legacy')
    const reset = demoStorage.reset('portasplit')

    expect(reset).toEqual(createDemoState())
    expect(localStorage.getItem('adframe.script-versions.v2')).toBeNull()
    expect(demoStorage.load('portasplit')).toEqual(reset)
  })
})

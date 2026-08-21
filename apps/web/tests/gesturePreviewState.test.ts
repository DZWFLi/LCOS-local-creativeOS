import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('HU-3 GesturePreviewStore boundary', () => {
  const raw = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'gesturePreviewState.ts'), 'utf8')
  const source = raw.split(/\r?\n/).filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n')

  it('has no persistence API / localStorage / Core mirror', () => {
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|coreRequest|localCoreClient|fetch\(/)
  })

  it('documents never-persisted / never-undone contract', () => {
    expect(raw).toMatch(/never persisted/)
    expect(raw).toMatch(/never undone/)
  })
})

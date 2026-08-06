import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = join(__dirname, '../../apps/web/src')
const files: string[] = []
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path)
  }
}
walk(webRoot)
const relative = (path: string): string => path.replace(/\\/g, '/')

describe('qa-fixtures boundary (Phase 2)', () => {
  it('keeps production source free of qa-fixtures imports', () => {
    const offenders = files.filter((path) => /from ['"].*qa-fixtures/.test(readFileSync(path, 'utf8')))
    expect(offenders.map(relative)).toEqual([])
  })

  it('moves the blank project state factory into production state/', () => {
    const factory = readFileSync(join(webRoot, 'state/projectState.ts'), 'utf8')
    expect(factory).toContain('createBlankProjectState')
    expect(factory).not.toMatch(/fixture/i)
  })
})

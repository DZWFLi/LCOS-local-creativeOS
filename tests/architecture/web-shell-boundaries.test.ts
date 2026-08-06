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
walk(join(webRoot, 'features'))
const relative = (path: string): string => path.replace(/\\/g, '/')

describe('web shell boundaries (Phase 1/2)', () => {
  it('keeps feature components free of App.tsx imports', () => {
    const offenders = files.filter((path) => /from ['"].*App['"]/.test(readFileSync(path, 'utf8')))
    expect(offenders.map(relative)).toEqual([])
  })

  it('keeps the runtime client free of feature imports', () => {
    const client = readFileSync(join(webRoot, 'runtime/localCoreClient.ts'), 'utf8')
    expect(client).not.toMatch(/from ['"].*features\//)
  })
})

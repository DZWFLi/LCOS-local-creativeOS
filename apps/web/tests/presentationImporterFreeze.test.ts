import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * HU-3 §14：legacy importer freeze。
 * presentationDraftState / presentationHierarchyState 的 importer 列表只许减少，不许新增。
 */
const WEB_ROOT = join(import.meta.dirname, '..', 'src')

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path)
  }
  return files
}

function importersOf(moduleFile: string): string[] {
  const basename = moduleFile.replace(/\.tsx?$/, '')
  const importers: string[] = []
  for (const file of walk(WEB_ROOT)) {
    if (relative(WEB_ROOT, file).replace(/\\/g, '/') === relative(WEB_ROOT, moduleFile).replace(/\\/g, '/')) continue
    const source = readFileSync(file, 'utf8')
    const importPattern = new RegExp(`from ['"].*${basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:['"]|\\.)`)
    const dynamicPattern = new RegExp(`import\\(['"].*${basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    if (importPattern.test(source) || dynamicPattern.test(source)) {
      importers.push(relative(WEB_ROOT, file).replace(/\\/g, '/'))
    }
  }
  return importers.sort()
}

describe('HU-3 Presentation importer freeze', () => {
  it('presentationDraftState importers may only shrink (baseline frozen)', () => {
    const baseline = [
      'features/surfaces/ContextFlowSurface.tsx',
      'features/surfaces/ContextGraphSurface.tsx',
      'features/surfaces/ContextTreeSurface.tsx',
      'features/surfaces/OutlineSurface.tsx',
      'features/surfaces/WorkflowSurface.tsx',
    ]
    const current = importersOf(join(WEB_ROOT, 'state/presentationDraftState.ts'))
    for (const importer of current) {
      expect(baseline).toContain(importer)
    }
  })

  it('presentationHierarchyState importers may only shrink (baseline frozen)', () => {
    const baseline = [
      'features/surfaces/ContextTreeSurface.tsx',
      'features/surfaces/OutlineSurface.tsx',
      'features/surfaces/WorkflowSurface.tsx',
    ]
    const current = importersOf(join(WEB_ROOT, 'state/presentationHierarchyState.ts'))
    for (const importer of current) {
      expect(baseline).toContain(importer)
    }
  })
})

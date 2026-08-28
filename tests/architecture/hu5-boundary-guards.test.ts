import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(path)
  }
  return out
}

function importersOf(dir: string, moduleFile: string): string[] {
  const basename = moduleFile.replace(/\.tsx?$/, '')
  return walk(dir)
    .filter((file) => relative(dir, file).replace(/\\/g, '/') !== relative(dir, moduleFile).replace(/\\/g, '/'))
    .filter((file) => {
      const source = readFileSync(file, 'utf8')
      const pattern = new RegExp(`from ['"].*${basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:['"]|\\.)`)
      return pattern.test(source)
    })
    .map((file) => relative(dir, file).replace(/\\/g, '/'))
    .sort()
}

describe('HU-5 architecture boundary guards', () => {
  it('presentation bridge importer list only shrinks（HU-3 迁移完成后可清空）', () => {
    const web = join(ROOT, 'apps', 'web', 'src')
    const baseline = ['App.tsx', 'state/presentationDraftState.ts', 'state/presentationHierarchyState.ts']
    const current = importersOf(web, join(web, 'state', 'presentationViewState.ts'))
    for (const importer of current) {
      expect(baseline, `new importer: ${importer}`).toContain(importer)
    }
  })

  it('legacy semantic heuristic（surfaceModel）importer list only shrinks', () => {
    const web = join(ROOT, 'apps', 'web', 'src')
    const baseline = [
      'features/surfaces/DeliverSurface.tsx',
      'features/surfaces/SurfaceObject.tsx',
      'features/surfaces/WorkSurface.tsx',
    ]
    const current = importersOf(web, join(web, 'features', 'surfaces', 'surfaceModel.ts'))
    for (const importer of current) {
      expect(baseline, `new semantic-heuristic importer: ${importer}`).toContain(importer)
    }
  })

  it('routes never touch raw SQL or a direct database handle', () => {
    const routes = join(ROOT, 'apps', 'local-core', 'src', 'routes')
    for (const file of walk(routes)) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/new DatabaseSync|node:sqlite|database\.prepare|database\.exec/)
    }
  })

  it('provider adapters stay out of domain / contracts / core domain files', () => {
    for (const dir of ['packages/domain/src', 'packages/contracts/src']) {
      for (const file of walk(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8')
        // 禁止 SDK/适配器 import；存储字面量（如 provider: 'ollama'）不是适配器依赖。
        expect(source, `${dir}/${file}`).not.toMatch(/from ['"].*(ollama|deepseek)|import\(['"].*(ollama|deepseek)|@ollama|deepseek[-_/]/i)
      }
    }
    const core = join(ROOT, 'apps', 'local-core', 'src')
    const allowed = new Set([
      'semantic-index-service.ts',
      'conversation-import-service.ts',
      'local-intelligence-service.ts',
      'index.ts',
      'compose.ts',
      'server.ts',
      // type-only 注入依赖：semantic 服务由组合层构造后注入，非适配器直连。
      'project-search-service.ts',
      // F6 P0-A2 同款 type-only 注入：materialize 即索引的可选挂点（compose 注入，
      // 缺席时行为不变），capture-application-service 无运行时 adapter import。
      'capture-application-service.ts',
      // F6 索引注入挂点（type-only：import type / inline 类型引用，compose.ts 构造注入，
      // 无运行时 adapter import）——curation apply / import copy / review 即索引 / 路由类型聚合。
      'curation-command-service.ts',
      'import-copy-service.ts',
      'runtime-review-service.ts',
      'runtime.ts',
    ])
    for (const file of walk(core)) {
      const name = relative(core, file).replace(/\\/g, '/').split('/').at(-1) ?? ''
      if (allowed.has(name)) continue
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/from ['"].*(ollama|deepseek|semantic-index-service)|import\(['"].*(ollama|deepseek|semantic-index-service)|@ollama/i)
    }
  })

  it('web never imports the metadata repository or knows SQLite schema', () => {
    for (const file of walk(join(ROOT, 'apps', 'web', 'src'))) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/metadata-repository|node:sqlite|DatabaseSync|phase2\.sqlite/)
    }
  })

  it('contracts never grow per-skill business entities (Brief/Stage/Decision)', () => {
    for (const file of walk(join(ROOT, 'packages', 'contracts', 'src'))) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/BriefEntity|StageEntity|DecisionEntity/)
    }
  })
})

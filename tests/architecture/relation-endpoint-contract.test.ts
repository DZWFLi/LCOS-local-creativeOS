import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const domain = readFileSync(join(root, 'packages/domain/src/index.ts'), 'utf8')
// B6（20260828）：relations 路由已从 entity.ts 迁至 routes/relations.ts（ChangeSet-backed；
// entity.ts 中同路径段为不可达死代码并被清除）。归属校验的活体实现现在在 relations.ts。
const entityRoute = readFileSync(join(root, 'apps/local-core/src/routes/relations.ts'), 'utf8')

describe('Relation endpoint ownership contract (Phase A)', () => {
  it('Domain RelationEntityType declares all five endpoint kinds', () => {
    expect(domain).toContain("export type RelationEntityType = 'artifact' | 'note' | 'scope' | 'view' | 'workspace'")
  })

  it('Core route ownership validation covers view and workspace endpoints', () => {
    expect(entityRoute).toContain("if (entityType === 'view')")
    expect(entityRoute).toContain('metadata.getArtifactView(entityId)')
    expect(entityRoute).toContain("if (entityType === 'workspace')")
    expect(entityRoute).toContain('metadata.getWorkspace(entityId)')
    expect(entityRoute).toContain('relationEntityBelongsToProject')
  })

  it('view ownership resolves through artifact_view → artifact → project', () => {
    expect(entityRoute).toContain('String(view.artifactId)')
    expect(entityRoute).toContain("metadata.getArtifact(String(view.artifactId))")
    expect(entityRoute).toContain("?.projectId ?? ''")
  })

  it('workspace ownership resolves directly through workspace.projectId', () => {
    expect(entityRoute).toContain("String(metadata.getWorkspace(entityId)?.projectId ?? '') === projectId")
  })
})

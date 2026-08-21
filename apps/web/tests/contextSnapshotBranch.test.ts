import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Context Snapshot Branch single truth source (source contract)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/surfaces/ContextHistoryRail.tsx', import.meta.url), 'utf8')

  it('branches through Core branchContextSnapshot instead of local workspace reconstruction', () => {
    expect(app).toContain('branchContextSnapshot(activeProjectId, String(snapshot.id)')
    expect(app).toContain('已从 ${entry.label} 分支为工作集合')
    expect(app).not.toContain('已从 ${entry.label} 建立 Workspace')
  })

  it('keeps the branch action copy aligned with Core collection-branch semantics', () => {
    expect(rail).toContain('从这里分支')
    expect(rail).not.toContain('从这里建现场')
  })
})

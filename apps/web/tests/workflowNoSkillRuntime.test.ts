import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../../..')
const workflow = readFileSync(join(root, 'apps/web/src/features/surfaces/WorkflowSurface.tsx'), 'utf8')

describe('Workflow has no Skill runtime CTA (Phase C C10)', () => {
  it('removes the special Skill entry points', () => {
    expect(workflow).not.toContain("onStart?.('skill')")
    expect(workflow).not.toContain('项目 Skill')
  })

  it('removes the Agent start action and keeps Selection as the only start action', () => {
    expect(workflow).toContain("onStart?.('selection')")
    expect(workflow).not.toContain("onStart?.('agent')")
  })
})

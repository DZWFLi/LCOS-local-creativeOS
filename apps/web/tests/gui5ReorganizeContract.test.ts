import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const client = readFileSync(new URL('../src/runtime/localCoreClient.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/features/reorganize/ReorganizePanel.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const contract = readFileSync(new URL('../../../packages/contracts/src/reorganize.ts', import.meta.url), 'utf8')
const core = readFileSync(new URL('../../local-core/src/reorganize-service.ts', import.meta.url), 'utf8')

describe('GUI-5 Reorganize contract', () => {
  it('client exposes proposal / preview / apply / accept / rollback / reject', () => {
    for (const method of [
      'createReorganizeProposal',
      'previewReorganize',
      'applyReorganize',
      'acceptReorganize',
      'rollbackReorganize',
      'rejectReorganize',
    ]) {
      expect(client, method).toContain(method)
    }
  })

  it('panel shows change summary but broad reorganize never physically deletes Artifacts', () => {
    expect(panel).toContain('lcos-reorganize-change-summary')
    expect(panel).toContain('归组')
    expect(panel).toContain('移出当前画布')
    expect(panel).not.toContain('confirmDelete')
    expect(panel).toContain('willRemovePresentationMembers')
  })

  it('persists real position changes in the safe ChangeSet and mirrors them live instead of stopping at ghost preview', () => {
    expect(contract).toContain('positionPatch?:')
    expect(contract).toContain('positionChanges: number')
    expect(core).toContain('proposal.positionPatch')
    expect(core).toContain("touchedKeys: ['memberViewIds', 'positions'")
    expect(panel).toContain('buildSafeReorganizePositions')
    expect(panel).toContain('positionPatch: Object.fromEntries')
    expect(panel).toContain("onLivePositions?.(positionPlan, 'apply')")
    expect(app).toContain('onLivePositions={(positions)')
    expect(canvas).toContain('transition')
  })

  it('review closes through real whole-ChangeSet accept / safe rollback', () => {
    expect(panel).toContain('acceptReorganize')
    expect(core).toContain('accept(id: string)')
    expect(panel).toContain('rollbackReorganize')
    expect(panel).toContain('已安全撤回本轮整理')
    expect(panel).toContain('本轮整理已撤回，画布回到安全状态。')
  })
})

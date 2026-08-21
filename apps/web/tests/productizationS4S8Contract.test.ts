import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest workspace 的 cwd 是 apps/web，PASS5 初版按仓库根拼接导致 ENOENT。
const webRoot = join(process.cwd(), 'src')
const source = (...parts: string[]) => readFileSync(join(webRoot, ...parts), 'utf8')

describe('0.1 productization S4-S8 wiring', () => {
  it('keeps SurfaceAgent local to Context/Workflow and binds a stable local session with reply summary', () => {
    const node = source('features', 'shell', 'SurfaceAgentNode.tsx')
    const scene = source('features', 'shell', 'CanvasSceneHost.tsx')
    expect(node).toContain('surface-agent-${crypto.randomUUID()}')
    expect(node).toContain('onReadRun')
    expect(node).toContain('runState?.summary')
    expect(scene).toContain('surface={capabilityKind}')
    expect(scene).toContain("capabilityKind !== 'arrange'")
  })

  it('uses the existing Context Proposal chain and exposes keep/modify/remove review actions', () => {
    const surface = source('features', 'shell', 'AgentContextSurface.tsx')
    const app = source('App.tsx')
    expect(surface).toContain('onModifyProposal')
    expect(surface).toContain('保留')
    expect(surface).toContain('修改')
    expect(surface).toContain('撤掉')
    expect(app).toContain('propose_lcos_context_change')
    expect(app).toContain('requestContextProposalModification')
  })

  it('exposes revision upgrade only from a completed Agent result', () => {
    const rail = source('features', 'workrail', 'WorkRail.tsx')
    const dialog = source('features', 'workrail', 'RevisionUpgradeDialog.tsx')
    expect(rail).toContain('基于反馈生成下一版')
    expect(rail).toContain('run.resultArtifactId')
    expect(dialog).toContain('只从已经完成的 Agent 结果进入这条链，不作为普通文件编辑入口。')
  })

  it('keeps Boundary AI behind deterministic evidence/cooldown gates', () => {
    const scene = source('features', 'shell', 'CanvasSceneHost.tsx')
    expect(scene).toContain('props.depositHints?.evaluate')
    expect(scene).toContain('boundaryEvaluatedRef')
    expect(scene).toContain('shouldShowDepositHint')
  })
})

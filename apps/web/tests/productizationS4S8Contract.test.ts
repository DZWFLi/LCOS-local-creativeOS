import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest workspace 的 cwd 是 apps/web，PASS5 初版按仓库根拼接导致 ENOENT。
const webRoot = join(process.cwd(), 'src')
const source = (...parts: string[]) => readFileSync(join(webRoot, ...parts), 'utf8')

describe('0.1 productization S4-S8 wiring', () => {
  it('retires SurfaceAgentNode; Context/Workflow execute through UnifiedExecutionComposer (F6 anti-regression)', () => {
    // F6 truth：SurfaceAgentNode 已删除，不再是 Context/Workflow execution owner；
    // 执行入口收敛到 UnifiedExecutionComposer（同一 CommandDraft 契约）。
    expect(existsSync(join(webRoot, 'features', 'shell', 'SurfaceAgentNode.tsx'))).toBe(false)
    const scene = source('features', 'shell', 'CanvasSceneHost.tsx')
    expect(scene).toContain('UnifiedExecutionComposer')
    expect(scene).toContain("capabilityKind !== 'arrange'")
    // 无 synthetic surface-agent-* session identity：receiver 身份只来自 canonical 会话链。
    expect(scene).not.toContain('surface-agent-')
    expect(scene).toContain('ConnectedConversationV1')
    // Proposal 对未支持 contract fail-close（commandDraft 边界诚实）。
    const draft = source('features', 'execution', 'commandDraft.ts')
    expect(draft).toContain('fail-close')
    expect(draft).toContain('已阻止伪造引用')
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

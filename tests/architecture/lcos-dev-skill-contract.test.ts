import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skills = join(root, 'packages/skills')
const backend = readFileSync(join(skills, 'local-creative-os-backend-flow/SKILL.md'), 'utf8')
const frontend = readFileSync(join(skills, 'local-creative-os-frontend-loop/SKILL.md'), 'utf8')
const workbuddy = readFileSync(join(skills, 'workbuddy-orchestrator/SKILL.md'), 'utf8')

describe('LCOS dev/orchestrator Skill V4.3 boundaries', () => {
  it('turns backend-flow into the system/backend maintenance kernel without duplicating project Curator', () => {
    expect(backend).toContain('Repository / Runtime 是 LCOS 自身事实源')
    expect(backend).toContain('capability')
    expect(backend).toContain('纯前端交互与视觉回归（frontend-loop）')
  })

  it('keeps current frontend product principles separate from the legacy PASS8/Make baseline', () => {
    expect(frontend).toContain('Entity First, Surface Second')
    expect(frontend).toContain('Search 与 Focus 分离')
    expect(frontend).toContain('legacy-pass8-root.md')
    expect(frontend).not.toContain('Treat CSS v0.3 as the latest visual baseline')
  })

  it('keeps WorkBuddy as an external executor and removes machine-specific state from the root prompt', () => {
    expect(workbuddy).toContain('WorkBuddy 不是 Codex thread/subagent')
    expect(workbuddy).toContain('watcher routing/claim 只代表 delivered/assigned')
    expect(workbuddy).not.toContain('E:\\Buddy项目\\ai-bridge')
    expect(workbuddy).not.toContain('oc_e4392f46f1408083fd431e2cd54eca6b')
  })
})

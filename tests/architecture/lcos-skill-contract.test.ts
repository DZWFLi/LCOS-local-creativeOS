import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skillRoot = join(root, 'packages/skills/lcos-project-context')
const skillFiles = [join(skillRoot, 'SKILL.md'), ...readdirSync(join(skillRoot, 'references')).map((name) => join(skillRoot, 'references', name))]
const skill = skillFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const executorSkill = readFileSync(join(root, 'packages/skills/lcos-executor-run/SKILL.md'), 'utf8')
const mcp = readFileSync(join(root, 'tools/lcos-agent/mcp-server.mjs'), 'utf8')
const executorMcp = readFileSync(join(root, 'tools/lcos-agent/executor-tools.mjs'), 'utf8')
const orchestrator = readFileSync(join(root, 'tools/codex-orchestrator/watch.ps1'), 'utf8')
const watch = readFileSync(join(root, 'tools/codex-orchestrator/watch.mjs'), 'utf8')
const runner = readFileSync(join(root, 'tools/codex-orchestrator/run-codex-task.mjs'), 'utf8')

const declaredAgentTools = [
  'bind_lcos_project',
  'get_lcos_active_context',
  'watch_lcos_active_context',
  'validate_lcos_agent_plan',
  'apply_lcos_context_command',
  'propose_lcos_context_change',
  'get_lcos_run_input_request',
  'scan_lcos_obsidian_vault',
  'import_lcos_obsidian_notes',
]
const declaredExecutorTools = [
  'request_lcos_user_input',
  'claim_lcos_run',
  'start_lcos_run',
  'submit_lcos_result',
]

describe('LCOS Codex Skill contract', () => {
  it('declares only MCP tools that exist in the canonical MCP server', () => {
    for (const tool of declaredAgentTools) {
      expect(skill).toContain(tool)
      expect(mcp).toContain(`\"${tool}\"`)
    }
    for (const tool of declaredExecutorTools) {
      expect(executorSkill).toContain(tool)
      expect(executorMcp).toContain(`\"${tool}\"`)
    }
  })

  it('limits automatic plan repair to one attempt and keeps risky operations explicit', () => {
    expect(skill).toContain('只自动修复一次')
    expect(skill).toContain('不要循环')
    expect(skill).toContain('删除/覆盖/扩权')
  })

  it('uses real waiting_input instead of failed or retry', () => {
    expect(skill).toContain('这不是失败也不是重试')
    expect(skill).toContain('同一个 canonical Run')
    expect(executorMcp).toContain('tool(\"request_lcos_user_input\"')
    expect(mcp).toContain('tool(\"answer_lcos_run_input\"')
  })

  it('never guesses a project session from --last or the latest JSONL', () => {
    expect(skill).toContain('不猜 stale ID')
    expect(orchestrator).not.toContain('Get-LatestCodexSessionId')
    expect(orchestrator).not.toContain('resume --last')
    expect(orchestrator).toContain('watch.mjs')
    expect(watch).toContain('run-codex-task.mjs')
    expect(runner).toContain('session_id')
    expect(runner).toContain('resolvedSessionId')
    expect(runner).not.toContain('resume --last')
  })
  it('installs the whole managed Skill package, including references', () => {
    const installer = readFileSync(join(root, 'scripts/install-lcos-codex-skill.mjs'), 'utf8')
    const examples = readFileSync(join(root, 'packages/skills/lcos-project-context/references/natural-language-examples.md'), 'utf8')
    expect(installer).toContain('sourceFiles()')
    expect(installer).toContain('treeHash(files)')
    expect(examples).toContain('把第二张也加进来')
  })

  it('keeps the Obsidian connector read-only and explicit', () => {
    expect(skill).toContain('scan_lcos_obsidian_vault')
    expect(skill).toContain('绝不编辑、删除、重命名或同步')
    expect(mcp).toContain('tool(\"scan_lcos_obsidian_vault\"')
    expect(mcp).toContain('tool(\"import_lcos_obsidian_notes\"')
  })

})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skill = readFileSync(join(root, 'packages/skills/lcos-project-context/SKILL.md'), 'utf8')
const mcp = readFileSync(join(root, 'tools/lcos-agent/mcp-server.mjs'), 'utf8')
const orchestrator = readFileSync(join(root, 'tools/codex-orchestrator/watch.ps1'), 'utf8')

const declaredTools = [
  'bind_lcos_project',
  'get_lcos_active_context',
  'watch_lcos_active_context',
  'validate_lcos_agent_plan',
  'apply_lcos_context_command',
  'propose_lcos_context_change',
  'request_lcos_user_input',
  'get_lcos_run_input_request',
  'claim_lcos_run',
  'start_lcos_run',
  'submit_lcos_result',
  'scan_lcos_obsidian_vault',
  'import_lcos_obsidian_notes',
]

describe('LCOS Codex Skill contract', () => {
  it('declares only MCP tools that exist in the canonical MCP server', () => {
    for (const tool of declaredTools) {
      expect(skill).toContain(tool)
      expect(mcp).toContain(`\"${tool}\"`)
    }
  })

  it('limits automatic plan repair to one attempt and keeps risky operations explicit', () => {
    expect(skill).toContain('automatically repair **exactly once**')
    expect(skill).toContain('Never loop')
    expect(skill).toContain('delete / overwrite / permission expansion')
  })

  it('uses real waiting_input instead of failed or retry', () => {
    expect(skill).toContain('This is not a failure and not a retry')
    expect(skill).toContain('same canonical Run')
    expect(mcp).toContain('tool(\"request_lcos_user_input\"')
    expect(mcp).toContain('tool(\"answer_lcos_run_input\"')
  })

  it('never guesses a project session from --last or the latest JSONL', () => {
    expect(skill).toContain('Never guess the newest JSONL file')
    expect(orchestrator).not.toContain('Get-LatestCodexSessionId')
    expect(orchestrator).not.toContain('resume --last')
    expect(orchestrator).toContain('Resolve-CodexSessionId')
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
    expect(skill).toContain('never edits, deletes, renames or synchronizes files in the Vault')
    expect(mcp).toContain('tool(\"scan_lcos_obsidian_vault\"')
    expect(mcp).toContain('tool(\"import_lcos_obsidian_notes\"')
  })

})

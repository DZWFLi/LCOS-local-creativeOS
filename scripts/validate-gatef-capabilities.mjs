import { readFile } from 'node:fs/promises'
import process from 'node:process'

const checks = [
  {
    id: 'GF-COMPOSER-01',
    description: 'Composer only exposes prompt, Agent and new-node decision',
    files: [
      ['apps/web/src/features/canvas/SelectionComposer.tsx', ['结果作为新节点', '告诉 Agent 你想做什么', "executionMode === 'automatic'"]],
      ['apps/web/src/features/workrail/WorkRail.tsx', ['结果作为新节点', "executionMode === 'automatic'"]],
    ],
    forbidden: [
      ['apps/web/src/features/canvas/SelectionComposer.tsx', ['工作方式', '结果去向', '编辑对象']],
    ],
  },
  {
    id: 'GF-DRAFT-01',
    description: 'CommandDraft contract, persistence, API and Web wiring exist',
    files: [
      ['packages/contracts/src/index.ts', ['CommandDraftV1']],
      ['apps/local-core/src/metadata-repository.ts', ['command_drafts', 'saveCommandDraft', 'getCommandDraft']],
      ['apps/local-core/src/routes/projects.ts', ['command-drafts']],
      ['apps/web/src/runtime/localCoreClient.ts', ['saveCommandDraft', 'getCommandDraft']],
      ['apps/web/src/App.tsx', ['saveCommandDraft', 'deleteCommandDraft']],
    ],
  },
  {
    id: 'GF-CONTEXT-01',
    description: 'Project + Workspace ActiveContext is versioned and persistent',
    files: [
      ['packages/contracts/src/index.ts', ['ActiveContextV2', 'workspaceId', 'selectionOrder', 'viewport']],
      ['apps/local-core/src/metadata-repository.ts', ['active_contexts', 'saveActiveContext']],
      ['apps/local-core/src/active-context-store.ts', ['expectedVersion', 'workspaceId', 'relations', 'nodes']],
      ['apps/local-core/src/routes/canvas.ts', ['afterVersion', 'ActiveContextConflictError']],
    ],
  },
  {
    id: 'GF-PLAN-01',
    description: 'Agent-authored execution plan has one contract and Core guard',
    files: [
      ['packages/contracts/src/index.ts', ['AgentExecutionPlanV1']],
      ['apps/local-core/src/runtime-proposal-service.ts', ['validateAgentExecutionPlan']],
      ['apps/local-core/src/routes/runs.ts', ['validateAgentPlanMatch']],
      ['tools/lcos-agent/cli.mjs', ['run validate-plan']],
      ['tools/lcos-agent/mcp-server.mjs', ['validate_lcos_agent_plan']],
      ['packages/skills/lcos-project-context/SKILL.md', ['Agent Plan', 'validate_lcos_agent_plan']],
    ],
  },
  {
    id: 'GF-SESSION-01',
    description: 'Project + Provider Session Affinity is a Core-owned persisted binding',
    files: [
      ['packages/contracts/src/index.ts', ['ProviderSessionBindingV1']],
      ['apps/local-core/src/metadata-repository.ts', ['provider_session_bindings', 'saveProviderSessionBinding']],
      ['apps/local-core/src/routes/projects.ts', ['provider-sessions']],
      ['tools/codex-orchestrator/watch.mjs', ['provider-sessions', 'externalSessionId']],
    ],
  },
  {
    id: 'GF-CONTEXT-COMMAND-01',
    description: 'Explicit reversible Agent context command uses CAS',
    files: [
      ['tools/lcos-agent/mcp-server.mjs', ['apply_lcos_context_command', 'expectedVersion']],
      ['packages/skills/lcos-project-context/references/context-changes.md', ['apply_lcos_context_command']],
    ],
  },
  {
    id: 'GF-CANCEL-01',
    description: 'User-facing cancel is wired Web → Core',
    files: [
      ['apps/web/src/runtime/localCoreClient.ts', ['cancelRuntimeRun']],
      ['apps/web/src/features/workrail/WorkRail.tsx', ['撤回任务', 'onCancelRun']],
      ['apps/local-core/src/routes/runs.ts', ['/cancel']],
      ['apps/local-core/src/runtime-result-ingestion.ts', ['LATE_RESULT_AFTER_CANCEL']],
    ],
  },
  {
    id: 'GF-SELECTION-01',
    description: 'Desktop additive selection supports Ctrl/Cmd and Shift',
    files: [
      ['apps/web/src/features/canvas/ProjectCanvas.tsx', ['event.ctrlKey', 'event.metaKey', 'event.shiftKey', 'additiveSelection']],
    ],
  },
]

const failures = []
const report = []
for (const check of checks) {
  let ok = true
  for (const [file, required] of check.files) {
    let source
    try { source = await readFile(file, 'utf8') } catch { failures.push(`${check.id}: missing ${file}`); ok = false; continue }
    for (const token of required) {
      if (!source.includes(token)) { failures.push(`${check.id}: ${file} missing ${JSON.stringify(token)}`); ok = false }
    }
  }
  for (const [file, forbidden] of check.forbidden ?? []) {
    const source = await readFile(file, 'utf8')
    for (const token of forbidden) {
      if (source.includes(token)) { failures.push(`${check.id}: ${file} still exposes ${JSON.stringify(token)}`); ok = false }
    }
  }
  report.push(`${ok ? 'PASS' : 'FAIL'} ${check.id} ${check.description}`)
}

process.stdout.write(`${report.join('\n')}\n`)
if (failures.length) {
  process.stderr.write(`\n${failures.join('\n')}\n`)
  process.exitCode = 1
}

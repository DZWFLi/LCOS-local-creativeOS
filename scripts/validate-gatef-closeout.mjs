import { readFile } from 'node:fs/promises'
import process from 'node:process'

const required = [
  ['tools/codex-orchestrator/watch.ps1', ['run-codex-task.mjs', 'externalSessionId', 'Invoke-CodexCommand']],
  ['tools/codex-orchestrator/run-codex-task.mjs', ["['exec', '--json', '-C'", 'LCOS_CODEX_RESULT:', 'taskkill.exe', 'closureObserved', 'sessionInvalid']],
  ['tools/light-bridge-kernel/src/lcos_bridge/canonical/models.py', ['WAITING_INPUT', 'InputRequestV1', 'InputResponseV1']],
  ['tools/light-bridge-kernel/src/lcos_bridge/core/store.py', ['answer_input', 'INPUT_ALREADY_RESOLVED']],
  ['apps/local-core/src/metadata-repository.ts', ['run_input_requests', '#migrate_015_from_v14', 'INPUT_REQUEST_IDEMPOTENCY_CONFLICT']],
  ['apps/local-core/src/runtime-result-ingestion.ts', ["providerStatus === 'waiting_input'", 'resultSummary: summary', 'inputRequestEvidenceId']],
  ['apps/local-core/src/runtime-application-service.ts', ['answerInput(', "'run.input_resolved'", "review.run.status === 'running'"]],
  ['apps/web/src/App.tsx', ['answerActiveRunInput', 'activeContextVersionRef.current', 'const watch = async () =>']],
  ['apps/web/src/features/workrail/WorkRail.tsx', ['继续这个任务', '任务不会因为等待而自动取消', 'run.resultSummary']],
  ['tools/lcos-agent/mcp-server.mjs', ['request_lcos_user_input', 'answer_lcos_run_input', 'move_lcos_view', 'select_lcos_views', 'list_lcos_connectors', 'scan_lcos_obsidian_vault', 'import_lcos_obsidian_notes']],
  ['packages/skills/lcos-project-context/SKILL.md', ['automatically repair **exactly once**', 'This is not a failure and not a retry', 'Never guess the newest JSONL file', 'scan_lcos_obsidian_vault']],
  ['packages/skills/lcos-project-context/references/natural-language-examples.md', ['把第二张也加进来', '用户不需要提供 Intent']],
  ['apps/local-core/src/connectors/connector-port.ts', ['ResourceConnectorPort', 'ResourceConnectorRegistry', 'capabilities()']],
  ['apps/local-core/src/connectors/obsidian-connector.ts', ['access: ' + "'read_only'", 'SKIPPED_DIRECTORIES', 'isInside']],
  ['apps/web/src/features/resources/ObsidianImportDialog.tsx', ['只读扫描', '不修改 Vault']],
  ['scripts/install-lcos-codex-mcp.mjs', ['LCOS_CORE_TOKEN_FILE', "'mcp', 'add'", "'mcp', 'get'"]],
  ['scripts/install-lcos-codex-skill.mjs', ['sourceFiles()', 'treeHash(files)', 'files.map(normalizedRelative)']],
  ['scripts/dev-launcher.mjs', ['ensureCodexSkill()', 'ensureCodexMcp()']],
]

const forbidden = [
  ['tools/codex-orchestrator/watch.ps1', ['Get-LatestCodexSessionId', "@('exec', '--json', '-C', $projectRoot, 'resume', '--last'"]],
]

const failures = []
for (const [file, tokens] of required) {
  let source = ''
  try { source = await readFile(file, 'utf8') } catch { failures.push(`missing ${file}`); continue }
  for (const token of tokens) if (!source.includes(token)) failures.push(`${file} missing ${JSON.stringify(token)}`)
}
for (const [file, tokens] of forbidden) {
  const source = await readFile(file, 'utf8')
  for (const token of tokens) if (source.includes(token)) failures.push(`${file} contains forbidden ${JSON.stringify(token)}`)
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('PASS Gate F closeout static contract checks\n')
}

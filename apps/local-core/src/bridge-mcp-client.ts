import type {
  BridgeRuntimePort,
  BridgeResultEnvelopeV0,
  BridgeTaskEnvelopeV0,
  BridgeTaskIdentity,
  RuntimeProviderError,
} from './runtime-adapter.js'
import { RuntimeAdapterError } from './runtime-adapter.js'

type JsonObject = Record<string, unknown>
export type BridgeContractMode = 'auto' | 'canonical' | 'legacy'

function providerError(code: string, message: string, retryable: boolean): RuntimeAdapterError {
  const detail: RuntimeProviderError = { code, message, retryable, provider: 'workbuddy' }
  return new RuntimeAdapterError(detail)
}

function assertLoopback(endpoint: URL): void {
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw providerError('BRIDGE_UNAVAILABLE', 'Bridge MCP endpoint must use loopback HTTP.', false)
  }
}

function parseTransportPayload(contentType: string, body: string): JsonObject {
  if (contentType.includes('text/event-stream')) {
    const data = body.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .find((line) => line.length > 0)
    if (data === undefined) throw providerError('BRIDGE_UNAVAILABLE', 'Bridge returned an empty MCP stream.', true)
    return JSON.parse(data) as JsonObject
  }
  return JSON.parse(body) as JsonObject
}

function parseToolText(payload: JsonObject): JsonObject {
  const result = payload.result
  if (typeof result !== 'object' || result === null) {
    throw providerError('BRIDGE_UNAVAILABLE', 'Bridge returned an invalid MCP result.', true)
  }
  const content = (result as JsonObject).content
  if (!Array.isArray(content)) throw providerError('BRIDGE_UNAVAILABLE', 'Bridge MCP result has no content.', true)
  const textItem = content.find((item) =>
    typeof item === 'object' && item !== null && (item as JsonObject).type === 'text',
  ) as JsonObject | undefined
  if (typeof textItem?.text !== 'string') {
    throw providerError('BRIDGE_UNAVAILABLE', 'Bridge MCP result has no text payload.', true)
  }
  return JSON.parse(textItem.text) as JsonObject
}

function normalizeIdentity(task: JsonObject, expected?: {
  readonly runId: string
  readonly requestFingerprint: string
  readonly contractVersion: string
}): BridgeTaskIdentity {
  const taskId = task.taskId ?? task.task_id
  const runId = task.lcosRunId ?? task.lcos_run_id ?? expected?.runId
  const fingerprint = task.requestFingerprint ?? task.request_fingerprint ?? expected?.requestFingerprint
  const contractVersion = task.contractVersion ?? task.contract_version ?? expected?.contractVersion
  if (
    typeof taskId !== 'string'
    || typeof runId !== 'string'
    || typeof task.status !== 'string'
    || typeof fingerprint !== 'string'
    || typeof contractVersion !== 'string'
  ) {
    throw providerError('CONTRACT_UNSUPPORTED', 'Bridge Task identity is incomplete.', false)
  }
  const sessionId = task.sessionId ?? task.session_id
  return {
    taskId,
    lcosRunId: runId,
    status: task.status,
    requestFingerprint: fingerprint,
    contractVersion,
    ...(typeof sessionId === 'string' && sessionId.length > 0 ? { sessionId } : {}),
  }
}

export class McpBridgeRuntimeClient implements BridgeRuntimePort {
  private readonly endpoint: URL
  private requestId = 0
  private sessionId: string | undefined
  private selectedContractMode: Exclude<BridgeContractMode, 'auto'> | undefined
  private contractModePromise: Promise<Exclude<BridgeContractMode, 'auto'>> | undefined

  constructor(
    endpoint: string,
    private readonly request: typeof fetch = fetch,
    private readonly bridgeSessionId?: string,
    private readonly contractMode: BridgeContractMode = 'auto',
  ) {
    this.endpoint = new URL(endpoint)
    assertLoopback(this.endpoint)
    if (contractMode !== 'auto') this.selectedContractMode = contractMode
  }

  async createTask(envelope: BridgeTaskEnvelopeV0, projectId: string): Promise<BridgeTaskIdentity> {
    const mode = await this.ensureContractMode()
    if (envelope.contractVersion === 'bridge-task-v1') {
      if (mode !== 'canonical') {
        throw providerError('CONTRACT_UNSUPPORTED', 'Bridge Task V1 requires the canonical Light Bridge.', false)
      }
      const response = await this.callTool('create_task', {
        envelope: JSON.stringify(envelope),
      })
      return this.identityFromResponse(response, {
        runId: envelope.lcosRunId,
        requestFingerprint: envelope.requestFingerprint,
        contractVersion: envelope.contractVersion,
      })
    }
    const common = {
      instruction: 'Execute the immutable RuntimeInputPackV0.',
      assignee: envelope.provider,
      task_type: envelope.taskType,
      project_id: projectId,
      ...(this.bridgeSessionId === undefined ? {} : { session_id: this.bridgeSessionId }),
      expected_outputs: JSON.stringify(envelope.expectedOutputs),
      timeout_seconds: envelope.timeoutSeconds,
      report_mode: envelope.reportMode,
    }
    const expected = {
      runId: envelope.lcosRunId,
      requestFingerprint: envelope.requestFingerprint,
      contractVersion: envelope.contractVersion,
    }
    if (mode === 'canonical') {
      const response = await this.callTool('create_task', {
        ...common,
        contract_version: envelope.contractVersion,
        lcos_run_id: envelope.lcosRunId,
        idempotency_key: envelope.idempotencyKey,
        request_fingerprint: envelope.requestFingerprint,
        runtime_input_pack_path: envelope.runtimeInputPackPath,
      })
      return this.identityFromResponse(response, expected)
    }
    const response = await this.callTool('create_task', {
      ...common,
      instruction: [
        'Execute the immutable RuntimeInputPackV0.',
        `RuntimeInputPack path: ${envelope.runtimeInputPackPath}`,
        `LCOS Run ID: ${envelope.lcosRunId}`,
        'Read the pack, write only its declared expected output, and submit changed_files.',
      ].join('\n'),
      context: JSON.stringify({
        lcos_run_id: envelope.lcosRunId,
        idempotency_key: envelope.idempotencyKey,
        request_fingerprint: envelope.requestFingerprint,
        runtime_input_pack_path: envelope.runtimeInputPackPath,
        contract_version: envelope.contractVersion,
      }),
    })
    return this.identityFromResponse(response, expected)
  }

  async findTaskByRunId(runId: string): Promise<BridgeTaskIdentity | undefined> {
    const response = await this.callTool('get_task_by_lcos_run_id', { lcos_run_id: runId })
    const error = response.error
    if (typeof error === 'object' && error !== null && (error as JsonObject).code === 'TASK_NOT_FOUND') return undefined
    return this.identityFromResponse(response)
  }

  async getTask(taskId: string, runId: string): Promise<BridgeTaskIdentity | undefined> {
    const response = await this.callTool('get_task_status', { task_id: taskId })
    if (typeof response.task_id !== 'string' && typeof response.taskId !== 'string') return undefined
    return normalizeIdentity(response, {
      runId,
      requestFingerprint: 'legacy-v3-binding',
      contractVersion: 'bridge-task-v0-compat',
    })
  }

  async getResult(taskId: string, runId: string): Promise<BridgeResultEnvelopeV0 | undefined> {
    const task = await this.callTool('get_task_status', { task_id: taskId })
    const status = task.status
    if (!['review', 'failed', 'cancelled', 'timeout'].includes(String(status))) return undefined
    const taskRunId = task.lcos_run_id ?? task.lcosRunId
    if (taskRunId !== undefined && taskRunId !== runId) {
      throw providerError('CONTRACT_UNSUPPORTED', 'Bridge result belongs to another Run.', false)
    }
    const changedFiles = task.changed_files
    if (!Array.isArray(changedFiles)) throw providerError('CONTRACT_UNSUPPORTED', 'Bridge result has no changed_files.', false)
    const contractVersion = task.contract_version ?? task.contractVersion
    const resultV1 = contractVersion === 'bridge-task-v1'
    return {
      contractVersion: resultV1 ? 'bridge-result-v1' : 'bridge-result-v0',
      taskId,
      lcosRunId: runId,
      providerStatus: status as BridgeResultEnvelopeV0['providerStatus'],
      ...(typeof task.summary === 'string' ? { summary: task.summary } : {}),
      ...(typeof task.short_summary === 'string' ? { shortSummary: task.short_summary } : {}),
      ...(typeof task.result_summary === 'string' ? { resultSummary: task.result_summary } : {}),
      ...(Array.isArray(task.warnings) ? { warnings: task.warnings.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(task.suggested_next_actions) ? { suggestedNextActions: task.suggested_next_actions.filter((item): item is string => typeof item === 'string') } : {}),
      changedFiles: changedFiles.map((item) => {
        if (
          typeof item !== 'object'
          || item === null
          || typeof (item as JsonObject).path !== 'string'
          || !['created', 'modified'].includes(String((item as JsonObject).action))
        ) {
          throw providerError('CONTRACT_UNSUPPORTED', 'Bridge changed_files violates the ResultEnvelope contract.', false)
        }
        const value = item as JsonObject
        const action = value.action === 'modified' ? 'modified' as const : 'created' as const
        return {
          path: String(value.path),
          action,
          ...(typeof value.role === 'string' ? { role: value.role } : {}),
          ...(typeof value.mediaType === 'string' ? { mediaType: value.mediaType } : {}),
        }
      }),
    }
  }

  async finalizeReview(taskId: string, decision: 'completed' | 'retrying', comment = ''): Promise<void> {
    const response = await this.callTool('finalize_task_review', {
      task_id: taskId,
      reviewer: 'codex',
      decision,
      review_comment: comment,
    })
    if (response.ok === false) {
      throw providerError('BRIDGE_UNAVAILABLE', 'Bridge rejected review finalization.', true)
    }
  }

  async cancelTask(taskId: string, runId: string): Promise<void> {
    const response = await this.callTool('cancel_task', { task_id: taskId })
    const status = response.status ?? response.provider_status ?? response.providerStatus
    const cancelled = String(status).toLocaleLowerCase('en-US') === 'cancelled'
    if (!cancelled) {
      throw providerError('CANCEL_REJECTED', `Bridge did not cancel task ${taskId} for run ${runId}.`, false)
    }
  }

  private identityFromResponse(
    response: JsonObject,
    expected?: {
      readonly runId: string
      readonly requestFingerprint: string
      readonly contractVersion: string
    },
  ): BridgeTaskIdentity {
    if (typeof response.task_id === 'string' || typeof response.taskId === 'string') {
      return normalizeIdentity(response, expected)
    }
    if (response.ok !== true) {
      const error = response.error
      if (typeof error === 'object' && error !== null) {
        const value = error as JsonObject
        throw providerError(
          typeof value.code === 'string' ? value.code : 'BRIDGE_UNAVAILABLE',
          typeof value.message === 'string' ? value.message : 'Bridge rejected the request.',
          value.retryable === true,
        )
      }
      throw providerError('BRIDGE_UNAVAILABLE', 'Bridge rejected the request.', true)
    }
    if (typeof response.task !== 'object' || response.task === null) {
      throw providerError('CONTRACT_UNSUPPORTED', 'Bridge response has no Task identity.', false)
    }
    return normalizeIdentity(response.task as JsonObject, expected)
  }

  private async ensureContractMode(): Promise<Exclude<BridgeContractMode, 'auto'>> {
    if (this.selectedContractMode !== undefined) return this.selectedContractMode
    this.contractModePromise ??= this.detectContractMode()
    try {
      this.selectedContractMode = await this.contractModePromise
      return this.selectedContractMode
    } catch (error: unknown) {
      this.contractModePromise = undefined
      throw error
    }
  }

  private async detectContractMode(): Promise<Exclude<BridgeContractMode, 'auto'>> {
    const health = await this.callTool('health_check', {})
    if (health.ok !== true) {
      throw providerError('BRIDGE_UNAVAILABLE', 'Bridge health check did not report ready.', true)
    }
    const capabilities = typeof health.capabilities === 'object' && health.capabilities !== null
      ? health.capabilities as JsonObject
      : health
    const contractVersion = health.primaryContractVersion
      ?? health.primary_contract_version
      ?? health.contractVersion
      ?? health.contract_version
    if (contractVersion === 'bridge-task-v1') return 'canonical'
    if (
      contractVersion === 'bridge-task-v0'
      && capabilities.idempotentCreate === true
      && capabilities.lookupByLcosRunId === true
    ) {
      return 'canonical'
    }
    return 'legacy'
  }

  private async callTool(name: string, args: JsonObject): Promise<JsonObject> {
    if (this.sessionId === undefined) await this.initialize()
    return parseToolText(await this.rpc('tools/call', { name, arguments: args }))
  }

  private async initialize(): Promise<void> {
    await this.rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'local-creative-os', version: '0.6.1' },
    })
    await this.rpc('notifications/initialized', {}, true)
  }

  private async rpc(method: string, params: JsonObject, notification = false): Promise<JsonObject> {
    const payload = {
      jsonrpc: '2.0',
      ...(notification ? {} : { id: ++this.requestId }),
      method,
      params,
    }
    let response: Response
    try {
      response = await this.request(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(this.sessionId === undefined ? {} : { 'mcp-session-id': this.sessionId }),
        },
        body: JSON.stringify(payload),
      })
    } catch (error: unknown) {
      throw providerError(
        'BRIDGE_UNAVAILABLE',
        error instanceof Error ? error.message : 'Bridge request failed.',
        true,
      )
    }
    const sessionId = response.headers.get('mcp-session-id')
    if (sessionId !== null) this.sessionId = sessionId
    if (notification && response.status === 202) return {}
    const body = await response.text()
    if (!response.ok) throw providerError('BRIDGE_UNAVAILABLE', `Bridge MCP returned ${response.status}.`, true)
    try {
      const decoded = parseTransportPayload(response.headers.get('content-type') ?? '', body)
      if (decoded.error !== undefined) throw providerError('BRIDGE_UNAVAILABLE', 'Bridge MCP JSON-RPC error.', true)
      return decoded
    } catch (error: unknown) {
      if (error instanceof RuntimeAdapterError) throw error
      throw providerError('BRIDGE_UNAVAILABLE', 'Bridge returned malformed JSON.', true)
    }
  }
}

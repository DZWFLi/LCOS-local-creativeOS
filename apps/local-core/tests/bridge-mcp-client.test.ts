import { describe, expect, it, vi } from 'vitest'

import { McpBridgeRuntimeClient } from '../src/bridge-mcp-client.js'
import type { BridgeTaskEnvelopeV0 } from '../src/runtime-adapter.js'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-test' },
    ...init,
  })
}

const envelope: BridgeTaskEnvelopeV0 = {
  contractVersion: 'bridge-task-v0',
  lcosRunId: 'run-one',
  idempotencyKey: 'run-one',
  requestFingerprint: 'fingerprint-one',
  provider: 'workbuddy',
  taskType: 'markdown_script_revision',
  runtimeInputPackPath: 'C:\\runtime\\runtime-input-pack.json',
  expectedOutputs: [{ absolutePath: 'C:\\runtime\\draft.md', mode: 'create_new_file' }],
  timeoutSeconds: 600,
  reportMode: 'short',
}

describe('McpBridgeRuntimeClient legacy result compatibility', () => {
  it('uses the persisted binding Run ID when V3 task status omits lcos_run_id', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              task_id: 'task-one',
              status: 'review',
              changed_files: [{ path: 'C:\\runtime\\draft.md', action: 'created' }],
            }),
          }],
        },
      }))
    const client = new McpBridgeRuntimeClient('http://127.0.0.1:8920/mcp', request)

    await expect(client.getResult('task-one', 'run-one')).resolves.toMatchObject({
      taskId: 'task-one',
      lcosRunId: 'run-one',
      providerStatus: 'review',
    })
  })

  it('rejects an explicit mismatched Run ID', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              task_id: 'task-one',
              lcos_run_id: 'run-other',
              status: 'review',
              changed_files: [{ path: 'C:\\runtime\\draft.md', action: 'created' }],
            }),
          }],
        },
      }))
    const client = new McpBridgeRuntimeClient('http://127.0.0.1:8920/mcp', request)

    await expect(client.getResult('task-one', 'run-one')).rejects.toMatchObject({
      detail: { code: 'CONTRACT_UNSUPPORTED' },
    })
  })
})

describe('McpBridgeRuntimeClient capability gate', () => {
  it('locks canonical mode before create and never retries with legacy arguments', async () => {
    const toolNames: string[] = []
    const request = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        id?: number
        params?: { name?: string }
      }
      if (body.method === 'initialize') {
        return jsonResponse({ jsonrpc: '2.0', id: body.id, result: {} })
      }
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
      const name = body.params?.name ?? ''
      toolNames.push(name)
      const value = name === 'health_check'
        ? {
            ok: true,
            contractVersion: 'bridge-task-v0',
            capabilities: { idempotentCreate: true, lookupByLcosRunId: true },
          }
        : {
            ok: false,
            error: { code: 'BRIDGE_UNAVAILABLE', message: 'uncertain create result', retryable: true },
          }
      return jsonResponse({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(value) }] },
      })
    })
    const client = new McpBridgeRuntimeClient('http://127.0.0.1:43122/mcp', request)

    await expect(client.createTask(envelope, 'mvp-fast-build')).rejects.toMatchObject({
      detail: { code: 'BRIDGE_UNAVAILABLE' },
    })
    expect(toolNames).toEqual(['health_check', 'create_task'])
  })

  it('allows an explicitly selected legacy contract without probing capabilities', async () => {
    const calls: Array<{ name?: string; arguments?: Record<string, unknown> }> = []
    const request = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        id?: number
        params?: { name?: string; arguments?: Record<string, unknown> }
      }
      if (body.method === 'initialize') {
        return jsonResponse({ jsonrpc: '2.0', id: body.id, result: {} })
      }
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
      calls.push(body.params ?? {})
      return jsonResponse({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({ task_id: 'task-one', status: 'assigned' }),
          }],
        },
      })
    })
    const client = new McpBridgeRuntimeClient(
      'http://127.0.0.1:8920/mcp',
      request,
      undefined,
      'legacy',
    )

    await expect(client.createTask(envelope, 'mvp-fast-build')).resolves.toMatchObject({
      taskId: 'task-one',
      lcosRunId: 'run-one',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('create_task')
    expect(calls[0]?.arguments).toHaveProperty('context')
    expect(calls[0]?.arguments).not.toHaveProperty('lcos_run_id')
  })
})

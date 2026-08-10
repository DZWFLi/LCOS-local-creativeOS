import type { PresentationViewV0 } from '@local-creative-os/contracts'

import { PresentationConflictError, type PresentationApplicationService } from '../presentation-application-service.js'
import type { RouteHttpContext, RouteHttpHelpers } from './route-context.js'

export interface PresentationsRouteContext extends RouteHttpContext {
  readonly presentation: PresentationApplicationService | undefined
}

/**
 * Presentation routes — Phase B.
 * GET list / GET one / PUT (contract + expectedVersion) / DELETE / SSE stream.
 * PUT never touches project graphVersion.
 */
export async function handlePresentationsRoute(ctx: PresentationsRouteContext): Promise<boolean> {
  const { method, pathname, url, request, response, controller, presentation } = ctx
  const { sendJson, failure, readJsonBody } = ctx.helpers

  const listMatch = /^\/projects\/([^/]+)\/presentations$/.exec(pathname)
  const oneMatch = /^\/projects\/([^/]+)\/presentations\/([^/]+)$/.exec(pathname)
  const streamMatch = /^\/projects\/([^/]+)\/presentations\/([^/]+)\/stream$/.exec(pathname)
  if (listMatch === null && oneMatch === null && streamMatch === null) return false
  if (presentation === undefined) {
    sendJson(response, 503, failure('UNAVAILABLE', 'Presentation service is not configured.'))
    return true
  }

  if (listMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(listMatch[1] ?? '')
    sendJson(response, 200, { ok: true, value: presentation.list(projectId) })
    return true
  }

  if (streamMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(streamMatch[1] ?? '')
    const presentationId = decodeURIComponent(streamMatch[2] ?? '')
    const afterRaw = url.searchParams.get('afterVersion')
    const afterVersion = afterRaw === null ? undefined : Number(afterRaw)
    if (afterRaw !== null && (!Number.isInteger(afterVersion) || (afterVersion ?? -1) < 0)) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'afterVersion must be a non-negative integer.'))
      return true
    }
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    response.flushHeaders()
    let closed = false
    const heartbeat = setInterval(() => {
      if (!closed && !response.writableEnded) response.write(': ping\n\n')
    }, 15_000)
    const close = () => {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      if (!response.writableEnded) response.end()
    }
    request.on('close', close)
    request.on('error', close)
    response.on('close', close)
    const sendEvent = (event: string, value: unknown): void => {
      if (closed || response.writableEnded) return
      response.write(`event: ${event}\ndata: ${JSON.stringify({ ok: true, value })}\n\n`)
    }
    const unsubscribe = presentation.subscribe(projectId, presentationId, (change) => {
      if (afterVersion !== undefined && change.version <= afterVersion) return
      sendEvent('update', change)
    })
    response.on('close', unsubscribe)
    request.on('close', unsubscribe)
    const current = presentation.get(projectId, presentationId)
    if (current !== undefined) sendEvent('snapshot', { presentationId, version: current.version, updatedAt: current.updatedAt, updatedBy: current.updatedBy })
    return true
  }

  if (oneMatch !== null) {
    const projectId = decodeURIComponent(oneMatch[1] ?? '')
    const presentationId = decodeURIComponent(oneMatch[2] ?? '')
    if (method === 'GET') {
      const value = presentation.get(projectId, presentationId)
      if (value === undefined) {
        sendJson(response, 404, failure('NOT_FOUND', 'Presentation not found.'))
        return true
      }
      sendJson(response, 200, { ok: true, value })
      return true
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, controller.signal) as { contract?: PresentationViewV0; expectedVersion?: number }
      const contract = body?.contract
      if (contract === undefined || typeof contract !== 'object' || contract.id !== presentationId) {
        sendJson(response, 400, failure('INVALID_ARGUMENT', 'PUT requires a contract whose id matches the route.'))
        return true
      }
      const expectedVersion = body.expectedVersion
      if (!Number.isInteger(expectedVersion) || (expectedVersion ?? -1) < 0) {
        sendJson(response, 400, failure('INVALID_ARGUMENT', 'expectedVersion must be a non-negative integer.'))
        return true
      }
      try {
        const value = presentation.save(projectId, {
          presentationId: contract.id,
          scopeId: contract.scopeId,
          capability: contract.capability,
          renderer: contract.renderer,
          state: contract.state,
          expectedVersion: Number(expectedVersion),
          updatedBy: contract.updatedBy ?? 'web',
        })
        sendJson(response, 200, { ok: true, value })
      } catch (error: unknown) {
        if (error instanceof PresentationConflictError) {
          sendJson(response, 409, failure('STALE_PRESENTATION_VERSION', error.message))
          return true
        }
        sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Presentation save failed.'))
      }
      return true
    }
    if (method === 'DELETE') {
      presentation.delete(projectId, presentationId)
      sendJson(response, 200, { ok: true, value: null })
      return true
    }
  }
  return false
}

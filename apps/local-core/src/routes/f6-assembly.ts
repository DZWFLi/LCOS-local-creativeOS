/**
 * F6 后端同步施工单路由（20260828）：
 * - P0-B2：GET /projects/{id}/warehouse（Material/Relation View 共用 read model）
 * - P0-D3：GET /projects/{id}/connected-conversations/{cid}/reach
 * - P0-D5：POST/GET /projects/{id}/result-slots、GET/DELETE /result-slots/{slotId}
 * - P0-D6：GET /runs/{runId}/recipe（聚合只读投影）
 */
import type {
  ConversationReachResultV0,
  ResultSlotV0,
  RunRecipeV0,
  WarehouseQueryV1,
  WarehouseSnapshotV1,
  WarehouseEntityKindV1,
} from '@local-creative-os/contracts'
import type { RunId } from '@local-creative-os/domain'
import type { ConversationIdentityService } from '../conversation-identity-service.js'
import type { ResultSlotService } from '../result-slot-service.js'
import type { WarehouseService } from '../warehouse-service.js'
import type { SqliteMetadataRepository } from '../metadata-repository.js'
import { routeRequireProject, type RouteHttpContext, type RouteHttpHelpers } from './route-context.js'

export interface F6AssemblyRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
  readonly warehouse: WarehouseService | undefined
  readonly resultSlots: ResultSlotService | undefined
  readonly conversationIdentity: ConversationIdentityService | undefined
  readonly metadata: SqliteMetadataRepository
}

export async function handleF6AssemblyRoute(ctx: F6AssemblyRouteContext): Promise<boolean> {
  const { method, pathname, url, request, response, controller, metadata, warehouse, resultSlots, conversationIdentity } = ctx
  const { sendJson, failure, readJsonBody, isRecord } = ctx.helpers

  // ---------- P0-B2：Warehouse read model ----------
  const warehouseMatch = /^\/projects\/([^/]+)\/warehouse$/.exec(pathname)
  if (method === 'GET' && warehouseMatch !== null) {
    if (warehouse === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Warehouse service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(warehouseMatch[1] ?? '')
    if (routeRequireProject(projectId, { metadata, response, helpers: ctx.helpers }) === undefined) return true
    const kindsRaw = url.searchParams.get('kinds')
    const kinds = kindsRaw === null
      ? undefined
      : kindsRaw.split(',').map((value) => value.trim()).filter((value): value is WarehouseEntityKindV1 =>
        ['artifact', 'note', 'conversation', 'resource'].includes(value))
    const usedHereRaw = url.searchParams.get('usedHereTarget')
    let usedHereTarget: WarehouseQueryV1['usedHereTarget'] | undefined
    if (usedHereRaw !== null && usedHereRaw !== '') {
      const separator = usedHereRaw.indexOf(':')
      const kind = separator > 0 ? usedHereRaw.slice(0, separator) : ''
      const id = separator > 0 ? usedHereRaw.slice(separator + 1) : ''
      if (kind === 'workspace' && id !== '') usedHereTarget = { kind: 'workspace', id }
    }
    const originRaw = url.searchParams.get('provenance')
    const provenanceOrigin = originRaw !== null && ['run-return', 'import', 'capture', 'unknown'].includes(originRaw)
      ? originRaw as WarehouseQueryV1['provenanceOrigin']
      : undefined
    const searchRaw = url.searchParams.get('search') ?? undefined
    const limitRaw = url.searchParams.get('limit')
    const cursorRaw = url.searchParams.get('cursor') ?? undefined
    const value: WarehouseSnapshotV1 = warehouse.query(projectId, {
      ...(searchRaw === undefined ? {} : { search: searchRaw }),
      ...(kinds === undefined || kinds.length === 0 ? {} : { kinds }),
      ...(provenanceOrigin === undefined ? {} : { provenanceOrigin }),
      ...(usedHereTarget === undefined ? {} : { usedHereTarget }),
      ...(limitRaw === null || Number.isNaN(Number(limitRaw)) ? {} : { limit: Number(limitRaw) }),
      ...(cursorRaw === undefined ? {} : { cursor: cursorRaw }),
    })
    sendJson(response, 200, { ok: true, value })
    return true
  }

  // ---------- P0-D3：Conversation Reachability ----------
  const reachMatch = /^\/projects\/([^/]+)\/connected-conversations\/([^/]+)\/reach$/.exec(pathname)
  if (method === 'GET' && reachMatch !== null) {
    if (conversationIdentity === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Conversation identity service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(reachMatch[1] ?? '')
    const connectedConversationId = decodeURIComponent(reachMatch[2] ?? '')
    if (routeRequireProject(projectId, { metadata, response, helpers: ctx.helpers }) === undefined) return true
    const value: ConversationReachResultV0 | undefined = conversationIdentity.reach(projectId, connectedConversationId)
    if (value === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Connected conversation not found.'))
      return true
    }
    sendJson(response, 200, { ok: true, value })
    return true
  }

  // ---------- P0-D5：ResultSlots ----------
  const slotsListMatch = /^\/projects\/([^/]+)\/result-slots$/.exec(pathname)
  if (slotsListMatch !== null && method === 'GET') {
    if (resultSlots === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Result slot service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(slotsListMatch[1] ?? '')
    if (routeRequireProject(projectId, { metadata, response, helpers: ctx.helpers }) === undefined) return true
    sendJson(response, 200, { ok: true, value: resultSlots.list(projectId) })
    return true
  }
  if (slotsListMatch !== null && method === 'POST') {
    if (resultSlots === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Result slot service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(slotsListMatch[1] ?? '')
    if (routeRequireProject(projectId, { metadata, response, helpers: ctx.helpers }) === undefined) return true
    let input: unknown
    try { input = await readJsonBody(request, controller.signal) } catch {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Result slot body must be valid JSON.'))
      return true
    }
    if (!isRecord(input)
      || typeof input.scopeId !== 'string' || input.scopeId === ''
      || typeof input.x !== 'number' || typeof input.y !== 'number'
      || (input.workspaceId !== undefined && typeof input.workspaceId !== 'string')
      || (input.width !== undefined && typeof input.width !== 'number')
      || (input.height !== undefined && typeof input.height !== 'number')
      || Object.keys(input).some((key) => !['scopeId', 'workspaceId', 'x', 'y', 'width', 'height'].includes(key))) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Result slot requires scopeId, x, y; optional workspaceId/width/height.'))
      return true
    }
    try {
      const value: ResultSlotV0 = resultSlots.create({
        projectId,
        scopeId: input.scopeId,
        ...(typeof input.workspaceId === 'string' ? { workspaceId: input.workspaceId } : {}),
        x: input.x,
        y: input.y,
        ...(typeof input.width === 'number' ? { width: input.width } : {}),
        ...(typeof input.height === 'number' ? { height: input.height } : {}),
      })
      sendJson(response, 201, { ok: true, value })
    } catch (error: unknown) {
      sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Result slot creation failed.'))
    }
    return true
  }

  const slotOneMatch = /^\/result-slots\/([^/]+)$/.exec(pathname)
  if (slotOneMatch !== null && method === 'GET') {
    if (resultSlots === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Result slot service is not configured.'))
      return true
    }
    const slot = resultSlots.get(decodeURIComponent(slotOneMatch[1] ?? ''))
    if (slot === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Result slot not found.'))
      return true
    }
    sendJson(response, 200, { ok: true, value: slot })
    return true
  }
  if (slotOneMatch !== null && method === 'DELETE') {
    if (resultSlots === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Result slot service is not configured.'))
      return true
    }
    try {
      resultSlots.remove(decodeURIComponent(slotOneMatch[1] ?? ''))
      sendJson(response, 200, { ok: true, value: null })
    } catch {
      sendJson(response, 404, failure('NOT_FOUND', 'Result slot not found.'))
    }
    return true
  }

  // ---------- P0-D6：RunRecipe ----------
  const recipeMatch = /^\/runs\/([^/]+)\/recipe$/.exec(pathname)
  if (method === 'GET' && recipeMatch !== null) {
    const runId = decodeURIComponent(recipeMatch[1] ?? '') as RunId
    const run = metadata.getRun(runId)
    if (run === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Run not found.'))
      return true
    }
    const receiverConversationId = metadata.getRunReceiverConversationId(String(runId))
    let receiver: RunRecipeV0['receiver']
    if (receiverConversationId !== undefined && conversationIdentity !== undefined) {
      const chain = conversationIdentity.resolveChain(String(run.projectId), receiverConversationId)
      receiver = {
        connectedConversationId: receiverConversationId,
        ...(chain === undefined ? {} : { provider: chain.connectedConversation.provider }),
      }
    }
    const orderedReferences = metadata.getRunOrderedReferences(String(runId))
    const resultSlotId = metadata.getRunResultSlotId(String(runId))
    const value: RunRecipeV0 = {
      schemaVersion: 0,
      runId: String(runId),
      projectId: String(run.projectId),
      prompt: run.instruction,
      ...(receiver === undefined ? {} : { receiver }),
      intent: run.outputIntent,
      ...(run.targetArtifactId === undefined ? {} : { target: { kind: 'project' as const, id: String(run.projectId) } }),
      orderedReferences,
      ...(run.resultPolicy === undefined ? {} : { resultPolicy: { type: String(run.resultPolicy.type) } }),
      ...(resultSlotId === undefined ? {} : { resultSlotId }),
      ...(run.contextManifestId === undefined ? {} : { contextManifestId: String(run.contextManifestId) }),
      provider: run.provider,
      createdAt: run.createdAt,
    }
    sendJson(response, 200, { ok: true, value })
    return true
  }

  return false
}
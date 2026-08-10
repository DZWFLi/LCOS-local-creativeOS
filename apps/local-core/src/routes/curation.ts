import type { SearchEntityTypeV0 } from '@local-creative-os/contracts'

import type { CurationQueryService } from '../curation-query-service.js'
import type { CurationCommandService } from '../curation-command-service.js'
import type { ProjectSearchService } from '../project-search-service.js'
import type { SqliteMetadataRepository } from '../metadata-repository.js'
import type { RouteHttpContext, RouteHttpHelpers } from './route-context.js'

export interface CurationRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
  readonly curation: CurationQueryService | undefined
  readonly curationCommand: CurationCommandService | undefined
  readonly search: ProjectSearchService | undefined
}

function titleForEntity(metadata: SqliteMetadataRepository, entityType: string, entityId: string): string {
  if (entityType === 'artifact') return metadata.getArtifact(entityId)?.title ?? entityId
  if (entityType === 'note') return metadata.getNote(entityId)?.body.slice(0, 80) ?? entityId
  if (entityType === 'workspace') return metadata.getWorkspace(entityId)?.name ?? entityId
  if (entityType === 'scope') return metadata.get(entityId === '' ? '' : metadata.getProject(entityId)?.id ?? '')?.scopes.find((scope) => scope.id === entityId)?.name ?? entityId
  if (entityType === 'view') {
    const view = metadata.getArtifactView(entityId)
    return view === undefined ? entityId : metadata.getArtifact(String(view.artifactId))?.title ?? entityId
  }
  return entityId
}

/**
 * Phase D routes: bounded curation read, 1-hop related, federated search.
 */
export async function handleCurationRoute(ctx: CurationRouteContext): Promise<boolean> {
  const { method, pathname, url, request, response, controller, metadata, curation, curationCommand, search } = ctx
  const { sendJson, failure, readJsonBody } = ctx.helpers

  const readMatch = /^\/projects\/([^/]+)\/curation\/read$/.exec(pathname)
  const relatedMatch = /^\/projects\/([^/]+)\/related$/.exec(pathname)
  const searchMatch = /^\/projects\/([^/]+)\/search$/.exec(pathname)
  const applyMatch = /^\/projects\/([^/]+)\/curation\/apply$/.exec(pathname)
  const textMatch = /^\/projects\/([^/]+)\/curation\/text$/.exec(pathname)
  if (readMatch === null && relatedMatch === null && searchMatch === null && applyMatch === null && textMatch === null) return false
  if (metadata === undefined) return false

  if (readMatch !== null && method === 'POST') {
    if (curation === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Curation query service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(readMatch[1] ?? '')
    const body = await readJsonBody(request, controller.signal) as { viewIds?: string[]; budget?: { maxItems?: number; maxCharsPerItem?: number; maxTotalChars?: number } }
    if (!Array.isArray(body?.viewIds) || body.viewIds.some((id) => typeof id !== 'string')) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'viewIds must be an array of strings.'))
      return true
    }
    try {
      const value = await curation.readViews(projectId, body.viewIds, body.budget)
      sendJson(response, 200, { ok: true, value })
    } catch (error: unknown) {
      sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Curation read failed.'))
    }
    return true
  }

  if (relatedMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(relatedMatch[1] ?? '')
    const entityType = url.searchParams.get('entityType')
    const entityId = url.searchParams.get('entityId')
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 10) || 10))
    if (entityType === null || entityId === null) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'related requires entityType and entityId.'))
      return true
    }
    const relations = metadata.getRelations(projectId).filter((relation) =>
      (String(relation.sourceEntityType) === entityType && String(relation.sourceEntityId) === entityId)
      || (String(relation.targetEntityType) === entityType && String(relation.targetEntityId) === entityId))
    const items = relations.slice(0, limit).map((relation) => {
      const isSource = String(relation.sourceEntityType) === entityType && String(relation.sourceEntityId) === entityId
      const otherType = isSource ? relation.targetEntityType : relation.sourceEntityType
      const otherId = isSource ? String(relation.targetEntityId) : String(relation.sourceEntityId)
      return {
        relationId: String(relation.id),
        kind: relation.kind,
        entityType: otherType,
        entityId: otherId,
        title: titleForEntity(metadata, otherType, otherId),
        origin: 'domain',
      }
    })
    sendJson(response, 200, { ok: true, value: { items, totalMatches: relations.length, truncated: relations.length > limit } })
    return true
  }

  if (searchMatch !== null && method === 'GET') {
    if (search === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Search service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(searchMatch[1] ?? '')
    const query = url.searchParams.get('q') ?? ''
    const limitRaw = url.searchParams.get('limit')
    const typesRaw = url.searchParams.get('types')
    const types = typesRaw === null
      ? undefined
      : typesRaw.split(',').map((value) => value.trim()).filter((value): value is SearchEntityTypeV0 =>
        ['artifact', 'note', 'conversation', 'resource', 'file'].includes(value))
    const value = await search.search(projectId, query, {
      ...(limitRaw === null ? {} : { limit: Number(limitRaw) || 10 }),
      ...(types === undefined || types.length === 0 ? {} : { types }),
    })
    sendJson(response, 200, { ok: true, value })
    return true
  }

  if (applyMatch !== null && method === 'POST') {
    if (curationCommand === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Curation command service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(applyMatch[1] ?? '')
    const body = await readJsonBody(request, controller.signal) as { operationId?: string; schemaVersion?: number; projectId?: string; scopeId?: string; createTexts?: unknown[]; relations?: unknown[]; presentation?: unknown }
    if (body?.schemaVersion !== 0 || typeof body.scopeId !== 'string' || !Array.isArray(body.createTexts) || !Array.isArray(body.relations)) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Curation patch requires schemaVersion 0, scopeId, createTexts and relations.'))
      return true
    }
    try {
      const value = await curationCommand.applyPatch(projectId, body as never)
      sendJson(response, value.applied ? 200 : 422, { ok: true, value })
    } catch (error: unknown) {
      sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Curation patch failed.'))
    }
    return true
  }

  if (textMatch !== null && (method === 'POST' || method === 'PUT')) {
    if (curationCommand === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Curation command service is not configured.'))
      return true
    }
    const projectId = decodeURIComponent(textMatch[1] ?? '')
    const body = await readJsonBody(request, controller.signal) as { scopeId?: string; title?: string; body?: string; viewId?: string; artifactId?: string }
    if (typeof body.body !== 'string' || body.body.trim() === '') {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'body is required.'))
      return true
    }
    try {
      const value = method === 'POST'
        ? await curationCommand.createText(projectId, { scopeId: body.scopeId ?? '', ...(body.title === undefined ? {} : { title: body.title }), body: body.body })
        : await curationCommand.updateText(projectId, { ...(body.viewId === undefined ? {} : { viewId: body.viewId }), ...(body.artifactId === undefined ? {} : { artifactId: body.artifactId }) }, body.body)
      sendJson(response, 200, { ok: true, value })
    } catch (error: unknown) {
      sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Text curation failed.'))
    }
    return true
  }
  return false
}

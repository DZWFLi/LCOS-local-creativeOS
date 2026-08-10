import type { SearchEntityTypeV0 } from '@local-creative-os/contracts'

import type { CurationQueryService } from '../curation-query-service.js'
import type { ProjectSearchService } from '../project-search-service.js'
import type { SqliteMetadataRepository } from '../metadata-repository.js'
import type { RouteHttpContext, RouteHttpHelpers } from './route-context.js'

export interface CurationRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
  readonly curation: CurationQueryService | undefined
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
  const { method, pathname, url, request, response, controller, metadata, curation, search } = ctx
  const { sendJson, failure, readJsonBody } = ctx.helpers

  const readMatch = /^\/projects\/([^/]+)\/curation\/read$/.exec(pathname)
  const relatedMatch = /^\/projects\/([^/]+)\/related$/.exec(pathname)
  const searchMatch = /^\/projects\/([^/]+)\/search$/.exec(pathname)
  if (readMatch === null && relatedMatch === null && searchMatch === null) return false
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
  return false
}

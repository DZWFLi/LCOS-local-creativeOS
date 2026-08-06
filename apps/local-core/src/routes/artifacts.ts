import type { ProjectId } from '@local-creative-os/domain'
import { ProcessProjectionService } from '../process-projection-service.js'
import { RuntimeRevisionCompareService } from '../runtime-revision-compare-service.js'
import { routeRequireMetadata, type RouteHttpContext, type RouteHttpHelpers } from './route-context.js'

export interface ArtifactsRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
}

/**
 * artifacts 搜索/详情、revisions 列表/对比、process-projection。
 * 原为 server.ts 分发器内联块，外迁后行为不变。
 */
export async function handleArtifactsRoute(ctx: ArtifactsRouteContext): Promise<boolean> {
  const { method, pathname, url, response, metadata } = ctx
  const { sendJson, failure } = ctx.helpers

  const artifactSearchMatch = /^\/projects\/([^/]+)\/artifacts\/search$/.exec(pathname)
  if (method === 'GET' && artifactSearchMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const projectId = decodeURIComponent(artifactSearchMatch[1] ?? '') as ProjectId
    const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('en-US')
    const matches = db.getArtifacts(String(projectId))
      .filter((artifact) => query.length === 0 || artifact.title.toLocaleLowerCase('en-US').includes(query))
      .slice(0, 50)
    sendJson(response, 200, { ok: true, value: matches })
    return true
  }

  const artifactDetailMatch = /^\/artifacts\/([^/]+)$/.exec(pathname)
  if (method === 'GET' && artifactDetailMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const artifactId = decodeURIComponent(artifactDetailMatch[1] ?? '')
    const artifact = db.getArtifact(artifactId)
    if (artifact === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Artifact not found.'))
      return true
    }
    const revisions = db.getArtifactRevisions(artifactId)
    const runById = new Map(
      db.getProjectRuns(artifact.projectId, 100).map((run) => [String(run.id), run]),
    )
    sendJson(response, 200, {
      ok: true,
      value: {
        artifact,
        currentRevisionId: artifact.currentRevisionId,
        revisions: revisions.map((revision) => ({
          id: String(revision.id),
          status: revision.status,
          source: revision.source,
          createdAt: revision.createdAt,
          ...(revision.runId === undefined ? {} : {
            run: {
              id: String(revision.runId),
              instruction: runById.get(String(revision.runId))?.instruction ?? null,
              provider: runById.get(String(revision.runId))?.provider ?? null,
            },
          }),
        })),
      },
    })
    return true
  }

  const revisionListMatch = /^\/artifacts\/([^/]+)\/revisions$/.exec(pathname)
  if (method === 'GET' && revisionListMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const artifactId = decodeURIComponent(revisionListMatch[1] ?? '')
    sendJson(response, 200, { ok: true, value: db.getArtifactRevisions(artifactId) })
    return true
  }

  const revisionCompareMatch = /^\/projects\/([^/]+)\/revisions\/compare$/.exec(pathname)
  if (method === 'GET' && revisionCompareMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const base = url.searchParams.get('base')
    const head = url.searchParams.get('head')
    if (base === null || head === null) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Compare requires base and head revision ids.'))
      return true
    }
    try {
      sendJson(response, 200, {
        ok: true,
        value: await new RuntimeRevisionCompareService(db).compare(base, head),
      })
    } catch (error: unknown) {
      sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Compare failed.'))
    }
    return true
  }

  const processProjectionMatch = /^\/projects\/([^/]+)\/process-projection$/.exec(pathname)
  if (method === 'GET' && processProjectionMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const projectId = decodeURIComponent(processProjectionMatch[1] ?? '') as ProjectId
    sendJson(response, 200, {
      ok: true,
      value: new ProcessProjectionService(db).project(projectId),
    })
    return true
  }

  return false
}

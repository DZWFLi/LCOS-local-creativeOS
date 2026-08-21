import type { ArtifactViewId, ProjectId, RunId, WorkspaceId } from '@local-creative-os/domain'
import { WorkspaceStateService } from '../workspace-state-service.js'
import { routeRequireMetadata, routeRequireProject, type RouteHttpContext, type RouteHttpHelpers } from './route-context.js'

export interface WorkspaceStatesRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
}

/**
 * workspaces/:id/states*、session-summaries、workspace-memberships/members。
 * 原为 server.ts 分发器内联块，外迁后行为不变。
 */
export async function handleWorkspaceStatesRoute(ctx: WorkspaceStatesRouteContext): Promise<boolean> {
  const { method, pathname, request, response, controller, metadata } = ctx
  const { sendJson, failure, readJsonBody, isRecord, isStringArray } = ctx.helpers

  const workspaceStatesMatch = /^\/workspaces\/([^/]+)\/states$/.exec(pathname)
  if (workspaceStatesMatch !== null && (method === 'GET' || method === 'POST')) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const workspaceId = decodeURIComponent(workspaceStatesMatch[1] ?? '') as WorkspaceId
    const service = new WorkspaceStateService(db)
    if (method === 'GET') {
      sendJson(response, 200, { ok: true, value: service.list(workspaceId) })
      return true
    }
    const input = await readJsonBody(request, controller.signal)
    if (!isRecord(input) || typeof input.name !== 'string'
      || Object.keys(input).some((key) => !['name'].includes(key))) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Workspace state save requires name.'))
      return true
    }
    try {
      sendJson(response, 201, { ok: true, value: service.save(workspaceId, input.name, new Date().toISOString()) })
    } catch (error: unknown) {
      sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Workspace state save failed.'))
    }
    return true
  }

  const workspaceStateRestoreMatch = /^\/workspaces\/([^/]+)\/states\/([^/]+)\/restore$/.exec(pathname)
  if (method === 'POST' && workspaceStateRestoreMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const stateId = decodeURIComponent(workspaceStateRestoreMatch[2] ?? '')
    try {
      sendJson(response, 200, {
        ok: true,
        value: new WorkspaceStateService(db).restore(stateId),
      })
    } catch (error: unknown) {
      sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Workspace state restore failed.'))
    }
    return true
  }

  const sessionSummariesMatch = /^\/projects\/([^/]+)\/session-summaries$/.exec(pathname)
  if (sessionSummariesMatch !== null && (method === 'GET' || method === 'POST')) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const projectId = decodeURIComponent(sessionSummariesMatch[1] ?? '') as ProjectId
    if (method === 'GET') {
      sendJson(response, 200, { ok: true, value: db.listSessionSummaries(projectId) })
      return true
    }
    const input = await readJsonBody(request, controller.signal)
    if (!isRecord(input) || typeof input.title !== 'string' || typeof input.summary !== 'string'
      || (input.runIds !== undefined && !isStringArray(input.runIds))
      || (input.handoffRef !== undefined && typeof input.handoffRef !== 'string')
      || Object.keys(input).some((key) => !['title', 'summary', 'runIds', 'handoffRef'].includes(key))) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Session summary requires title and summary.'))
      return true
    }
    const now = new Date().toISOString()
    sendJson(response, 201, {
      ok: true,
      value: db.createSessionSummary({
        id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        title: input.title,
        summary: input.summary,
        runIds: (input.runIds ?? []) as RunId[],
        ...(input.handoffRef === undefined ? {} : { handoffRef: input.handoffRef }),
        createdAt: now,
        updatedAt: now,
      }),
    })
    return true
  }

  const projectMembershipsMatch = /^\/projects\/([^/]+)\/workspace-memberships$/.exec(pathname)
  if (method === 'GET' && projectMembershipsMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const projectId = decodeURIComponent(projectMembershipsMatch[1] ?? '') as ProjectId
    if (routeRequireProject(projectId, { metadata: db, response, helpers: ctx.helpers }) === undefined) return true
    sendJson(response, 200, { ok: true, value: db.listProjectWorkspaceMemberships(projectId) })
    return true
  }

  const membersMatch = /^\/workspaces\/([^/]+)\/members$/.exec(pathname)
  if (membersMatch !== null && (method === 'POST' || method === 'GET')) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const workspaceId = decodeURIComponent(membersMatch[1] ?? '') as WorkspaceId
    if (db.getWorkspace(workspaceId) === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Workspace not found.'))
      return true
    }
    if (method === 'GET') {
      sendJson(response, 200, { ok: true, value: db.listWorkspaceMembers(workspaceId) })
      return true
    }
    const input = await readJsonBody(request, controller.signal)
    if (!isRecord(input) || !isStringArray(input.viewIds)
      || (input.addedBy !== undefined && typeof input.addedBy !== 'string')
      || Object.keys(input).some((key) => !['viewIds', 'addedBy'].includes(key))) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Membership add requires viewIds array.'))
      return true
    }
    const addedBy = ['user', 'agent', 'run', 'import'].includes(String(input.addedBy ?? 'user'))
      ? String(input.addedBy ?? 'user') as 'user' | 'agent' | 'run' | 'import'
      : 'user'
    sendJson(response, 200, {
      ok: true,
      value: db.addWorkspaceMembers(
        workspaceId,
        input.viewIds as ArtifactViewId[],
        addedBy,
        new Date().toISOString(),
      ),
    })
    return true
  }

  const memberOneMatch = /^\/workspaces\/([^/]+)\/members\/([^/]+)$/.exec(pathname)
  if (method === 'DELETE' && memberOneMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const workspaceId = decodeURIComponent(memberOneMatch[1] ?? '') as WorkspaceId
    const viewId = decodeURIComponent(memberOneMatch[2] ?? '') as ArtifactViewId
    if (db.getWorkspace(workspaceId) === undefined) {
      sendJson(response, 404, failure('NOT_FOUND', 'Workspace not found.'))
      return true
    }
    sendJson(response, 200, {
      ok: true,
      value: db.removeWorkspaceMembers(workspaceId, [viewId]),
    })
    return true
  }

  const membersMoveMatch = /^\/workspaces\/([^/]+)\/members\/move$/.exec(pathname)
  if (method === 'POST' && membersMoveMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    const fromWorkspaceId = decodeURIComponent(membersMoveMatch[1] ?? '') as WorkspaceId
    const input = await readJsonBody(request, controller.signal)
    if (!isRecord(input) || typeof input.toWorkspaceId !== 'string' || typeof input.viewId !== 'string'
      || Object.keys(input).some((key) => !['toWorkspaceId', 'viewId'].includes(key))) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Membership move requires toWorkspaceId and viewId.'))
      return true
    }
    try {
      sendJson(response, 200, {
        ok: true,
        value: db.moveWorkspaceMembers(
          fromWorkspaceId,
          input.toWorkspaceId as WorkspaceId,
          [input.viewId as ArtifactViewId],
          'user',
          new Date().toISOString(),
        ),
      })
    } catch (error: unknown) {
      sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Membership move conflicted.'))
    }
    return true
  }

  return false
}

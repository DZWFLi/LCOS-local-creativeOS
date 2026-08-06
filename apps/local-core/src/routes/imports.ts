import type { Project, RegisterTrustedSourceInput } from '@local-creative-os/contracts'
import type { ProjectId } from '@local-creative-os/domain'
import { ImportCopyConflictError, type ImportCopyService } from '../import-copy-service.js'
import type { FileRegistryService } from '../file-registry-service.js'
import type { UniversalResourceImportService } from '../resources/universal-resource-import-service.js'
import { FORBIDDEN_BROWSER_PATH_FIELDS, routeRequireMetadata, type RouteHttpContext, type RouteHttpHelpers } from './route-context.js'
import { parseMultipartImport } from './multipart.js'
import { publicResourceImportResult } from './resources.js'

export interface ImportsRouteContext extends RouteHttpContext {
  readonly helpers: RouteHttpHelpers
  readonly fileRegistry: FileRegistryService | undefined
  readonly importCopy: ImportCopyService | undefined
  readonly resources: UniversalResourceImportService | undefined
  readonly maxImportBodyBytes: number
}

/**
 * /projects/:id/sources（不透明 selectionId 注册）与 /projects/:id/imports（拖入文件导入）。
 * 原为 server.ts 分发器内联块，外迁后行为不变。
 */
export async function handleImportsRoute(ctx: ImportsRouteContext): Promise<boolean> {
  const { method, pathname, request, response, controller, metadata, fileRegistry, importCopy, resources, maxImportBodyBytes } = ctx
  const { sendJson, failure, readJsonBody, readRawBody, isRecord } = ctx.helpers

  // Browser supplies only an opaque trusted selection ID, never a path.
  const sourceMatch = /^\/projects\/([^/]+)\/sources$/.exec(pathname)
  if (method === 'POST' && sourceMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    if (fileRegistry === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Trusted file picker adapter is not configured.'))
      return true
    }
    let input: unknown
    try { input = await readJsonBody(request, controller.signal) } catch {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Source registration body must be valid JSON.'))
      return true
    }
    if (!isRecord(input) || typeof input.selectionId !== 'string'
      || ('path' in input) || ('absolutePath' in input) || ('rootPath' in input)
      || (input.title !== undefined && typeof input.title !== 'string')) {
      sendJson(response, 400, failure('INVALID_ARGUMENT', 'Source registration requires only selectionId and optional title.'))
      return true
    }
    const projectId = decodeURIComponent(sourceMatch[1] ?? '')
    try {
      const result = await fileRegistry.registerSource(
        projectId as Project['id'],
        input as unknown as RegisterTrustedSourceInput,
        controller.signal,
      )
      sendJson(response, 201, { ok: true, value: result })
    } catch (error: unknown) {
      sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Source registration failed.'))
    }
    return true
  }

  const importMatch = /^\/projects\/([^/]+)\/imports$/.exec(pathname)
  if (method === 'POST' && importMatch !== null) {
    const db = routeRequireMetadata(ctx); if (db === undefined) return true
    if (importCopy === undefined) {
      sendJson(response, 503, failure('UNAVAILABLE', 'Import Copy service is not configured.'))
      return true
    }
    try {
      const body = await readRawBody(request, controller.signal, maxImportBodyBytes)
      const multipart = parseMultipartImport(request.headers['content-type'], body)
      const projectId = decodeURIComponent(importMatch[1] ?? '')
      const x = Number(multipart.fields['position.x'])
      const y = Number(multipart.fields['position.y'])
      const forbiddenPathField = Object.keys(multipart.fields).find((field) => FORBIDDEN_BROWSER_PATH_FIELDS.has(field))
      if (forbiddenPathField !== undefined) {
        sendJson(response, 400, failure('INVALID_ARGUMENT', `Import Copy does not accept browser supplied path field: ${forbiddenPathField}.`))
        return true
      }
      if (!multipart.fields.importRequestId || !multipart.fields.scopeId || !Number.isFinite(x) || !Number.isFinite(y)) {
        sendJson(response, 400, failure('INVALID_ARGUMENT', 'Import Copy requires importRequestId, scopeId, position.x, position.y and file.'))
        return true
      }
      const result = await importCopy.importCopy(projectId as ProjectId, {
        importRequestId: multipart.fields.importRequestId,
        scopeId: multipart.fields.scopeId,
        position: { x, y },
        fileName: multipart.file.fileName,
        contentType: multipart.file.contentType,
        bytes: multipart.file.bytes,
      })
      const outcome = resources === undefined
        ? undefined
        : await resources.afterImport(projectId as ProjectId, result)
      sendJson(response, result.reused ? 200 : 201, {
        ok: true,
        value: {
          artifact: result.artifact,
          revision: result.revision,
          view: result.view,
          reused: result.reused,
          ...(outcome === undefined ? {} : { resource: publicResourceImportResult(outcome) }),
        },
      })
    } catch (error: unknown) {
      const status = error instanceof RangeError ? 413 : error instanceof ImportCopyConflictError ? 409 : 400
      sendJson(response, status, failure(error instanceof ImportCopyConflictError ? 'CONFLICT' : 'VALIDATION', error instanceof Error ? error.message : 'Import Copy failed.'))
    }
    return true
  }

  return false
}

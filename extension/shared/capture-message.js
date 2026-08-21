(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.LCOSCaptureMessage = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KINDS = new Set(['page', 'selection', 'image', 'link', 'screenshot', 'text'])

  function validateCaptureRequest(input) {
    if (typeof input !== 'object' || input === null) throw new Error('CaptureRequestV1 must be an object.')
    if (input.schemaVersion !== 1) throw new Error('CaptureRequestV1 requires schemaVersion 1.')
    if (typeof input.operationId !== 'string' || input.operationId === '') throw new Error('CaptureRequestV1 requires operationId.')
    if (typeof input.capturedAt !== 'string' || Number.isNaN(Date.parse(input.capturedAt))) throw new Error('CaptureRequestV1 requires a valid capturedAt.')
    const source = input.source
    if (typeof source !== 'object' || source === null || !KINDS.has(source.kind)) throw new Error(`Unsupported source kind ${source?.kind}.`)
    if (typeof input.target !== 'object' || input.target === null || !['auto', 'project', 'staging'].includes(input.target.mode)) {
      throw new Error('CaptureRequestV1 requires target.mode auto|project|staging.')
    }
    return input
  }

  function buildCaptureRequestV1({ operationId, kind, pageUrl, pageTitle, sourceUrl, text, dataUrl, mimeType, mode = 'staging', projectId, title }) {
    const source = { kind }
    if (pageUrl !== undefined) source.pageUrl = pageUrl
    if (pageTitle !== undefined) source.pageTitle = pageTitle
    if (sourceUrl !== undefined) source.sourceUrl = sourceUrl
    const request = {
      schemaVersion: 1,
      operationId: operationId || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      capturedAt: new Date().toISOString(),
      source,
      target: mode === 'project' ? { mode, projectId } : { mode },
    }
    if (text !== undefined) request.content = { text }
    if (dataUrl !== undefined) request.content = { dataUrl, mimeType: mimeType ?? 'image/png' }
    if (title !== undefined) request.hints = { title }
    return validateCaptureRequest(request)
  }

  return { KINDS, buildCaptureRequestV1, validateCaptureRequest }
})

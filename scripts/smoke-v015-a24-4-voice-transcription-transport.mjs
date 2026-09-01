import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const root = process.cwd()
const temp = await mkdtemp(join(tmpdir(), 'lcos-a24-4-'))

async function transpile(sourcePath, outName, replacements = []) {
  let source = await readFile(join(root, sourcePath), 'utf8')
  let js = stripTypeScriptTypes(source, { mode: 'transform' })
  for (const [from, to] of replacements) js = js.replaceAll(from, to)
  const out = join(temp, outName)
  await writeFile(out, js)
  return out
}

try {
  const servicePath = await transpile('apps/local-core/src/voice-transcription-service.ts', 'voice-transcription-service.mjs')
  await transpile('apps/local-core/src/routes/multipart.ts', 'multipart.mjs')
  const routePath = await transpile('apps/local-core/src/routes/voice-transcription.ts', 'voice-transcription-route.mjs', [
    ["../voice-transcription-service.js", './voice-transcription-service.mjs'],
    ["./multipart.js", './multipart.mjs'],
  ])
  const helperPath = await transpile('apps/web/src/features/execution/voiceTranscriptionTransport.ts', 'voice-transcription-transport.mjs')

  const { VoiceTranscriptionProviderRegistry, VoiceTranscriptionService } = await import(pathToFileURL(servicePath).href)
  const { handleVoiceTranscriptionRoute } = await import(pathToFileURL(routePath).href)
  const { buildVoiceTranscriptionFormData } = await import(pathToFileURL(helperPath).href)

  const seen = []
  const provider = {
    id: 'fake-stt',
    supports({ mimeType }) { return mimeType.startsWith('audio/webm') ? 10 : 0 },
    async transcribe(request) {
      seen.push(request)
      return {
        text: '你好\r\nworld',
        language: 'zh',
        segments: [{ startMs: 0, endMs: 420, text: '你好\r\nworld' }],
        model: 'fake-model',
      }
    },
  }
  const service = new VoiceTranscriptionService({
    registry: new VoiceTranscriptionProviderRegistry({ providers: [provider] }),
  })

  function helpers(capture) {
    return {
      sendJson(_response, statusCode, value) { capture.status = statusCode; capture.body = value },
      failure(code, message, retryable = false) { return { ok: false, error: { code, message, retryable, origin: 'runtime' } } },
      async readRawBody(request, signal, maxBytes) {
        const chunks = []
        let total = 0
        for await (const chunk of request) {
          if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          total += buffer.length
          if (total > maxBytes) throw new RangeError('Request body is too large')
          chunks.push(buffer)
        }
        return Buffer.concat(chunks)
      },
    }
  }

  async function encodedForm(form) {
    const response = new Response(form)
    return {
      contentType: response.headers.get('content-type'),
      body: Buffer.from(await response.arrayBuffer()),
    }
  }

  async function invoke(form, options = {}) {
    const encoded = await encodedForm(form)
    const request = Readable.from([encoded.body])
    request.headers = { 'content-type': encoded.contentType }
    const capture = {}
    const controller = new AbortController()
    const handled = await handleVoiceTranscriptionRoute({
      method: options.method ?? 'POST',
      pathname: options.pathname ?? '/runtime/voice/transcriptions',
      url: new URL('http://127.0.0.1/runtime/voice/transcriptions'),
      request,
      response: {},
      controller,
      metadata: undefined,
      helpers: helpers(capture),
      voiceTranscription: options.service ?? service,
      maxBodyBytes: options.maxBodyBytes ?? 1024 * 1024,
    })
    return { handled, ...capture }
  }

  const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm;codecs=opus' })
  const form = buildVoiceTranscriptionFormData({
    audio,
    durationMs: 420,
    language: ' zh-CN ',
    prompt: '  LCOS context  ',
    timestamps: true,
    providerId: ' fake-stt ',
  })
  const ok = await invoke(form)
  assert.equal(ok.handled, true)
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, {
    ok: true,
    value: {
      text: '你好\nworld',
      language: 'zh',
      segments: [{ startMs: 0, endMs: 420, text: '你好\nworld' }],
      model: 'fake-model',
      providerId: 'fake-stt',
    },
  })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].audio.mimeType, 'audio/webm;codecs=opus')
  assert.equal(seen[0].audio.durationMs, 420)
  assert.equal(Buffer.from(seen[0].audio.bytes).equals(Buffer.from([1, 2, 3, 4])), true)
  assert.deepEqual(seen[0].hints, { language: 'zh-CN', prompt: 'LCOS context', timestamps: true })

  const unknown = new FormData()
  unknown.append('file', audio, 'voice-input')
  unknown.append('mystery', '1')
  const unknownResult = await invoke(unknown)
  assert.equal(unknownResult.status, 400)
  assert.equal(unknownResult.body.ok, false)

  const wrongMime = new FormData()
  wrongMime.append('file', new Blob(['not-audio'], { type: 'text/plain' }), 'voice-input')
  const wrongMimeResult = await invoke(wrongMime)
  assert.equal(wrongMimeResult.status, 400)

  const unavailable = new VoiceTranscriptionService({ registry: new VoiceTranscriptionProviderRegistry() })
  const unavailableResult = await invoke(buildVoiceTranscriptionFormData({ audio }), { service: unavailable })
  assert.equal(unavailableResult.status, 503)
  assert.equal(unavailableResult.body.error.code, 'UNAVAILABLE')

  const oversizedResult = await invoke(buildVoiceTranscriptionFormData({ audio }), { maxBodyBytes: 8 })
  assert.equal(oversizedResult.status, 413)

  const otherPath = await invoke(buildVoiceTranscriptionFormData({ audio }), { pathname: '/runtime/not-voice' })
  assert.equal(otherPath.handled, false)

  process.stdout.write('A24-4 voice transcription transport runtime smoke: PASS\n')
} finally {
  await rm(temp, { recursive: true, force: true })
}

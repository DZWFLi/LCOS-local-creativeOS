import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const moduleUrl = pathToFileURL(new URL('../apps/local-core/src/voice-transcription-service.ts', import.meta.url).pathname).href
const {
  VoiceTranscriptionError,
  VoiceTranscriptionProviderRegistry,
  VoiceTranscriptionService,
} = await import(moduleUrl)

const audio = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm;codecs=opus', durationMs: 1250 }
const calls = []
const low = {
  id: 'low',
  supports: ({ mimeType }) => mimeType.startsWith('audio/') ? 1 : 0,
  async transcribe(request) {
    calls.push(['low', request.audio.mimeType])
    return { text: 'low' }
  },
}
const preferred = {
  id: 'preferred',
  supports: ({ mimeType }) => mimeType.startsWith('audio/') ? 5 : 0,
  async transcribe(request) {
    calls.push(['preferred', request.hints?.language])
    return {
      text: 'hello\r\nworld',
      language: ' en ',
      model: ' model-a ',
      segments: [
        { startMs: 0, endMs: 500, text: 'hello' },
        { startMs: 500, endMs: 1200, text: 'world' },
      ],
    }
  },
}

const registry = new VoiceTranscriptionProviderRegistry({ providers: [low, preferred], preferredProviderId: 'preferred' })
const service = new VoiceTranscriptionService({ registry })
const result = await service.transcribe({ audio, hints: { language: 'en', timestamps: true } })
assert.equal(result.providerId, 'preferred')
assert.equal(result.text, 'hello\nworld')
assert.equal(result.language, 'en')
assert.equal(result.model, 'model-a')
assert.deepEqual(result.segments?.map(({ startMs, endMs }) => [startMs, endMs]), [[0, 500], [500, 1200]])
assert.deepEqual(calls, [['preferred', 'en']])

const explicit = await service.transcribe({ audio }, 'low')
assert.equal(explicit.providerId, 'low')
assert.equal(explicit.text, 'low')

await assert.rejects(
  () => service.transcribe({ audio: { bytes: new Uint8Array(), mimeType: 'audio/webm' } }),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'invalid-audio' && error.retryable === false,
)

const emptyRegistry = new VoiceTranscriptionProviderRegistry()
await assert.rejects(
  () => new VoiceTranscriptionService({ registry: emptyRegistry }).transcribe({ audio }),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'provider-unavailable',
)

await assert.rejects(
  () => service.transcribe({ audio: { ...audio, mimeType: 'video/mp4' } }, 'preferred'),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'unsupported-audio',
)

const badSegments = new VoiceTranscriptionProviderRegistry({ providers: [{
  id: 'bad-segments', supports: () => 10,
  async transcribe() { return { text: 'bad', segments: [{ startMs: 500, endMs: 200, text: 'oops' }] } },
}] })
await assert.rejects(
  () => new VoiceTranscriptionService({ registry: badSegments }).transcribe({ audio }),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'provider-failed' && error.providerId === 'bad-segments',
)

const providerFailure = new VoiceTranscriptionProviderRegistry({ providers: [{
  id: 'fails', supports: () => 10, async transcribe() { throw new Error('boom') },
}] })
await assert.rejects(
  () => new VoiceTranscriptionService({ registry: providerFailure }).transcribe({ audio }),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'provider-failed' && error.providerId === 'fails' && error.retryable === true,
)

const controller = new AbortController()
controller.abort()
await assert.rejects(
  () => service.transcribe({ audio, signal: controller.signal }),
  (error) => error instanceof VoiceTranscriptionError && error.code === 'aborted',
)

console.log('A24-3 transcription runtime smoke: PASS')

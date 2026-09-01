import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'

const root = process.cwd()
const temp = await mkdtemp(join(tmpdir(), 'lcos-a24-6-smoke-'))

async function transpile(sourcePath, outName, replacements = []) {
  let source = await readFile(join(root, sourcePath), 'utf8')
  let js = stripTypeScriptTypes(source, { mode: 'transform' })
  for (const [from, to] of replacements) js = js.replaceAll(from, to)
  const out = join(temp, outName)
  await writeFile(out, js)
  return out
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

try {
  const capturePath = await transpile('apps/web/src/features/execution/voiceCapture.ts', 'voiceCapture.mjs')
  const fakeXstatePath = join(temp, 'fakeXstate.mjs')
  const fakeLifecyclePath = join(temp, 'fakeLifecycle.mjs')
  await writeFile(fakeXstatePath, `export function createActor(machine) {\n  let state = machine.initial\n  let started = false\n  const listeners = new Set()\n  const emit = () => { const snapshot = { value: state }; for (const listener of listeners) listener(snapshot) }\n  return {\n    start() { started = true; emit(); return this },\n    stop() { started = false; listeners.clear() },\n    subscribe(listener) { listeners.add(typeof listener === 'function' ? listener : listener.next); return { unsubscribe() { listeners.delete(listener) } } },\n    getSnapshot() { return { value: state } },\n    send(event) { const next = machine.transitions[state]?.[event.type]; if (next) { state = next; if (started) emit() } },\n  }\n}\n`)
  await writeFile(fakeLifecyclePath, `export const voiceLifecycleMachine = {\n  initial: 'idle',\n  transitions: {\n    idle: { START_RECORDING: 'requestingPermission' },\n    requestingPermission: { PERMISSION_GRANTED: 'recording', PERMISSION_DENIED: 'permissionDenied', CAPTURE_FAILED: 'captureError', CANCEL: 'idle' },\n    recording: { STOP_RECORDING: 'transcribing', CAPTURE_FAILED: 'captureError', CANCEL: 'idle' },\n    transcribing: { TRANSCRIPTION_SUCCEEDED: 'editable', TRANSCRIPTION_FAILED: 'transcriptionError', CANCEL: 'idle' },\n    editable: { START_RECORDING: 'requestingPermission', RESET: 'idle' },\n    permissionDenied: { RETRY: 'requestingPermission', RESET: 'idle' },\n    captureError: { RETRY: 'requestingPermission', RESET: 'idle' },\n    transcriptionError: { RETRY: 'transcribing', RESET: 'idle' },\n  },\n}\n`)
  const orchestratorPath = await transpile('apps/web/src/features/execution/voiceOrchestration.ts', 'voiceOrchestration.mjs', [
    ["../../vendor/xstate-5.32.6/src/index.ts", './fakeXstate.mjs'],
    ["./voiceCapture", './voiceCapture.mjs'],
    ["./voiceLifecycle", './fakeLifecycle.mjs'],
  ])

  const { VoiceCaptureError } = await import(pathToFileURL(capturePath).href)
  const { DefaultVoiceOrchestrator, VoiceOrchestrationError, createLocalCoreVoiceTranscribePort } = await import(pathToFileURL(orchestratorPath).href)

  class FakeCapture {
    active = false
    startCalls = 0
    stopCalls = 0
    cancelCalls = 0
    listeners = new Set()
    startImpl = null
    stopImpl = null

    onError(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
    async start() {
      this.startCalls += 1
      if (this.startImpl) await this.startImpl()
      this.active = true
    }
    async stop() {
      this.stopCalls += 1
      if (this.stopImpl) return this.stopImpl()
      this.active = false
      return { blob: new Blob(['voice'], { type: 'audio/webm' }), mimeType: 'audio/webm', startedAt: 10, stoppedAt: 210, durationMs: 200 }
    }
    async cancel() { this.cancelCalls += 1; this.active = false }
    fail(error) { for (const listener of this.listeners) listener(error) }
  }

  // Happy path: capture -> transcription -> editable handoff.
  {
    const capture = new FakeCapture()
    const transcribeCalls = []
    const transcripts = []
    const states = []
    const orchestrator = new DefaultVoiceOrchestrator({
      capture,
      transcribe: async (input, signal) => {
        transcribeCalls.push({ input, signal })
        return { text: '你好 LCOS', language: 'zh', providerId: 'test-stt', segments: [{ startMs: 0, endMs: 200, text: '你好 LCOS' }] }
      },
    })
    orchestrator.subscribe((snapshot) => states.push(snapshot.state))
    orchestrator.onTranscript((value) => transcripts.push(value.text))

    await orchestrator.start()
    assert.equal(orchestrator.snapshot.state, 'recording')
    const transcript = await orchestrator.stop({ language: 'zh-CN', prompt: 'existing prompt', timestamps: true, providerId: 'test-stt' })
    assert.equal(orchestrator.snapshot.state, 'editable')
    assert.equal(transcript.text, '你好 LCOS')
    assert.deepEqual(transcripts, ['你好 LCOS'])
    assert.equal(transcribeCalls.length, 1)
    assert.equal(transcribeCalls[0].input.durationMs, 200)
    assert.equal(transcribeCalls[0].input.language, 'zh-CN')
    assert.equal(transcribeCalls[0].input.prompt, 'existing prompt')
    assert.equal(transcribeCalls[0].input.timestamps, true)
    assert.equal(transcribeCalls[0].input.providerId, 'test-stt')
    assert.equal(transcribeCalls[0].input.audio.type, 'audio/webm')
    assert.ok(states.includes('requestingPermission'))
    assert.ok(states.includes('recording'))
    assert.ok(states.includes('transcribing'))
    assert.ok(states.includes('editable'))
    await orchestrator.dispose()
  }

  // Recording cancel discards capture and never transcribes.
  {
    const capture = new FakeCapture()
    let transcribeCount = 0
    const orchestrator = new DefaultVoiceOrchestrator({ capture, transcribe: async () => { transcribeCount += 1; return { text: 'no', providerId: 'x' } } })
    await orchestrator.start()
    await orchestrator.cancel()
    assert.equal(orchestrator.snapshot.state, 'idle')
    assert.equal(capture.cancelCalls, 1)
    assert.equal(transcribeCount, 0)
    await orchestrator.dispose()
  }

  // Cancellation while permission is pending cleans up a late capture grant.
  {
    const capture = new FakeCapture()
    const gate = deferred()
    capture.startImpl = () => gate.promise
    const orchestrator = new DefaultVoiceOrchestrator({ capture, transcribe: async () => ({ text: 'no', providerId: 'x' }) })
    const pendingStart = orchestrator.start()
    assert.equal(orchestrator.snapshot.state, 'requestingPermission')
    await orchestrator.cancel()
    gate.resolve()
    await pendingStart
    assert.equal(orchestrator.snapshot.state, 'idle')
    assert.ok(capture.cancelCalls >= 1)
    await orchestrator.dispose()
  }

  // Permission and capture failures map into lifecycle and retry can start a new session.
  {
    const permissionCapture = new FakeCapture()
    permissionCapture.startImpl = async () => { throw new VoiceCaptureError('permission-denied', 'denied') }
    const permissionOrchestrator = new DefaultVoiceOrchestrator({ capture: permissionCapture, transcribe: async () => ({ text: '', providerId: 'x' }) })
    await assert.rejects(() => permissionOrchestrator.start(), (error) => error instanceof VoiceOrchestrationError && error.code === 'permission-denied')
    assert.equal(permissionOrchestrator.snapshot.state, 'permissionDenied')
    await permissionOrchestrator.dispose()

    const capture = new FakeCapture()
    let failOnce = true
    capture.startImpl = async () => {
      if (failOnce) { failOnce = false; throw new VoiceCaptureError('device-unavailable', 'busy') }
    }
    const orchestrator = new DefaultVoiceOrchestrator({ capture, transcribe: async () => ({ text: '', providerId: 'x' }) })
    await assert.rejects(() => orchestrator.start(), (error) => error instanceof VoiceOrchestrationError && error.code === 'capture-failed')
    assert.equal(orchestrator.snapshot.state, 'captureError')
    await orchestrator.retry()
    assert.equal(orchestrator.snapshot.state, 'recording')
    await orchestrator.cancel()
    await orchestrator.dispose()
  }

  // Transcription error retains captured audio and retry transcribes the same capture.
  {
    const capture = new FakeCapture()
    let attempts = 0
    const orchestrator = new DefaultVoiceOrchestrator({
      capture,
      transcribe: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('stt unavailable')
        return { text: 'retry ok', providerId: 'test-stt' }
      },
    })
    await orchestrator.start()
    await assert.rejects(() => orchestrator.stop({ language: 'en' }), (error) => error instanceof VoiceOrchestrationError && error.code === 'transcription-failed')
    assert.equal(orchestrator.snapshot.state, 'transcriptionError')
    const retried = await orchestrator.retry()
    assert.equal(retried.text, 'retry ok')
    assert.equal(orchestrator.snapshot.state, 'editable')
    assert.equal(capture.stopCalls, 1)
    assert.equal(attempts, 2)
    await orchestrator.dispose()
  }

  // Cancel during transcription aborts transport and returns to idle without transcript handoff.
  {
    const capture = new FakeCapture()
    let observedSignal
    const started = deferred()
    const orchestrator = new DefaultVoiceOrchestrator({
      capture,
      transcribe: (_input, signal) => new Promise((resolve, reject) => {
        observedSignal = signal
        started.resolve()
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }),
    })
    await orchestrator.start()
    const pendingStop = orchestrator.stop()
    await started.promise
    assert.equal(orchestrator.snapshot.state, 'transcribing')
    await orchestrator.cancel()
    await assert.rejects(() => pendingStop, (error) => error instanceof VoiceOrchestrationError && error.code === 'invalid-state')
    assert.equal(observedSignal.aborted, true)
    assert.equal(orchestrator.snapshot.state, 'idle')
    assert.equal(orchestrator.snapshot.transcript, null)
    await orchestrator.dispose()
  }


  // Local Core adapter unwraps runtime calls without making Runtime Agent provider the Voice owner.
  {
    const port = createLocalCoreVoiceTranscribePort({
      transcribeVoice: async () => ({ result: { ok: true, value: { text: 'port ok', providerId: 'whisper.cpp-cli' } }, origin: 'runtime', latencyMs: 1, requestedAt: 'now' }),
    })
    assert.equal((await port({ audio: new Blob(['x'], { type: 'audio/webm' }) })).text, 'port ok')
    const failing = createLocalCoreVoiceTranscribePort({
      transcribeVoice: async () => ({ result: { ok: false, error: { code: 'UNAVAILABLE', message: 'no stt', retryable: true, origin: 'runtime' } }, origin: 'runtime', latencyMs: 1, requestedAt: 'now' }),
    })
    await assert.rejects(() => failing({ audio: new Blob(['x'], { type: 'audio/webm' }) }), (error) => error instanceof VoiceOrchestrationError && error.code === 'transcription-failed')
  }

  process.stdout.write('A24-6 voice orchestration runtime smoke: PASS\n')
} finally {
  await rm(temp, { recursive: true, force: true })
}

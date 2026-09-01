import assert from 'node:assert/strict'

const {
  NativeVoiceCaptureAdapter,
  VoiceCaptureError,
  chooseVoiceCaptureMimeType,
  classifyVoiceCaptureError,
} = await import('../apps/web/src/features/execution/voiceCapture.ts')

class FakeTrack {
  stopped = false
  stop() { this.stopped = true }
}

class FakeStream {
  track = new FakeTrack()
  getTracks() { return [this.track] }
}

class FakeRecorder {
  state = 'inactive'
  mimeType
  ondataavailable = null
  onstop = null
  onerror = null
  startCount = 0
  stopCount = 0

  constructor(mimeType = 'audio/webm;codecs=opus') {
    this.mimeType = mimeType
  }

  start() {
    this.startCount += 1
    this.state = 'recording'
  }

  stop() {
    this.stopCount += 1
    this.state = 'inactive'
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['voice-bytes'], { type: this.mimeType }) })
      this.onstop?.(new Event('stop'))
    })
  }
}

let now = 100
const stream = new FakeStream()
const recorder = new FakeRecorder()
let constraints = null
const environment = {
  getUserMedia: async (value) => { constraints = value; return stream },
  createMediaRecorder: (_stream, options) => {
    assert.equal(_stream, stream)
    assert.deepEqual(options, { mimeType: 'audio/webm;codecs=opus' })
    return recorder
  },
  isTypeSupported: (mime) => mime === 'audio/webm;codecs=opus',
  now: () => now,
}

assert.equal(chooseVoiceCaptureMimeType(environment.isTypeSupported), 'audio/webm;codecs=opus')
assert.equal(chooseVoiceCaptureMimeType(() => false), undefined)
assert.equal(classifyVoiceCaptureError({ name: 'NotAllowedError' }).code, 'permission-denied')
assert.equal(classifyVoiceCaptureError({ name: 'NotFoundError' }).code, 'device-not-found')
assert.equal(classifyVoiceCaptureError({ name: 'NotReadableError' }).code, 'device-unavailable')

const adapter = new NativeVoiceCaptureAdapter(environment)
assert.equal(adapter.active, false)
await adapter.start()
assert.equal(adapter.active, true)
assert.deepEqual(constraints, { audio: true, video: false })
assert.equal(recorder.startCount, 1)

await assert.rejects(() => adapter.start(), (error) => error instanceof VoiceCaptureError && error.code === 'invalid-state')
now = 475
const result = await adapter.stop()
assert.equal(adapter.active, false)
assert.equal(recorder.stopCount, 1)
assert.equal(result.mimeType, 'audio/webm;codecs=opus')
assert.equal(result.durationMs, 375)
assert.equal(await result.blob.text(), 'voice-bytes')
assert.equal(stream.track.stopped, true)

const cancelStream = new FakeStream()
const cancelRecorder = new FakeRecorder('audio/webm')
const cancelAdapter = new NativeVoiceCaptureAdapter({
  ...environment,
  getUserMedia: async () => cancelStream,
  createMediaRecorder: () => cancelRecorder,
  isTypeSupported: (mime) => mime === 'audio/webm',
})
await cancelAdapter.start()
await cancelAdapter.cancel()
assert.equal(cancelAdapter.active, false)
assert.equal(cancelRecorder.stopCount, 1)
assert.equal(cancelStream.track.stopped, true)


const errorStream = new FakeStream()
const errorRecorder = new FakeRecorder()
const errorAdapter = new NativeVoiceCaptureAdapter({
  ...environment,
  getUserMedia: async () => errorStream,
  createMediaRecorder: () => errorRecorder,
})
let asyncError = null
const unsubscribe = errorAdapter.onError((error) => { asyncError = error })
await errorAdapter.start()
errorRecorder.onerror?.(new Event('error'))
await new Promise((resolve) => queueMicrotask(resolve))
assert.equal(asyncError?.code, 'recorder-failed')
assert.equal(errorAdapter.active, false)
assert.equal(errorStream.track.stopped, true)
unsubscribe()

const deniedAdapter = new NativeVoiceCaptureAdapter({
  ...environment,
  getUserMedia: async () => { throw { name: 'NotAllowedError', message: 'denied' } },
})
await assert.rejects(() => deniedAdapter.start(), (error) => error instanceof VoiceCaptureError && error.code === 'permission-denied')

const failedConstructionStream = new FakeStream()
const failedConstructionAdapter = new NativeVoiceCaptureAdapter({
  ...environment,
  getUserMedia: async () => failedConstructionStream,
  createMediaRecorder: () => { throw new Error('recorder boom') },
})
await assert.rejects(() => failedConstructionAdapter.start(), (error) => error instanceof VoiceCaptureError && error.code === 'capture-failed')
assert.equal(failedConstructionStream.track.stopped, true)

const idleAdapter = new NativeVoiceCaptureAdapter(environment)
await idleAdapter.cancel()
await assert.rejects(() => idleAdapter.stop(), (error) => error instanceof VoiceCaptureError && error.code === 'invalid-state')

console.log('A24-2 Native Capture Adapter runtime smoke: PASS')

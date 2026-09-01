/**
 * A24-2 native microphone capture adapter.
 *
 * This module owns browser capture mechanics only. It deliberately does not
 * know about XState, transcription, Composer prompt text, waveform UI, or
 * execution. Higher layers map its typed results/errors into the Voice
 * lifecycle.
 */

export type VoiceCaptureErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'device-not-found'
  | 'device-unavailable'
  | 'aborted'
  | 'invalid-state'
  | 'recorder-failed'
  | 'capture-failed'

export class VoiceCaptureError extends Error {
  readonly code: VoiceCaptureErrorCode
  override readonly cause?: unknown

  constructor(code: VoiceCaptureErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'VoiceCaptureError'
    this.code = code
    this.cause = cause
  }
}

export interface VoiceCaptureResult {
  readonly blob: Blob
  readonly mimeType: string
  readonly startedAt: number
  readonly stoppedAt: number
  readonly durationMs: number
}

export interface VoiceCaptureEnvironment {
  readonly getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  readonly createMediaRecorder: (stream: MediaStream, options?: MediaRecorderOptions) => MediaRecorder
  readonly isTypeSupported: (mimeType: string) => boolean
  readonly now: () => number
}

interface ActiveCaptureSession {
  readonly stream: MediaStream
  readonly recorder: MediaRecorder
  readonly startedAt: number
  readonly chunks: Blob[]
  readonly completion: Promise<void>
  readonly resolveCompletion: () => void
  readonly rejectCompletion: (error: VoiceCaptureError) => void
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const

export function chooseVoiceCaptureMimeType(isTypeSupported: (mimeType: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((mimeType) => {
    try {
      return isTypeSupported(mimeType)
    } catch {
      return false
    }
  })
}

export function classifyVoiceCaptureError(error: unknown): VoiceCaptureError {
  if (error instanceof VoiceCaptureError) return error
  const name = typeof DOMException !== 'undefined' && error instanceof DOMException
    ? error.name
    : typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { readonly name?: unknown }).name ?? '')
      : ''
  const message = error instanceof Error ? error.message : 'Microphone capture failed.'

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new VoiceCaptureError('permission-denied', message, error)
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new VoiceCaptureError('device-not-found', message, error)
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return new VoiceCaptureError('device-unavailable', message, error)
  }
  if (name === 'AbortError') {
    return new VoiceCaptureError('aborted', message, error)
  }
  if (name === 'NotSupportedError') {
    return new VoiceCaptureError('unsupported', message, error)
  }
  return new VoiceCaptureError('capture-failed', message, error)
}

export function createBrowserVoiceCaptureEnvironment(): VoiceCaptureEnvironment {
  const mediaDevices = globalThis.navigator?.mediaDevices
  const Recorder = globalThis.MediaRecorder
  if (!mediaDevices?.getUserMedia || typeof Recorder !== 'function') {
    throw new VoiceCaptureError('unsupported', 'Microphone recording is not supported in this environment.')
  }
  return {
    getUserMedia: (constraints) => mediaDevices.getUserMedia(constraints),
    createMediaRecorder: (stream, options) => options ? new Recorder(stream, options) : new Recorder(stream),
    isTypeSupported: (mimeType) => typeof Recorder.isTypeSupported === 'function' && Recorder.isTypeSupported(mimeType),
    now: () => performance.now(),
  }
}

export type VoiceCaptureErrorListener = (error: VoiceCaptureError) => void

export interface VoiceCaptureAdapter {
  readonly active: boolean
  start(): Promise<void>
  stop(): Promise<VoiceCaptureResult>
  cancel(): Promise<void>
  onError(listener: VoiceCaptureErrorListener): () => void
}

export class NativeVoiceCaptureAdapter implements VoiceCaptureAdapter {
  private session: ActiveCaptureSession | null = null
  private readonly environment: VoiceCaptureEnvironment
  private readonly errorListeners = new Set<VoiceCaptureErrorListener>()

  constructor(environment: VoiceCaptureEnvironment = createBrowserVoiceCaptureEnvironment()) {
    this.environment = environment
  }

  get active(): boolean {
    return this.session !== null
  }

  onError(listener: VoiceCaptureErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => this.errorListeners.delete(listener)
  }

  async start(): Promise<void> {
    if (this.session !== null) {
      throw new VoiceCaptureError('invalid-state', 'A microphone capture session is already active.')
    }

    let stream: MediaStream | null = null
    let session: ActiveCaptureSession | null = null
    try {
      stream = await this.environment.getUserMedia({ audio: true, video: false })
      const mimeType = chooseVoiceCaptureMimeType(this.environment.isTypeSupported)
      const recorder = this.environment.createMediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      let resolveCompletion!: () => void
      let rejectCompletion!: (error: VoiceCaptureError) => void
      const completion = new Promise<void>((resolve, reject) => {
        resolveCompletion = resolve
        rejectCompletion = reject
      })
      session = {
        stream,
        recorder,
        startedAt: this.environment.now(),
        chunks,
        completion,
        resolveCompletion,
        rejectCompletion,
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => resolveCompletion()
      recorder.onerror = () => {
        const error = new VoiceCaptureError('recorder-failed', 'MediaRecorder reported a capture error.')
        rejectCompletion(error)
        this.emitError(error)
        this.cleanup(session!)
      }
      void completion.catch(() => undefined)

      this.session = session
      recorder.start()
    } catch (error) {
      if (session !== null) this.cleanup(session)
      else if (stream !== null) stopTracks(stream)
      this.session = null
      throw classifyVoiceCaptureError(error)
    }
  }

  async stop(): Promise<VoiceCaptureResult> {
    const session = this.requireSession()
    try {
      if (session.recorder.state !== 'inactive') session.recorder.stop()
      await session.completion
      const stoppedAt = this.environment.now()
      const mimeType = session.recorder.mimeType || session.chunks[0]?.type || 'application/octet-stream'
      return {
        blob: new Blob(session.chunks, { type: mimeType }),
        mimeType,
        startedAt: session.startedAt,
        stoppedAt,
        durationMs: Math.max(0, stoppedAt - session.startedAt),
      }
    } catch (error) {
      throw classifyVoiceCaptureError(error)
    } finally {
      this.cleanup(session)
    }
  }

  async cancel(): Promise<void> {
    const session = this.session
    if (session === null) return
    try {
      if (session.recorder.state !== 'inactive') {
        session.recorder.stop()
        await session.completion.catch(() => undefined)
      }
    } finally {
      session.chunks.length = 0
      this.cleanup(session)
    }
  }

  private requireSession(): ActiveCaptureSession {
    if (this.session === null) {
      throw new VoiceCaptureError('invalid-state', 'No microphone capture session is active.')
    }
    return this.session
  }

  private emitError(error: VoiceCaptureError): void {
    for (const listener of this.errorListeners) {
      try { listener(error) } catch { /* observer failure must not break capture cleanup */ }
    }
  }

  private cleanup(session: ActiveCaptureSession): void {
    session.recorder.ondataavailable = null
    session.recorder.onstop = null
    session.recorder.onerror = null
    stopTracks(session.stream)
    if (this.session === session) this.session = null
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // Track cleanup is best-effort and must not mask the capture result/error.
    }
  }
}

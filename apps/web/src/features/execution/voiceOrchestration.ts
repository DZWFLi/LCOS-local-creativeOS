import type { VoiceTranscriptionResponseV1 } from '@local-creative-os/contracts'
import { createActor } from '../../vendor/xstate-5.32.6/src/index.ts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import type { VoiceTranscriptionUploadInput } from './voiceTranscriptionTransport'
import { NativeVoiceCaptureAdapter, VoiceCaptureError, type VoiceCaptureAdapter, type VoiceCaptureResult } from './voiceCapture'
import { voiceLifecycleMachine, type VoiceLifecycleState } from './voiceLifecycle'

export type VoiceOrchestrationErrorCode =
  | 'invalid-state'
  | 'permission-denied'
  | 'capture-failed'
  | 'transcription-failed'

export class VoiceOrchestrationError extends Error {
  readonly code: VoiceOrchestrationErrorCode
  override readonly cause?: unknown

  constructor(code: VoiceOrchestrationErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'VoiceOrchestrationError'
    this.code = code
    this.cause = cause
  }
}

export interface VoiceTranscriptionHints {
  readonly language?: string
  readonly prompt?: string
  readonly timestamps?: boolean
  readonly providerId?: string
}

export interface VoiceOrchestrationSnapshot {
  readonly state: VoiceLifecycleState
  readonly transcript: VoiceTranscriptionResponseV1 | null
  readonly error: VoiceOrchestrationError | null
}

export type VoiceTranscribePort = (
  input: VoiceTranscriptionUploadInput,
  signal?: AbortSignal,
) => Promise<VoiceTranscriptionResponseV1>

export type VoiceOrchestrationListener = (snapshot: VoiceOrchestrationSnapshot) => void
export type VoiceTranscriptListener = (transcript: VoiceTranscriptionResponseV1) => void

export interface VoiceOrchestrator {
  readonly snapshot: VoiceOrchestrationSnapshot
  subscribe(listener: VoiceOrchestrationListener): () => void
  onTranscript(listener: VoiceTranscriptListener): () => void
  start(): Promise<void>
  stop(hints?: VoiceTranscriptionHints): Promise<VoiceTranscriptionResponseV1>
  cancel(): Promise<void>
  retry(): Promise<void | VoiceTranscriptionResponseV1>
  reset(): Promise<void>
  dispose(): Promise<void>
}

export function createLocalCoreVoiceTranscribePort(client: Pick<LocalCoreClient, 'transcribeVoice'>): VoiceTranscribePort {
  return async (input, signal) => {
    const call = await client.transcribeVoice(input, signal)
    if (call.result.ok) return call.result.value
    throw new VoiceOrchestrationError('transcription-failed', call.result.error.message, call.result.error)
  }
}

export class DefaultVoiceOrchestrator implements VoiceOrchestrator {
  private readonly actor = createActor(voiceLifecycleMachine)
  private readonly capture: VoiceCaptureAdapter
  private readonly transcribe: VoiceTranscribePort
  private readonly listeners = new Set<VoiceOrchestrationListener>()
  private readonly transcriptListeners = new Set<VoiceTranscriptListener>()
  private readonly unsubscribeCaptureError: () => void
  private operationVersion = 0
  private transcriptionAbort: AbortController | null = null
  private lastCapture: VoiceCaptureResult | null = null
  private lastHints: VoiceTranscriptionHints = {}
  private transcript: VoiceTranscriptionResponseV1 | null = null
  private error: VoiceOrchestrationError | null = null
  private disposed = false

  constructor(options: {
    readonly transcribe: VoiceTranscribePort
    readonly capture?: VoiceCaptureAdapter
  }) {
    this.transcribe = options.transcribe
    this.capture = options.capture ?? new NativeVoiceCaptureAdapter()
    this.actor.start()
    this.actor.subscribe(() => this.emit())
    this.unsubscribeCaptureError = this.capture.onError((error) => this.handleAsyncCaptureError(error))
  }

  get snapshot(): VoiceOrchestrationSnapshot {
    return {
      state: this.actor.getSnapshot().value as VoiceLifecycleState,
      transcript: this.transcript,
      error: this.error,
    }
  }

  subscribe(listener: VoiceOrchestrationListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  onTranscript(listener: VoiceTranscriptListener): () => void {
    this.transcriptListeners.add(listener)
    return () => this.transcriptListeners.delete(listener)
  }

  async start(): Promise<void> {
    this.assertUsable()
    const state = this.snapshot.state
    if (state !== 'idle' && state !== 'editable') {
      throw new VoiceOrchestrationError('invalid-state', `Cannot start voice capture from ${state}.`)
    }

    const version = ++this.operationVersion
    this.abortTranscription()
    this.lastCapture = null
    this.transcript = null
    this.error = null
    this.actor.send({ type: 'START_RECORDING' })

    try {
      await this.capture.start()
      if (!this.isCurrent(version)) {
        await this.capture.cancel()
        return
      }
      this.actor.send({ type: 'PERMISSION_GRANTED' })
    } catch (error) {
      if (!this.isCurrent(version)) return
      const orchestrationError = captureToOrchestrationError(error)
      this.error = orchestrationError
      this.actor.send({ type: orchestrationError.code === 'permission-denied' ? 'PERMISSION_DENIED' : 'CAPTURE_FAILED' })
      this.emit()
      throw orchestrationError
    }
  }

  async stop(hints: VoiceTranscriptionHints = {}): Promise<VoiceTranscriptionResponseV1> {
    this.assertUsable()
    if (this.snapshot.state !== 'recording') {
      throw new VoiceOrchestrationError('invalid-state', `Cannot stop voice capture from ${this.snapshot.state}.`)
    }

    const version = ++this.operationVersion
    this.error = null
    let capture: VoiceCaptureResult
    try {
      capture = await this.capture.stop()
    } catch (error) {
      if (!this.isCurrent(version)) throw abortedByCancellation(error)
      const orchestrationError = captureToOrchestrationError(error)
      this.error = orchestrationError
      this.actor.send({ type: 'CAPTURE_FAILED' })
      this.emit()
      throw orchestrationError
    }

    if (!this.isCurrent(version)) throw abortedByCancellation()
    this.lastCapture = capture
    this.lastHints = { ...hints }
    this.actor.send({ type: 'STOP_RECORDING' })
    return this.transcribeCapture(version, capture, hints)
  }

  async cancel(): Promise<void> {
    if (this.disposed) return
    ++this.operationVersion
    this.abortTranscription()
    this.error = null
    this.lastCapture = null
    this.lastHints = {}
    this.transcript = null

    const state = this.snapshot.state
    if (state === 'requestingPermission' || state === 'recording') {
      await this.capture.cancel().catch(() => undefined)
    }
    if (state === 'requestingPermission' || state === 'recording' || state === 'transcribing') {
      this.actor.send({ type: 'CANCEL' })
    } else if (state !== 'idle') {
      this.actor.send({ type: 'RESET' })
    }
    this.emit()
  }

  async retry(): Promise<void | VoiceTranscriptionResponseV1> {
    this.assertUsable()
    const state = this.snapshot.state
    this.error = null

    if (state === 'permissionDenied' || state === 'captureError') {
      this.actor.send({ type: 'RETRY' })
      const version = ++this.operationVersion
      try {
        await this.capture.start()
        if (!this.isCurrent(version)) {
          await this.capture.cancel()
          return
        }
        this.actor.send({ type: 'PERMISSION_GRANTED' })
        return
      } catch (error) {
        if (!this.isCurrent(version)) return
        const orchestrationError = captureToOrchestrationError(error)
        this.error = orchestrationError
        this.actor.send({ type: orchestrationError.code === 'permission-denied' ? 'PERMISSION_DENIED' : 'CAPTURE_FAILED' })
        this.emit()
        throw orchestrationError
      }
    }

    if (state === 'transcriptionError' && this.lastCapture !== null) {
      this.actor.send({ type: 'RETRY' })
      const version = ++this.operationVersion
      return this.transcribeCapture(version, this.lastCapture, this.lastHints)
    }

    throw new VoiceOrchestrationError('invalid-state', `Cannot retry voice input from ${state}.`)
  }

  async reset(): Promise<void> {
    this.assertUsable()
    await this.cancel()
    this.transcript = null
    this.error = null
    if (this.snapshot.state !== 'idle') this.actor.send({ type: 'RESET' })
    this.emit()
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    ++this.operationVersion
    this.abortTranscription()
    await this.capture.cancel().catch(() => undefined)
    this.unsubscribeCaptureError()
    this.listeners.clear()
    this.transcriptListeners.clear()
    this.actor.stop()
  }

  private async transcribeCapture(
    version: number,
    capture: VoiceCaptureResult,
    hints: VoiceTranscriptionHints,
  ): Promise<VoiceTranscriptionResponseV1> {
    const abort = new AbortController()
    this.transcriptionAbort = abort
    try {
      const transcript = await this.transcribe({
        audio: capture.blob,
        durationMs: capture.durationMs,
        ...(hints.language?.trim() ? { language: hints.language.trim() } : {}),
        ...(hints.prompt?.trim() ? { prompt: hints.prompt } : {}),
        ...(hints.timestamps !== undefined ? { timestamps: hints.timestamps } : {}),
        ...(hints.providerId?.trim() ? { providerId: hints.providerId.trim() } : {}),
      }, abort.signal)
      if (!this.isCurrent(version)) throw abortedByCancellation()
      this.transcript = transcript
      this.error = null
      this.actor.send({ type: 'TRANSCRIPTION_SUCCEEDED' })
      for (const listener of this.transcriptListeners) {
        try { listener(transcript) } catch { /* transcript observers cannot change Voice truth */ }
      }
      this.emit()
      return transcript
    } catch (error) {
      if (!this.isCurrent(version) || abort.signal.aborted) throw abortedByCancellation(error)
      const orchestrationError = error instanceof VoiceOrchestrationError
        ? error
        : new VoiceOrchestrationError('transcription-failed', error instanceof Error ? error.message : 'Voice transcription failed.', error)
      this.error = orchestrationError
      this.actor.send({ type: 'TRANSCRIPTION_FAILED' })
      this.emit()
      throw orchestrationError
    } finally {
      if (this.transcriptionAbort === abort) this.transcriptionAbort = null
    }
  }

  private handleAsyncCaptureError(error: VoiceCaptureError): void {
    if (this.disposed) return
    const state = this.snapshot.state
    if (state !== 'requestingPermission' && state !== 'recording') return
    const orchestrationError = captureToOrchestrationError(error)
    this.error = orchestrationError
    this.actor.send({ type: orchestrationError.code === 'permission-denied' ? 'PERMISSION_DENIED' : 'CAPTURE_FAILED' })
    this.emit()
  }

  private abortTranscription(): void {
    this.transcriptionAbort?.abort()
    this.transcriptionAbort = null
  }

  private isCurrent(version: number): boolean {
    return !this.disposed && version === this.operationVersion
  }

  private assertUsable(): void {
    if (this.disposed) throw new VoiceOrchestrationError('invalid-state', 'Voice orchestrator has been disposed.')
  }

  private emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.listeners) {
      try { listener(snapshot) } catch { /* presentation observers cannot break orchestration */ }
    }
  }
}

function captureToOrchestrationError(error: unknown): VoiceOrchestrationError {
  if (error instanceof VoiceOrchestrationError) return error
  if (error instanceof VoiceCaptureError) {
    return new VoiceOrchestrationError(
      error.code === 'permission-denied' ? 'permission-denied' : 'capture-failed',
      error.message,
      error,
    )
  }
  return new VoiceOrchestrationError('capture-failed', error instanceof Error ? error.message : 'Voice capture failed.', error)
}

function abortedByCancellation(cause?: unknown): VoiceOrchestrationError {
  return new VoiceOrchestrationError('invalid-state', 'Voice operation was cancelled.', cause)
}

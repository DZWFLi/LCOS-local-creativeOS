import { setup } from '../../vendor/xstate-5.32.6/src/index.ts'

/**
 * A24 Voice owns input lifecycle only.
 *
 * Execution remains the Unified Composer's explicit Send / Run truth. This
 * machine deliberately has no SEND/RUN event and cannot execute a task.
 */
export type VoiceLifecycleState =
  | 'idle'
  | 'requestingPermission'
  | 'recording'
  | 'transcribing'
  | 'editable'
  | 'permissionDenied'
  | 'captureError'
  | 'transcriptionError'

export type VoiceLifecycleEvent =
  | { readonly type: 'START_RECORDING' }
  | { readonly type: 'PERMISSION_GRANTED' }
  | { readonly type: 'PERMISSION_DENIED' }
  | { readonly type: 'CAPTURE_FAILED' }
  | { readonly type: 'STOP_RECORDING' }
  | { readonly type: 'TRANSCRIPTION_SUCCEEDED' }
  | { readonly type: 'TRANSCRIPTION_FAILED' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'RETRY' }
  | { readonly type: 'RESET' }

export const voiceLifecycleMachine = setup({
  types: {
    events: {} as VoiceLifecycleEvent,
  },
}).createMachine({
  id: 'voiceLifecycle',
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_RECORDING: 'requestingPermission',
      },
    },
    requestingPermission: {
      on: {
        PERMISSION_GRANTED: 'recording',
        PERMISSION_DENIED: 'permissionDenied',
        CAPTURE_FAILED: 'captureError',
        CANCEL: 'idle',
      },
    },
    recording: {
      on: {
        STOP_RECORDING: 'transcribing',
        CAPTURE_FAILED: 'captureError',
        CANCEL: 'idle',
      },
    },
    transcribing: {
      on: {
        TRANSCRIPTION_SUCCEEDED: 'editable',
        TRANSCRIPTION_FAILED: 'transcriptionError',
        CANCEL: 'idle',
      },
    },
    editable: {
      on: {
        START_RECORDING: 'requestingPermission',
        RESET: 'idle',
      },
    },
    permissionDenied: {
      on: {
        RETRY: 'requestingPermission',
        RESET: 'idle',
      },
    },
    captureError: {
      on: {
        RETRY: 'requestingPermission',
        RESET: 'idle',
      },
    },
    transcriptionError: {
      on: {
        RETRY: 'transcribing',
        RESET: 'idle',
      },
    },
  },
})

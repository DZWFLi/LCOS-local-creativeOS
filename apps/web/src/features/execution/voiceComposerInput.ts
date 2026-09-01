import type { VoiceOrchestrationSnapshot } from './voiceOrchestration'

/** A24-7 presentation-only helpers. They never own capture, STT, or execution. */
export function appendVoiceTranscript(prompt: string, transcript: string): string {
  const cleanTranscript = transcript.trim()
  if (!cleanTranscript) return prompt
  if (!prompt.trim()) return cleanTranscript
  return `${prompt}${/\s$/.test(prompt) ? '' : ' '}${cleanTranscript}`
}

export function voiceModeActive(state: VoiceOrchestrationSnapshot['state']): boolean {
  return state !== 'idle' && state !== 'editable'
}

export function voiceErrorState(state: VoiceOrchestrationSnapshot['state']): boolean {
  return state === 'permissionDenied' || state === 'captureError' || state === 'transcriptionError'
}

export function voiceErrorLabel(snapshot: VoiceOrchestrationSnapshot): string {
  if (snapshot.state === 'permissionDenied') return '无法使用麦克风'
  if (snapshot.state === 'captureError') return '录音没有开始'
  if (snapshot.state === 'transcriptionError') return '转写失败'
  return snapshot.error?.message ?? '语音输入暂不可用'
}

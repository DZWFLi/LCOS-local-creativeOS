/** A24-4 browser-side multipart transport builder. No lifecycle or Composer ownership. */
export interface VoiceTranscriptionUploadInput {
  readonly audio: Blob
  readonly durationMs?: number
  readonly language?: string
  readonly prompt?: string
  readonly timestamps?: boolean
  readonly providerId?: string
}

export function buildVoiceTranscriptionFormData(input: VoiceTranscriptionUploadInput): FormData {
  const form = new FormData()
  form.append('file', input.audio, 'voice-input')
  if (input.durationMs !== undefined) form.append('durationMs', String(input.durationMs))
  if (input.language?.trim()) form.append('language', input.language.trim())
  if (input.prompt?.trim()) form.append('prompt', input.prompt)
  if (input.timestamps !== undefined) form.append('timestamps', input.timestamps ? 'true' : 'false')
  if (input.providerId?.trim()) form.append('providerId', input.providerId.trim())
  return form
}

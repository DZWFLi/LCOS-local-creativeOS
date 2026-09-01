import { appendVoiceTranscript, voiceErrorLabel, voiceErrorState, voiceModeActive } from '../apps/web/src/features/execution/voiceComposerInput.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(appendVoiceTranscript('', '  你好世界  ') === '你好世界', 'empty prompt should become trimmed transcript')
assert(appendVoiceTranscript('请总结', '这一段') === '请总结 这一段', 'existing prompt should append transcript with one separator')
assert(appendVoiceTranscript('请总结\n', '这一段') === '请总结\n这一段', 'existing trailing whitespace should be preserved without duplicate separator')
assert(appendVoiceTranscript('保持原文', '   ') === '保持原文', 'empty transcript must not mutate prompt')
assert(voiceModeActive('recording') && voiceModeActive('transcribing') && !voiceModeActive('editable') && !voiceModeActive('idle'), 'only transient/error Voice states replace normal input')
assert(voiceErrorState('permissionDenied') && voiceErrorState('captureError') && voiceErrorState('transcriptionError') && !voiceErrorState('recording'), 'error-state classifier mismatch')
assert(voiceErrorLabel({ state: 'permissionDenied', transcript: null, error: null }) === '无法使用麦克风', 'permission copy mismatch')
assert(voiceErrorLabel({ state: 'captureError', transcript: null, error: null }) === '录音没有开始', 'capture copy mismatch')
assert(voiceErrorLabel({ state: 'transcriptionError', transcript: null, error: null }) === '转写失败', 'transcription copy mismatch')

console.log('A24-7 Composer Voice GUI presentation smoke: PASS')

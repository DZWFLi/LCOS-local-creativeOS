import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'

const root = process.cwd()
const temp = await mkdtemp(join(tmpdir(), 'lcos-a24-5-smoke-'))

async function transpile(sourcePath, outName, replacements = []) {
  let source = await readFile(join(root, sourcePath), 'utf8')
  let js = stripTypeScriptTypes(source, { mode: 'transform' })
  for (const [from, to] of replacements) js = js.replaceAll(from, to)
  const out = join(temp, outName)
  await writeFile(out, js)
  return out
}

async function executable(name, body) {
  const file = join(temp, name)
  await writeFile(file, body)
  await chmod(file, 0o755)
  return file
}

try {
  const servicePath = await transpile('apps/local-core/src/voice-transcription-service.ts', 'voice-transcription-service.mjs')
  const providerPath = await transpile('apps/local-core/src/voice-transcription-whisper-cpp-provider.ts', 'whisper-cpp-provider.mjs', [
    ["./voice-transcription-service.js", './voice-transcription-service.mjs'],
  ])
  const defaultsPath = await transpile('apps/local-core/src/voice-transcription-defaults.ts', 'voice-transcription-defaults.mjs', [
    ["./voice-transcription-whisper-cpp-provider.js", './whisper-cpp-provider.mjs'],
    ["./voice-transcription-service.js", './voice-transcription-service.mjs'],
  ])

  const { VoiceTranscriptionProviderRegistry, VoiceTranscriptionService, VoiceTranscriptionError } = await import(pathToFileURL(servicePath).href)
  const { WhisperCppCliTranscriptionProvider, createWhisperCppProviderFromEnvironment } = await import(pathToFileURL(providerPath).href)
  const { createDefaultVoiceTranscriptionService } = await import(pathToFileURL(defaultsPath).href)

  const modelPath = join(temp, 'ggml-base.bin')
  await writeFile(modelPath, new Uint8Array([1, 2, 3]))

  const ffmpegArgsPath = join(temp, 'ffmpeg.args')
  const whisperArgsPath = join(temp, 'whisper.args')
  const ffmpegPath = await executable('fake-ffmpeg.sh', `#!/bin/sh\nprintf '%s\\n' "$@" > "${ffmpegArgsPath}"\nlast=''\nfor arg in "$@"; do last="$arg"; done\nprintf 'RIFFfakewav' > "$last"\n`)
  const whisperPath = await executable('fake-whisper.sh', `#!/bin/sh\nprintf '%s\\n' "$@" > "${whisperArgsPath}"\nout=''\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = '-of' ]; then shift; out="$1"; fi\n  shift\ndone\ncat > "${'${out}'}.json" <<'JSON'\n{\n  "result": {"language": "zh"},\n  "transcription": [\n    {"offsets": {"from": 0, "to": 420}, "text": " 你好"},\n    {"offsets": {"from": 420, "to": 900}, "text": " LCOS"}\n  ]\n}\nJSON\n`)

  const provider = new WhisperCppCliTranscriptionProvider({
    binaryPath: whisperPath,
    modelPath,
    ffmpegPath,
    threads: 3,
    noGpu: true,
  })
  const service = new VoiceTranscriptionService({
    registry: new VoiceTranscriptionProviderRegistry({ providers: [provider] }),
  })
  const result = await service.transcribe({
    audio: { bytes: new Uint8Array([9, 8, 7, 6]), mimeType: 'audio/webm;codecs=opus', durationMs: 900 },
    hints: { language: 'zh-CN', prompt: ' LCOS voice context ', timestamps: true },
  })

  assert.equal(result.providerId, 'whisper.cpp-cli')
  assert.equal(result.text, '你好 LCOS')
  assert.equal(result.language, 'zh')
  assert.equal(result.model, 'ggml-base')
  assert.deepEqual(result.segments, [
    { startMs: 0, endMs: 420, text: '你好' },
    { startMs: 420, endMs: 900, text: 'LCOS' },
  ])

  const ffmpegArgs = await readFile(ffmpegArgsPath, 'utf8')
  assert.match(ffmpegArgs, /-ar\n16000\n-ac\n1\n-c:a\npcm_s16le/)
  const whisperArgs = await readFile(whisperArgsPath, 'utf8')
  assert.match(whisperArgs, /-oj/)
  assert.match(whisperArgs, /-l\nzh/)
  assert.match(whisperArgs, /--prompt\nLCOS voice context/)
  assert.match(whisperArgs, /-t\n3/)
  assert.match(whisperArgs, /-ng/)

  const withoutTimestamps = await service.transcribe({
    audio: { bytes: new Uint8Array([1]), mimeType: 'audio/ogg' },
    hints: { timestamps: false },
  })
  assert.equal(withoutTimestamps.segments, undefined)

  assert.equal(createWhisperCppProviderFromEnvironment({
    LCOS_WHISPER_CPP_BIN: whisperPath,
    LCOS_WHISPER_CPP_MODEL: modelPath,
    LCOS_WHISPER_CPP_FFMPEG: ffmpegPath,
  })?.id, 'whisper.cpp-cli')
  assert.equal(createWhisperCppProviderFromEnvironment({
    LCOS_WHISPER_CPP_BIN: join(temp, 'missing-bin'),
    LCOS_WHISPER_CPP_MODEL: modelPath,
  }), undefined)
  assert.equal(createWhisperCppProviderFromEnvironment({
    LCOS_WHISPER_CPP_BIN: whisperPath,
    LCOS_WHISPER_CPP_MODEL: join(temp, 'missing-model'),
  }), undefined)

  const unavailableService = createDefaultVoiceTranscriptionService({})
  await assert.rejects(
    () => unavailableService.transcribe({ audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm' } }),
    (error) => error instanceof VoiceTranscriptionError && error.code === 'provider-unavailable',
  )

  const missingFfmpeg = new WhisperCppCliTranscriptionProvider({
    binaryPath: whisperPath,
    modelPath,
    ffmpegPath: join(temp, 'missing-ffmpeg'),
  })
  await assert.rejects(
    () => missingFfmpeg.transcribe({ audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm' } }),
    (error) => error instanceof VoiceTranscriptionError && error.code === 'provider-unavailable',
  )

  const slowWhisperPath = await executable('slow-whisper.sh', '#!/bin/sh\nsleep 10\n')
  const abortProvider = new WhisperCppCliTranscriptionProvider({
    binaryPath: slowWhisperPath,
    modelPath,
    ffmpegPath,
    processTimeoutMs: 30_000,
  })
  const controller = new AbortController()
  const pending = abortProvider.transcribe({
    audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm' },
    signal: controller.signal,
  })
  setTimeout(() => controller.abort(), 40)
  await assert.rejects(
    () => pending,
    (error) => error instanceof VoiceTranscriptionError && error.code === 'aborted',
  )

  process.stdout.write('A24-5 whisper.cpp concrete provider runtime smoke: PASS\n')
} finally {
  await rm(temp, { recursive: true, force: true })
}

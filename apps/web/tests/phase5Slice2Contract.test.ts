import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const captureSpace = readFileSync(new URL('../src/features/capture/CaptureSpace.tsx', import.meta.url), 'utf8')
const drive = readFileSync(new URL('../src/features/project/ProjectDrive.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/runtime/localCoreClient.ts', import.meta.url), 'utf8')

describe('Phase 5 Slice 2 — Capture Space convergence contract', () => {
  it('uses a system-level canvas instead of the old staging assignment dialog', () => {
    expect(captureSpace).toContain('surfaceMode="capture"')
    expect(captureSpace).toContain('Capture Space')
    expect(captureSpace).toContain('智能整理')
    expect(captureSpace).toContain('onDirectProjectViewDrop')
    expect(captureSpace).toContain('materializeCaptureToProject')
  })

  it('opens Capture Space from Project Drive and the application shell', () => {
    expect(drive).toContain('onOpenCaptureSpace')
    expect(drive).toContain('打开画布')
    expect(app).toContain('setCaptureSpaceOpen(true)')
    expect(app).toContain('captureSpaceOpen')
  })

  it('exposes presentation, organize and materialize through the runtime client', () => {
    expect(client).toContain('saveCaptureSpacePresentation')
    expect(client).toContain('organizeCaptureSpace')
    expect(client).toContain('materializeCaptureToProject')
  })
})

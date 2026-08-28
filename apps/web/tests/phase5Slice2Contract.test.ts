import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const captureSpace = readFileSync(new URL('../src/features/capture/CaptureSpace.tsx', import.meta.url), 'utf8')
const drive = readFileSync(new URL('../src/features/project/ProjectDrive.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/features/shell/AppShellView.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/features/assembly/AssemblyCaptureWorkspace.tsx', import.meta.url), 'utf8')
const materialFlow = readFileSync(new URL('../src/features/capture/CaptureMaterialFlow.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/runtime/localCoreClient.ts', import.meta.url), 'utf8')

describe('Phase 5 Slice 2 — Capture Space convergence contract', () => {
  it('routes /capture to AssemblyCaptureWorkspace as the primary GUI, not ProjectCanvas', () => {
    // F6 truth：capture.open 时 AppShellView 直接渲染 AssemblyCaptureWorkspace；
    // 旧 CaptureSpace（system canvas 形态）不再是 primary renderer。
    expect(shell).toContain('<AssemblyCaptureWorkspace client={props.capture.client}')
    expect(workspace).toContain('CaptureSpaceSnapshotV1')
    expect(workspace).not.toContain('ProjectCanvas')
    expect(shell).not.toContain('<CaptureSpace')
  })

  it('keeps staging read + materialize on real Core endpoints', () => {
    // staging 读模型与 materialize 都走 Core（captureSpace snapshot → materializeCaptureToProject），
    // 不在前端伪造 staging 状态。
    expect(workspace).toContain('client.captureSpace()')
    expect(workspace).toContain('client.materializeCaptureToProject(ids, projectId)')
    expect(materialFlow).toContain('masonry')
    // 三装配来源 tab：项目仓库 / Capture / Sources / Skills。
    expect(workspace).toContain("sourceTab, setSourceTab] = useState<'project' | 'capture' | 'sources' | 'skills'>")
  })

  it('preserves capture provenance through materialization', () => {
    // provenance 不因 materialize 丢失：来源字段（sourceUrl/pageTitle/capturedAt）与「原始来源仍保留」承诺。
    expect(materialFlow).toContain('item.capturedAt')
    expect(materialFlow).toContain('source.pageUrl')
    expect(workspace).toContain('原始来源仍保留')
  })

  it('opens Capture Space from Project Drive and the application shell', () => {
    // Drive 侧入口 = Capture Inbox（pending 计数徽标 + 打开 Capture 装配来源），不再是旧「打开画布」文案。
    expect(drive).toContain('onOpenCaptureSpace')
    expect(drive).toContain('打开 Capture 装配来源')
    expect(drive).toContain('capturePendingCount')
    expect(app).toContain('setCaptureSpaceOpen(true)')
    expect(app).toContain('captureSpaceOpen')
  })

  it('exposes presentation, organize and materialize through the runtime client', () => {
    expect(client).toContain('saveCaptureSpacePresentation')
    expect(client).toContain('organizeCaptureSpace')
    expect(client).toContain('materializeCaptureToProject')
  })

  it('legacy CaptureSpace canvas stays unmounted, never primary again', () => {
    // anti-regression：旧 canvas 形态的挂载点已退役（App/Shell 均不渲染）；文件残留仅作历史参照。
    expect(app).not.toContain('<CaptureSpace')
    expect(shell).not.toContain("from '../capture/CaptureSpace'")
    expect(captureSpace).toContain('surfaceMode="capture"') // legacy 文件自身形态不变，仅不再被挂载
  })
})

export interface UiCapability {
  readonly enabled: boolean
  readonly reason?: string
}

export type RunOutputIntent = 'create' | 'revise' | 'analyze'

export interface V07CapabilitySet {
  readonly schemaVersion: 1
  readonly importCopy: UiCapability
  readonly createObject: UiCapability
  readonly linkReference: UiCapability
  readonly contextManifest: UiCapability
  readonly runWorkflow: UiCapability
  readonly acceptReturn: UiCapability
  readonly rejectReturn: UiCapability
  readonly retryRun: UiCapability
  readonly webPane: UiCapability
  readonly browserCompanion: UiCapability
}

export interface LinkReferenceInput {
  readonly url: string
  readonly title?: string
  readonly note?: string
}

export interface WebReferencePresentation {
  readonly url: string
  readonly title: string
  readonly displayMode: 'link_card' | 'external_tab' | 'browser_companion' | 'inline_embed'
  readonly embedStatus: 'not_checked' | 'available' | 'blocked' | 'unsupported'
}

export function capabilitiesFor(source: 'runtime' | 'none'): V07CapabilitySet {
  const runtime = source === 'runtime'
  const unavailable = (reason: string): UiCapability => ({ enabled: false, reason })
  return {
    schemaVersion: 1,
    importCopy: runtime ? { enabled: true } : unavailable('本地项目服务暂时不可用'),
    createObject: { enabled: true },
    linkReference: runtime ? { enabled: true } : unavailable('请先打开一个本地项目'),
    contextManifest: runtime ? { enabled: true } : unavailable('请先选择要给 Agent 参考的内容'),
    runWorkflow: runtime ? { enabled: true } : unavailable('请先打开一个本地项目'),
    acceptReturn: unavailable('目前没有待确认的 Agent 结果'),
    rejectReturn: unavailable('目前没有待确认的 Agent 结果'),
    retryRun: unavailable('目前没有待确认的 Agent 结果'),
    webPane: unavailable('MVP 使用外部标签页'),
    browserCompanion: unavailable('浏览器 Companion 尚未安装'),
  }
}

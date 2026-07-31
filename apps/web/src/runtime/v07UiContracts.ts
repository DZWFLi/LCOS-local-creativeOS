export interface UiCapability {
  readonly enabled: boolean
  readonly reason?: string
}

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
  readonly title: string
  readonly description: string
  readonly purpose: string
}

export interface LinkReferenceDocument {
  readonly fileName: string
  readonly markdown: string
  readonly provider: 'feishu' | 'web'
  readonly resourceType: 'wiki' | 'document' | 'sheet' | 'base' | 'web'
}

export function createLinkReferenceDocument(input: LinkReferenceInput): LinkReferenceDocument {
  const link = new URL(input.url)
  if (!['http:', 'https:'].includes(link.protocol)) throw new Error('Link Reference requires HTTP or HTTPS.')
  const provider = /(^|\.)feishu\.cn$|(^|\.)larksuite\.com$|(^|\.)feishu\.com$/i.test(link.hostname)
    ? 'feishu'
    : 'web'
  const resourceType = /\/wiki\//i.test(link.pathname)
    ? 'wiki'
    : /\/docx?\//i.test(link.pathname)
      ? 'document'
      : /\/sheets?\//i.test(link.pathname)
        ? 'sheet'
        : /\/base\//i.test(link.pathname)
          ? 'base'
          : 'web'
  const slug = input.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim() || 'link-reference'
  return {
    fileName: `${slug}.link.md`,
    provider,
    resourceType,
    markdown: [
      '---',
      `sourceKind: ${provider === 'feishu' ? 'feishu_link' : 'external_url'}`,
      `provider: ${provider}`,
      `resourceType: ${resourceType}`,
      `url: ${input.url}`,
      `title: ${input.title}`,
      'accessMode: open_with_available_tool',
      '---',
      '',
      input.description || 'External project reference.',
      '',
      '## Project purpose',
      '',
      input.purpose || 'Use as project context when explicitly selected.',
      '',
      '> Agent rule: report access failure honestly; do not claim the page was read when unavailable.',
    ].join('\n'),
  }
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
    importCopy: runtime ? { enabled: true } : unavailable('Local Core 未连接'),
    createObject: { enabled: true },
    linkReference: runtime ? { enabled: true } : unavailable('需要 Runtime Project Truth'),
    contextManifest: runtime ? { enabled: true } : unavailable('ContextManifest 只从 Runtime 构建'),
    runWorkflow: runtime ? { enabled: true } : unavailable('需要 Runtime Project Truth'),
    acceptReturn: unavailable('没有待确认的 Runtime Return'),
    rejectReturn: unavailable('没有待确认的 Runtime Return'),
    retryRun: unavailable('没有待确认的 Runtime Return'),
    webPane: unavailable('MVP 使用外部标签页'),
    browserCompanion: unavailable('浏览器 Companion 尚未安装'),
  }
}

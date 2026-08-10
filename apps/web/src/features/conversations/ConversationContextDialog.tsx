import { Bookmark, Brain, Download, FileJson, Focus, GitBranch, Lock, MessageSquare, Pencil, RefreshCw, Search, Sparkles, Unlock, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationMessageV1, ConversationProjectionV1, ConversationSearchHitV1, ConversationSessionV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

const CHUNK_BYTES = 4 * 1024 * 1024

async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}
function unwrap<T>(call: { readonly result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } } }): T {
  if (!call.result.ok) throw new Error(call.result.error.message)
  return call.result.value
}

export function ConversationContextDialog({ open, projectId, scopeId, workspaceId, client, onClose, onImported, onFocusArtifact, onActivateContextSource, onRequestSectionAnnotation }: {
  readonly open: boolean
  readonly projectId: string
  readonly scopeId: string
  readonly workspaceId?: string
  readonly client: LocalCoreClient
  readonly onClose: () => void
  readonly onImported: () => void
  readonly onFocusArtifact?: (artifactId: string) => void
  readonly onActivateContextSource?: (viewId: string) => void
  readonly onRequestSectionAnnotation?: (input: { readonly conversationId: string; readonly sectionId: string; readonly sectionTitle: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [sessions, setSessions] = useState<readonly ConversationSessionV1[]>([])
  const [projection, setProjection] = useState<ConversationProjectionV1 | null>(null)
  const [messages, setMessages] = useState<readonly ConversationMessageV1[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<readonly ConversationSearchHitV1[]>([])
  const [semantic, setSemantic] = useState(false)
  const [tab, setTab] = useState<'timeline' | 'outline' | 'graph' | 'search'>('timeline')
  const [busy, setBusy] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualText, setManualText] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sectionTitleDraft, setSectionTitleDraft] = useState('')
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null)
  const focusTimerRef = useRef<number | null>(null)

  const loadSessions = useCallback(async () => {
    const call = await client.conversations(projectId)
    const value = unwrap<readonly ConversationSessionV1[]>(call)
    setSessions(value)
    setSelectedId((current) => current ?? value[0]?.id ?? null)
  }, [client, projectId])
  const loadConversation = useCallback(async (id: string) => {
    const [projectionCall, messagesCall] = await Promise.all([
      client.conversationProjection(projectId, id),
      client.conversationMessages(projectId, id, { limit: 500 }),
    ])
    setProjection(unwrap<ConversationProjectionV1>(projectionCall))
    setMessages(unwrap<readonly ConversationMessageV1[]>(messagesCall))
  }, [client, projectId])

  useEffect(() => {
    if (!open) return
    setError('')
    void loadSessions().catch((caught) => setError(caught instanceof Error ? caught.message : '无法读取对话'))
  }, [loadSessions, open])
  useEffect(() => {
    if (!open || selectedId === null) { setProjection(null); setMessages([]); return }
    setFocusedSectionId(null)
    void loadConversation(selectedId).catch((caught) => setError(caught instanceof Error ? caught.message : '无法读取时间线'))
  }, [loadConversation, open, selectedId])
  useEffect(() => () => { if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current) }, [])

  const sectionForMessage = useMemo(() => {
    const map = new Map<number, string>()
    for (const section of projection?.sections ?? []) for (let seq = section.startSeq; seq <= section.endSeq; seq += 1) map.set(seq, section.title)
    return map
  }, [projection?.sections])
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) ?? projection?.session ?? null, [projection?.session, selectedId, sessions])
  const messagesBySection = useMemo(() => {
    const map = new Map<string, ConversationMessageV1[]>()
    for (const section of projection?.sections ?? []) map.set(section.id, [])
    for (const message of messages) {
      const section = projection?.sections.find((item) => message.seq >= item.startSeq && message.seq <= item.endSeq)
      if (section) map.get(section.id)?.push(message)
    }
    return map
  }, [messages, projection?.sections])
  const changePoints = useMemo(() => (projection?.sections ?? []).map((section) => {
    const sectionMessages = messagesBySection.get(section.id) ?? []
    const pinnedCount = sectionMessages.filter((message) => message.pinnedAsDecision).length
    const annotationCount = (section.annotation?.decisions.length ?? 0) + (section.annotation?.todos.length ?? 0)
    const importance: 'high' | 'medium' | 'low' = pinnedCount > 0 || annotationCount >= 3 ? 'high' : section.annotation || sectionMessages.some((message) => message.fileRefs.length > 0) ? 'medium' : 'low'
    const summary = section.annotation?.decisions[0] || section.annotation?.todos[0] || sectionMessages.find((message) => message.pinnedAsDecision)?.contentText || sectionMessages.find((message) => message.role === 'user')?.contentText || ''
    return { section, importance, summary: summary.replace(/\s+/g, ' ').trim().slice(0, 96) }
  }), [messagesBySection, projection?.sections])
  const focusedSection = useMemo(() => projection?.sections.find((section) => section.id === focusedSectionId) ?? null, [focusedSectionId, projection?.sections])
  const locateSection = useCallback((sectionId: string) => {
    const section = projection?.sections.find((item) => item.id === sectionId)
    if (!section) return
    setTab('timeline')
    setFocusedSectionId(sectionId)
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const message = messages.find((item) => item.seq >= section.startSeq && item.seq <= section.endSeq)
      if (message) document.getElementById(`conversation-message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
    focusTimerRef.current = window.setTimeout(() => setFocusedSectionId((current) => current === sectionId ? null : current), 1900)
  }, [messages, projection?.sections])

  if (!open) return null

  const parseManualEntries = (value: string): { role: 'user' | 'assistant' | 'tool' | 'system'; contentText: string }[] => {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const decoded = JSON.parse(trimmed) as unknown
      if (Array.isArray(decoded)) return decoded.flatMap((item) => {
        if (typeof item !== 'object' || item === null) return []
        const record = item as Record<string, unknown>
        const role = record.role === 'assistant' || record.role === 'tool' || record.role === 'system' ? record.role : 'user'
        const contentText = typeof record.contentText === 'string' ? record.contentText : typeof record.content === 'string' ? record.content : ''
        return contentText.trim() ? [{ role, contentText: contentText.trim() }] : []
      })
    } catch { /* plain text timeline below */ }
    const entries: { role: 'user' | 'assistant' | 'tool' | 'system'; contentText: string }[] = []
    let role: 'user' | 'assistant' | 'tool' | 'system' = 'user'
    let lines: string[] = []
    const flush = (): void => { const contentText = lines.join('\n').trim(); if (contentText) entries.push({ role, contentText }); lines = [] }
    for (const line of trimmed.split(/\r?\n/)) {
      const match = /^(用户|user|助手|assistant|agent|工具|tool|系统|system)\s*[:：]\s*(.*)$/i.exec(line)
      if (!match) { lines.push(line); continue }
      flush()
      const label = (match[1] ?? '').toLowerCase()
      role = label === '助手' || label === 'assistant' || label === 'agent' ? 'assistant' : label === '工具' || label === 'tool' ? 'tool' : label === '系统' || label === 'system' ? 'system' : 'user'
      lines.push(match[2] ?? '')
    }
    flush()
    return entries.length > 0 ? entries : [{ role: 'user', contentText: trimmed }]
  }
  const importManual = async (): Promise<void> => {
    const entries = parseManualEntries(manualText)
    if (entries.length === 0) { setError('请先粘贴对话内容。'); return }
    setBusy(true); setError(''); setProgress('正在整理本地时间线…')
    try {
      const completed = unwrap(await client.importManualConversation(projectId, { title: manualTitle.trim() || '手动导入的对话', scopeId, ...(workspaceId === undefined ? {} : { workspaceId }), entries }))
      await loadSessions(); setSelectedId(completed.session.id); await loadConversation(completed.session.id)
      setManualText(''); setManualTitle(''); setManualOpen(false); onImported(); setProgress(`已导入 ${completed.session.messageCount} 条记录`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '手动时间线导入失败') }
    finally { setBusy(false) }
  }

  const importJsonl = async (file: File): Promise<void> => {
    setBusy(true); setError(''); setProgress('正在创建导入任务…')
    try {
      const created = unwrap(await client.createConversationImportSession(projectId, {
        sourceKind: 'codex', title: file.name.replace(/\.jsonl$/i, ''), sourceFileName: file.name, expectedBytes: file.size,
        scopeId, ...(workspaceId === undefined ? {} : { workspaceId }),
      }))
      const count = Math.ceil(file.size / CHUNK_BYTES)
      for (let index = 0; index < count; index += 1) {
        const chunk = file.slice(index * CHUNK_BYTES, Math.min(file.size, (index + 1) * CHUNK_BYTES))
        setProgress(`正在导入 ${index + 1} / ${count}`)
        unwrap(await client.uploadConversationChunk(projectId, created.id, index, chunk, await hashBlob(chunk)))
      }
      setProgress('正在建立时间线和全文索引…')
      const completed = unwrap(await client.completeConversationImport(projectId, created.id, { expectedChunks: count }))
      await loadSessions(); setSelectedId(completed.session.id); await loadConversation(completed.session.id)
      onImported(); setProgress(`已导入 ${completed.session.messageCount} 条记录`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '对话导入失败') }
    finally { setBusy(false) }
  }
  const exportConversation = async (): Promise<void> => {
    if (selectedId === null || projection === null) return
    setBusy(true); setError(''); setProgress('正在整理可恢复的对话上下文…')
    try {
      const exported = unwrap(await client.exportConversation(projectId, selectedId, true))
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `${projection.session.title.replace(/[<>:"/\|?*]/g, '_') || 'conversation'}.lcos-conversation.json`
      link.click()
      URL.revokeObjectURL(href)
      setProgress('对话上下文已导出。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '对话导出失败') }
    finally { setBusy(false) }
  }
  const runSearch = async (): Promise<void> => {
    if (!query.trim()) { setHits([]); return }
    setBusy(true); setError('')
    try { setHits(unwrap(await client.searchConversations(projectId, query.trim(), { semantic, limit: 50 }))); setTab('search') }
    catch (caught) { setError(caught instanceof Error ? caught.message : '搜索失败') }
    finally { setBusy(false) }
  }
  const pin = async (message: ConversationMessageV1): Promise<void> => {
    if (selectedId === null) return
    setBusy(true); setError('')
    try {
      unwrap(await client.pinConversationMessage(projectId, selectedId, message.id, { scopeId, ...(workspaceId === undefined ? {} : { workspaceId }) }))
      await loadConversation(selectedId); onImported()
    } catch (caught) { setError(caught instanceof Error ? caught.message : '无法标记重点消息') }
    finally { setBusy(false) }
  }
  const toggleSectionLock = async (sectionId: string, locked: boolean): Promise<void> => {
    if (selectedId === null) return
    try { unwrap(await client.updateConversationSection(projectId, selectedId, sectionId, { lockedByUser: !locked })); await loadConversation(selectedId) }
    catch (caught) { setError(caught instanceof Error ? caught.message : '章节更新失败') }
  }
  const renameSection = async (sectionId: string): Promise<void> => {
    if (selectedId === null || !sectionTitleDraft.trim()) return
    try {
      unwrap(await client.updateConversationSection(projectId, selectedId, sectionId, { title: sectionTitleDraft.trim(), lockedByUser: true }))
      setEditingSectionId(null)
      setSectionTitleDraft('')
      await loadConversation(selectedId)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '章节标题保存失败') }
  }
  const refreshSections = async (): Promise<void> => {
    if (selectedId === null) return
    setBusy(true); setError(''); setProgress('正在按原始时间线重新整理章节…')
    try {
      unwrap(await client.refreshConversationSections(projectId, selectedId))
      await loadConversation(selectedId)
      setProgress('章节已重新整理，已锁定的章节保持不变。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '章节重新整理失败') }
    finally { setBusy(false) }
  }
  const buildIndex = async (): Promise<void> => {
    setBusy(true); setError(''); setProgress('正在调用本地 Ollama 建立语义索引…')
    try {
      let status = unwrap(await client.buildConversationSemanticIndex(projectId, selectedId === null ? {} : { sessionId: selectedId }))
      for (let attempt = 0; status.state === 'indexing' && attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        status = unwrap(await client.conversationSemanticStatus(projectId))
        setProgress(`正在建立语义索引，已处理 ${status.indexedMessages} 条…`)
      }
      setProgress(status.state === 'ready' ? `语义索引已就绪，共 ${status.indexedMessages} 条` : status.lastError ? `索引未完成：${status.lastError}` : `索引状态：${status.state}`)
      if (selectedId) await loadConversation(selectedId)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '本地语义索引暂不可用') }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onPointerDown={(event) => dismissFromBackdrop(event, onClose, busy)}><section className="conversation-context-dialog" role="dialog" aria-label="对话上下文">
    <header className="conversation-header"><div><MessageSquare size={18}/><div><h2>对话上下文</h2><p>这里只记录这一条导入对话。重点导航是视觉索引，完整细节仍保留在原始时间线与本地记忆中。</p></div></div><button type="button" className="dialog-close-action pressable" onClick={onClose} aria-label="关闭对话上下文"><X size={16}/><span>关闭</span></button></header>
    <div className="conversation-toolbar">
      <button type="button" className="pressable" disabled={busy} onClick={() => inputRef.current?.click()}><Upload size={15}/>导入 Codex JSONL</button>
      <button type="button" className="pressable" disabled={busy} onClick={() => setManualOpen((value) => !value)}><MessageSquare size={15}/>粘贴时间线</button>
      <button type="button" className="pressable" disabled={busy || sessions.length === 0} onClick={() => void buildIndex()}><Brain size={15}/>建立本地语义索引</button>
      <button type="button" className="pressable" disabled={busy || selectedId === null} onClick={() => void exportConversation()}><Download size={15}/>导出当前对话</button>
      <button type="button" className="pressable" disabled={!projection?.session.conversationArtifactId || onFocusArtifact === undefined} onClick={() => { const artifactId = projection?.session.conversationArtifactId; const viewId = projection?.session.conversationViewId; if (artifactId && onFocusArtifact) { onFocusArtifact(artifactId); if (viewId && onActivateContextSource) onActivateContextSource(viewId); onClose() } }}><Focus size={15}/>在画布中打开</button>
      <div className="conversation-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSearch() }} placeholder="搜索全部对话"/><label><input type="checkbox" checked={semantic} onChange={(event) => setSemantic(event.target.checked)}/>语义</label></div>
      <input ref={inputRef} hidden type="file" accept=".jsonl,application/x-ndjson" onChange={(event) => { const file = event.target.files?.[0]; event.target.value=''; if (file) void importJsonl(file) }}/>
    </div>
    {manualOpen && <div className="conversation-manual-import"><input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="对话标题（可选）"/><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={'用户：先分析这个脚本\n助手：……\n\n也可以粘贴 [{ role, contentText }] JSON。'}/><div><button type="button" onClick={() => setManualOpen(false)}>取消</button><button type="button" disabled={busy || !manualText.trim()} onClick={() => void importManual()}>导入时间线</button></div></div>}
    {progress && <p className="conversation-progress">{progress}</p>}{error && <p className="import-error" role="alert">{humanConversationError(error)} <button type="button" className="quiet pressable" onClick={() => { void navigator.clipboard?.writeText(error) }}>复制诊断</button></p>}
    {selectedSession?.diagnostics && <div className="conversation-diagnostics" aria-label="导入诊断"><span>读取 {selectedSession.diagnostics.parsedLines} 行</span><span>导入 {selectedSession.messageCount} 条</span><span>忽略 {selectedSession.diagnostics.ignoredEvents} 条系统记录</span><span>去重 {selectedSession.diagnostics.duplicateEvents} 条</span><span>匹配文件 {selectedSession.diagnostics.matchedFileReferences} 项</span>{selectedSession.diagnostics.invalidLines > 0 && <span className="warning">无法解析 {selectedSession.diagnostics.invalidLines} 行</span>}</div>}
    <div className="conversation-layout">
      <aside><h3>已导入对话</h3>{sessions.length === 0 && <p className="empty-copy">还没有对话。导入只做解析和全文索引，不调用模型。</p>}{sessions.map((session) => <button type="button" key={session.id} className={selectedId === session.id ? 'active' : ''} onClick={() => setSelectedId(session.id)}><FileJson size={14}/><span><b>{session.title}</b><small>{session.messageCount} 条 · {session.sectionCount} 章</small></span></button>)}</aside>
      <main>
        {projection && <><div className="conversation-tabs"><button className={tab==='timeline'?'active':''} onClick={() => setTab('timeline')}>对话</button><button className={tab==='outline'?'active':''} onClick={() => setTab('outline')}>大纲</button><button className={tab==='graph'?'active':''} onClick={() => setTab('graph')}>关系</button><button className={tab==='search'?'active':''} onClick={() => setTab('search')}>搜索</button><span title={`${projection.semanticIndex.provider} · ${projection.semanticIndex.model} · ${projection.semanticIndex.backend ?? '未建立'}`}>{projection.semanticIndex.state === 'ready' ? `语义索引 ${projection.semanticIndex.indexedMessages} · ${projection.semanticIndex.backend === 'sqlite-vec' ? '本地向量' : '兼容存储'}` : '全文索引已用'}</span></div>
        <div className={`conversation-view-shell ${tab === 'search' ? 'without-change-rail' : ''}`}>
          {tab !== 'search' && <ConversationChangeRail points={changePoints} activeSectionId={focusedSectionId} onLocate={locateSection} onAskAgent={onRequestSectionAnnotation && selectedId ? (section) => { onRequestSectionAnnotation({ conversationId: selectedId, sectionId: section.id, sectionTitle: section.title }); onClose() } : undefined} />}
          <div className="conversation-view-content">
        {tab === 'timeline' && <div className="conversation-timeline">{messages.map((message) => { const highlighted = focusedSection ? message.seq >= focusedSection.startSeq && message.seq <= focusedSection.endSeq : false; return <article id={`conversation-message-${message.id}`} key={message.id} className={`conversation-message role-${message.role}${highlighted ? ' is-change-focus' : ''}`}><header><b>{message.role === 'user' ? '你' : message.role === 'assistant' ? 'Agent' : message.role === 'tool' ? '工具' : '系统'}</b><small>#{message.seq} · {sectionForMessage.get(message.seq) ?? '未分章'}</small>{message.pinnedAsDecision ? <span className="decision-badge"><Bookmark size={12}/>重点</span> : <button type="button" disabled={busy} onClick={() => void pin(message)}><Bookmark size={12}/>标为重点</button>}</header><pre>{message.contentText}</pre>{message.fileRefs.length > 0 && <footer>涉及文件：{message.fileRefs.map((item) => item.normalized ?? item.raw).join('、')}</footer>}</article> })}</div>}
        {tab === 'outline' && <div className="conversation-outline"><div className="conversation-outline-actions"><button type="button" disabled={busy} onClick={() => void refreshSections()}><RefreshCw size={13}/>重新整理未锁定章节</button></div>{projection.sections.map((section) => <article key={section.id}><header><div>{editingSectionId === section.id ? <form className="conversation-section-rename" onSubmit={(event) => { event.preventDefault(); void renameSection(section.id) }}><input autoFocus value={sectionTitleDraft} onChange={(event) => setSectionTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setEditingSectionId(null); setSectionTitleDraft('') } }}/><button type="submit">保存</button></form> : <b>{section.title}</b>}<small>#{section.startSeq}–{section.endSeq} · {section.kind}</small></div><div className="conversation-section-buttons"><button type="button" title={section.annotation ? '让 Agent 重新提炼这一段的变化要点' : '让 Agent 提炼重要修改点和继续事项'} disabled={onRequestSectionAnnotation === undefined} onClick={() => { if (selectedId && onRequestSectionAnnotation) { onRequestSectionAnnotation({ conversationId: selectedId, sectionId: section.id, sectionTitle: section.title }); onClose() } }}><Sparkles size={14}/></button><button type="button" title="修改章节标题" onClick={() => { setEditingSectionId(section.id); setSectionTitleDraft(section.title) }}><Pencil size={14}/></button><button type="button" title={section.lockedByUser?'解除锁定':'锁定章节边界'} onClick={() => void toggleSectionLock(section.id, section.lockedByUser)}>{section.lockedByUser?<Lock size={14}/>:<Unlock size={14}/>}</button></div></header>{section.annotation && <div className="conversation-annotation"><b>{section.annotation.title}</b><p>{section.annotation.decisions.join('；') || '暂无需要特别标记的变化'}</p><small>{section.annotation.todos.join('；') || '暂无继续事项'}{section.annotation.involvedFiles.length > 0 ? ` · 涉及 ${section.annotation.involvedFiles.join('、')}` : ''}</small></div>}</article>)}</div>}
        {tab === 'graph' && <div className="conversation-graph" aria-label="对话关系图"><article className="conversation-graph-root"><MessageSquare size={18}/><div><b>{projection.session.title}</b><small>{projection.session.messageCount} 条消息 · {projection.sections.length} 个章节</small></div></article><div className="conversation-graph-branches">{projection.sections.map((section) => { const sectionMessages = messagesBySection.get(section.id) ?? []; const pinned = sectionMessages.filter((message) => message.pinnedAsDecision); const files = [...new Set(sectionMessages.flatMap((message) => message.fileRefs.map((ref) => ref.normalized ?? ref.raw)))]; return <article key={section.id} className="conversation-graph-section"><header><GitBranch size={14}/><div><b>{section.annotation?.title || section.title}</b><small>#{section.startSeq}–{section.endSeq}</small></div></header>{pinned.length > 0 && <div className="conversation-graph-items"><strong>重点</strong>{pinned.map((message) => <button type="button" key={message.id} onClick={() => { setTab('timeline'); document.getElementById(`conversation-message-${message.id}`)?.scrollIntoView({ block: 'center' }) }}><Bookmark size={11}/>{message.contentText.slice(0, 48)}</button>)}</div>}{files.length > 0 && <div className="conversation-graph-items"><strong>涉及文件</strong>{files.slice(0, 8).map((file) => <span key={file}>{file}</span>)}</div>}{pinned.length === 0 && files.length === 0 && <small className="empty-copy">这一段还没有重点消息或文件关系。</small>}</article> })}</div></div>}
        {tab === 'search' && <div className="conversation-timeline">{hits.length===0?<p className="empty-copy">输入关键词后按 Enter。语义搜索需要本地 Ollama 索引。</p>:hits.map((hit)=><article key={`${hit.message.id}-${hit.hybridScore}`} className="conversation-message"><header><b>{hit.sessionTitle}</b><small>{hit.sectionTitle ?? `#${hit.message.seq}`} · {hit.reasons.join(' + ')}</small><button type="button" onClick={() => { setSelectedId(hit.message.sessionId); setTab('timeline') }}>打开原文</button></header><pre>{hit.message.contentText}</pre></article>)}</div>}
          </div>
        </div>
        </>}
      </main>
    </div>
  </section></div>
}


type ConversationChangePoint = {
  readonly section: ConversationProjectionV1['sections'][number]
  readonly importance: 'high' | 'medium' | 'low'
  readonly summary: string
}

function ConversationChangeRail({ points, activeSectionId, onLocate, onAskAgent }: {
  readonly points: readonly ConversationChangePoint[]
  readonly activeSectionId: string | null
  readonly onLocate: (sectionId: string) => void
  readonly onAskAgent?: (section: ConversationChangePoint['section']) => void
}) {
  if (points.length < 2) return null
  return <nav className="conversation-change-rail" aria-label="当前对话的重要变化导航">
    <span className="conversation-change-line" aria-hidden="true" />
    {points.map((point, index) => <div key={point.section.id} className={`conversation-change-point importance-${point.importance}${activeSectionId === point.section.id ? ' active' : ''}`}>
      <button type="button" className="conversation-change-marker" aria-label={`定位到 ${point.section.annotation?.title || point.section.title}`} onClick={() => onLocate(point.section.id)}><span /></button>
      <div className="conversation-change-popover">
        <small>{index + 1} / {points.length} · #{point.section.startSeq}–{point.section.endSeq}</small>
        <strong>{point.section.annotation?.title || point.section.title}</strong>
        {point.summary && <p>{point.summary}</p>}
        <div><button type="button" onClick={() => onLocate(point.section.id)}><Focus size={12}/>定位</button>{onAskAgent && <button type="button" onClick={() => onAskAgent(point.section)}><Sparkles size={12}/>让 Agent 提炼</button>}</div>
      </div>
    </div>)}
  </nav>
}


function humanConversationError(message: string): string {
  if (/OLLAMA|embed|semantic/i.test(message)) return '本地语义索引暂时不可用。全文搜索和原始时间线仍然可用。'
  if (/SOURCE_STALE|SECTION_SOURCE_STALE|stale/i.test(message)) return '这一章的原文已经变化，请重新打开后再提炼。'
  if (/offline|ECONNREFUSED|fetch failed|unavailable/i.test(message)) return '本地项目服务暂时无法连接。已经导入的内容不会丢失。'
  if (/chunk|hash|upload/i.test(message)) return '对话文件有一部分没有完整传入，请重新选择原文件导入。'
  return message
}

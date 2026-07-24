import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  Check,
  CircleAlert,
  Clock3,
  Database,
  FolderCheck,
  RefreshCw,
  Server,
  TestTube2,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type {
  HealthStatus,
  MetadataStoreStatus,
  ProjectCatalogEntry,
  ProjectGraphSnapshot,
  Result,
  ValidatedProjectRoot,
  WorkspaceContextPolicy,
} from '@local-creative-os/contracts'

import {
  createLocalCoreClient,
  loadStructuredTestReport,
  type RuntimeCall,
  type StructuredTestReport,
} from '../../runtime/localCoreClient'
import './runtime-diagnostics.css'

const client = createLocalCoreClient()
const REFRESH_INTERVAL_MS = 5_000

interface DiagnosticsSnapshot {
  readonly health?: RuntimeCall<HealthStatus>
  readonly catalog?: RuntimeCall<readonly ProjectCatalogEntry[]>
  readonly report?: Result<StructuredTestReport>
  readonly metadata?: RuntimeCall<MetadataStoreStatus>
  readonly graph?: RuntimeCall<ProjectGraphSnapshot>
  readonly refreshedAt?: string
}

const DISPOSABLE_PROJECT_ID = 'disposable-portasplit-phase2-lite'

function disposablePortaSplitSnapshot(): ProjectGraphSnapshot {
  const now = new Date().toISOString()
  const projectId = DISPOSABLE_PROJECT_ID as ProjectGraphSnapshot['project']['id']
  return {
    schemaVersion: 3,
    graphVersion: 1 as ProjectGraphSnapshot['graphVersion'],
    project: {
      id: projectId,
      name: 'PortaSplit · Phase 2.5',
      rootPath: 'disposable://portasplit-phase2-lite',
      graphVersion: 1 as ProjectGraphSnapshot['project']['graphVersion'],
      createdAt: now, updatedAt: now,
    },
    scopes: [{
      id: 'disposable-scope-root' as ProjectGraphSnapshot['scopes'][number]['id'],
      projectId,
      parentScopeId: null,
      containerViewId: null,
      kind: 'root',
      name: 'Root',
      createdAt: now, updatedAt: now,
    }],
    workspaces: [{
      id: 'disposable-workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id'],
      projectId,
      scopeId: 'disposable-scope-root' as ProjectGraphSnapshot['workspaces'][number]['scopeId'],
      name: 'Main Canvas',
      intent: 'build',
      viewport: { x: 128, y: 72, zoom: 0.92 },
      focusedNodeIds: ['disposable-view-brief', 'disposable-view-board'],
      visibleLayers: ['core'],
      contextPolicy: 'selection-only' as WorkspaceContextPolicy,
      updatedAt: now,
    }],
    artifacts: [
      {
        id: 'disposable-artifact-brief' as ProjectGraphSnapshot['artifacts'][number]['id'],
        projectId,
        title: 'PortaSplit Brief', kind: 'markdown', localPath: 'disposable://portasplit/brief.md',
        availability: 'available', createdAt: now, updatedAt: now,
      },
      {
        id: 'disposable-artifact-board' as ProjectGraphSnapshot['artifacts'][number]['id'],
        projectId,
        title: 'Direction Board', kind: 'image', localPath: 'disposable://portasplit/board.png',
        availability: 'available', createdAt: now, updatedAt: now,
      },
    ],
    artifactViews: [
      {
        id: 'disposable-view-brief' as ProjectGraphSnapshot['artifactViews'][number]['id'],
        artifactId: 'disposable-artifact-brief' as ProjectGraphSnapshot['artifacts'][number]['id'],
        scopeId: 'disposable-scope-root' as ProjectGraphSnapshot['artifactViews'][number]['scopeId'],
        referenceKind: 'primary', position: { x: 120, y: 180 },
        size: { width: 280, height: 180 }, displayMode: 'card', collapsed: false,
      },
      {
        id: 'disposable-view-board' as ProjectGraphSnapshot['artifactViews'][number]['id'],
        artifactId: 'disposable-artifact-board' as ProjectGraphSnapshot['artifacts'][number]['id'],
        scopeId: 'disposable-scope-root' as ProjectGraphSnapshot['artifactViews'][number]['scopeId'],
        referenceKind: 'primary', position: { x: 520, y: 210 },
        size: { width: 320, height: 220 }, displayMode: 'thumbnail', collapsed: false,
      },
    ],
    relations: [{
      id: 'disposable-relation-brief-board' as ProjectGraphSnapshot['relations'][number]['id'],
      projectId: DISPOSABLE_PROJECT_ID as ProjectGraphSnapshot['project']['id'],
      sourceEntityType: 'artifact', sourceEntityId: 'disposable-artifact-brief',
      targetEntityType: 'artifact', targetEntityId: 'disposable-artifact-board',
      kind: 'informs', createdAt: now, updatedAt: now,
    }],
    notes: [],
    artifactRevisions: [],
    checkpoints: [],
  }
}

function ErrorCode({ result }: { readonly result: Result<unknown> | undefined }) {
  if (result === undefined || result.ok) return null
  return <div className="diagnostics-error" role="status">
    <CircleAlert size={15} />
    <strong>{result.error.code}</strong>
    <span>{result.error.message}</span>
  </div>
}

function SourceBadge({ origin }: { readonly origin: 'fixture' | 'runtime' }) {
  return <span className={`diagnostics-source source-${origin}`}>
    {origin === 'runtime' ? <Wifi size={12} /> : <Database size={12} />}
    {origin === 'runtime' ? 'Runtime' : 'Fixture'}
  </span>
}

function CheckRow({
  label,
  passed,
  detail,
}: {
  readonly label: string
  readonly passed: boolean
  readonly detail: string
}) {
  return <li className={passed ? 'check-pass' : 'check-fail'}>
    {passed ? <Check size={15} /> : <CircleAlert size={15} />}
    <span>{label}</span>
    <small>{detail}</small>
  </li>
}

export function RuntimeDiagnosticsPage() {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>({})
  const [refreshing, setRefreshing] = useState(true)
  const [rootPath, setRootPath] = useState('')
  const [rootResult, setRootResult] = useState<RuntimeCall<ValidatedProjectRoot>>()
  const [validatingRoot, setValidatingRoot] = useState(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    const [health, catalog, report, metadata, graph] = await Promise.all([
      client.health(signal),
      client.catalog(signal),
      loadStructuredTestReport(signal),
      client.metadataStatus(signal),
      client.projectGraph(DISPOSABLE_PROJECT_ID, signal),
    ])
    if (signal?.aborted) return
    setSnapshot({
      health,
      catalog,
      report,
      metadata,
      graph,
      refreshedAt: new Date().toISOString(),
    })
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const interval = window.setInterval(() => {
      void refresh(controller.signal)
    }, REFRESH_INTERVAL_MS)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [refresh])

  const online = snapshot.health?.result.ok === true
  const health = snapshot.health?.result.ok ? snapshot.health.result.value : undefined
  const catalog = snapshot.catalog?.result.ok ? snapshot.catalog.result.value : []
  const report = snapshot.report?.ok ? snapshot.report.value : undefined
  const metadata = snapshot.metadata?.result.ok ? snapshot.metadata.result.value : undefined
  const graph = snapshot.graph?.result.ok ? snapshot.graph.result.value : undefined

  const checks = useMemo(() => [
    {
      label: 'Dev proxy',
      passed: online,
      detail: online ? 'Same-origin Local Core proxy reachable' : 'Proxy or Local Core unavailable',
    },
    {
      label: 'Health contract',
      passed: health?.service === 'local-core' && health.mode === 'phase_2_lite',
      detail: health === undefined ? 'No valid health payload' : `${health.service} · ${health.mode}`,
    },
    {
      label: 'Runtime origin',
      passed: snapshot.health?.origin === 'runtime' && snapshot.catalog?.origin === 'runtime',
      detail: 'Diagnostics never falls back to Fixture',
    },
    {
      label: 'Catalog result',
      passed: snapshot.catalog?.result.ok === true,
      detail: snapshot.catalog?.result.ok ? `${catalog.length} explicit projects` : 'Stable Result error visible',
    },
    {
      label: 'Structured test report',
      passed: report !== undefined,
      detail: report === undefined ? 'Run npm run test:report' : `${report.numPassedTests ?? 0}/${report.numTotalTests ?? 0} tests passed`,
    },
  ], [catalog.length, health, online, report, snapshot.catalog, snapshot.health])

  const validateRoot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidatingRoot(true)
    const result = await client.validateProjectRoot(rootPath)
    setRootResult(result)
    setValidatingRoot(false)
  }

  const saveDisposable = async () => {
    await client.saveProjectGraph(disposablePortaSplitSnapshot())
    await refresh()
  }

  return <main className="runtime-diagnostics" data-testid="runtime-diagnostics">
    <header className="diagnostics-header">
      <div>
        <p className="diagnostics-kicker">Local Creative OS · Development</p>
        <h1>Runtime Diagnostics</h1>
        <p>检查浏览器、Vite Proxy 与 Local Core，并仅允许写入明确标记的 disposable Phase 2 Lite 元数据。</p>
      </div>
      <div className="diagnostics-header-actions">
        <span className={`online-state ${online ? 'is-online' : 'is-offline'}`}>
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          Local Core {online ? 'Online' : 'Offline'}
        </span>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : undefined} />
          Refresh
        </button>
      </div>
    </header>

    <section className="diagnostics-origin-strip" aria-label="Data source status">
      <span>Canvas data</span><SourceBadge origin="fixture" />
      <span>Diagnostics data</span><SourceBadge origin="runtime" />
      <small>正式 Canvas 仍未迁移；下方 disposable 项目来自 SQLite Runtime。</small>
    </section>

    <div className="diagnostics-grid">
      <section className="diagnostics-panel health-panel">
        <div className="panel-heading"><Server size={18} /><h2>Local Core</h2></div>
        {health ? <dl className="health-grid">
          <div><dt>Service</dt><dd>{health.service}</dd></div>
          <div><dt>Version</dt><dd>{health.version}</dd></div>
          <div><dt>Mode</dt><dd>{health.mode}</dd></div>
          <div><dt>Latency</dt><dd>{snapshot.health?.latencyMs ?? 0} ms</dd></div>
        </dl> : <div className="offline-empty">
          <WifiOff size={22} />
          <strong>Local Core is offline</strong>
          <span>启动 `npm run dev:local-core` 后本页会自动恢复。</span>
        </div>}
        <ErrorCode result={snapshot.health?.result} />
        <p className="panel-time"><Clock3 size={13} /> Last refresh {snapshot.refreshedAt ? new Date(snapshot.refreshedAt).toLocaleTimeString() : '—'}</p>
      </section>

      <section className="diagnostics-panel">
        <div className="panel-heading"><Activity size={18} /><h2>Browser Integration Checks</h2></div>
        <ul className="diagnostics-checks">
          {checks.map((check) => <CheckRow key={check.label} {...check} />)}
        </ul>
      </section>

      <section className="diagnostics-panel catalog-panel">
        <div className="panel-heading"><Database size={18} /><h2>Project Catalog</h2><SourceBadge origin="runtime" /></div>
        <ErrorCode result={snapshot.catalog?.result} />
        {snapshot.catalog?.result.ok && catalog.length === 0
          ? <div className="catalog-empty">Explicit Catalog is empty. No disk scan was performed.</div>
          : <ul className="catalog-list">{catalog.map((project) => <li key={project.id}>
            <strong>{project.name}</strong>
            <code>{project.id}</code>
            <span>{project.rootPath}</span>
          </li>)}</ul>}
      </section>

      <section className="diagnostics-panel root-panel">
        <div className="panel-heading"><FolderCheck size={18} /><h2>Project Root Validation</h2><SourceBadge origin="runtime" /></div>
        <form onSubmit={(event) => void validateRoot(event)}>
          <label htmlFor="root-path">Explicit local directory</label>
          <div className="root-input-row">
            <input
              id="root-path"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder={'E:\\Projects\\PortaSplit'}
              spellCheck={false}
            />
            <button type="submit" disabled={validatingRoot || rootPath.trim() === ''}>
              {validatingRoot ? 'Validating…' : 'Validate'}
            </button>
          </div>
        </form>
        {rootResult?.result.ok && <div className="root-success">
          <Check size={16} />
          <div><strong>Readable directory</strong><code>{rootResult.result.value.normalizedPath}</code></div>
          <span>{rootResult.latencyMs} ms</span>
        </div>}
        <ErrorCode result={rootResult?.result} />
        <p className="panel-note">只执行规范化、目录状态和读取权限检查；不扫描、不创建、不写入。</p>
      </section>

      <section className="diagnostics-panel report-panel">
        <div className="panel-heading"><TestTube2 size={18} /><h2>Structured Test Result</h2></div>
        <ErrorCode result={snapshot.report} />
        {report && <div className="test-report-summary">
          <div><strong>{report.numPassedTests ?? 0}</strong><span>Passed</span></div>
          <div><strong>{report.numFailedTests ?? 0}</strong><span>Failed</span></div>
          <div><strong>{report.numTotalTests ?? 0}</strong><span>Total</span></div>
          <div><strong>{report.numPassedTestSuites ?? 0}/{report.numTotalTestSuites ?? 0}</strong><span>Suites</span></div>
        </div>}
        {report && <details>
          <summary>View read-only JSON</summary>
          <pre>{JSON.stringify(report, null, 2)}</pre>
        </details>}
        <p className="panel-note">报告只由 CLI 生成，网页不能启动测试或执行 Shell。</p>
      </section>

      <section className="diagnostics-panel catalog-panel">
        <div className="panel-heading"><Database size={18} /><h2>Phase 2 Lite Metadata</h2><SourceBadge origin="runtime" /></div>
        <ErrorCode result={snapshot.metadata?.result} />
        <ErrorCode result={snapshot.graph?.result} />
        {metadata && <dl className="health-grid">
          <div><dt>schemaVersion</dt><dd>{metadata.schemaVersion}</dd></div>
          <div><dt>Storage</dt><dd>{metadata.metadataOnly ? 'Metadata only' : 'Unexpected'}</dd></div>
        </dl>}
        {metadata && <code className="database-path">{metadata.databasePath}</code>}
        {graph ? <div className="catalog-empty">
          <strong>{graph.project.name}</strong><br />
          {graph.workspaces.length} Workspace · {graph.artifacts.length} Artifacts · {graph.artifactViews.length} Views · {graph.relations.length} Relation<br />
          Camera {graph.workspaces[0]?.viewport.x}, {graph.workspaces[0]?.viewport.y} · {graph.workspaces[0]?.viewport.zoom}
          <ul className="catalog-list">{graph.artifactViews.map((view) => <li key={view.id}>
            <strong>{graph.artifacts.find((artifact) => artifact.id === view.artifactId)?.title}</strong>
            <span>x {view.position.x} · y {view.position.y} · {view.size.width}×{view.size.height}</span>
          </li>)}</ul>
        </div> : <button type="button" onClick={() => void saveDisposable()}>
          Create disposable PortaSplit metadata
        </button>}
      </section>
    </div>
  </main>
}

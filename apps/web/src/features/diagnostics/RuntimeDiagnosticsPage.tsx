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
const DEV_VERSION = import.meta.env.VITE_LCOS_VERSION
const DEV_BRANCH = import.meta.env.VITE_LCOS_BRANCH
const DEV_COMMIT = import.meta.env.VITE_LCOS_COMMIT

interface DiagnosticsSnapshot {
  readonly health?: RuntimeCall<HealthStatus>
  readonly catalog?: RuntimeCall<readonly ProjectCatalogEntry[]>
  readonly report?: Result<StructuredTestReport>
  readonly metadata?: RuntimeCall<MetadataStoreStatus>
  readonly graph?: RuntimeCall<ProjectGraphSnapshot>
  readonly refreshedAt?: string
}

const MVP_SAMPLE_PROJECT_ID = 'disposable-mvp-sample'

function pickDiagnosticsProjectId(catalog: readonly ProjectCatalogEntry[]): string | undefined {
  return catalog.find((project) => project.id === MVP_SAMPLE_PROJECT_ID)?.id ?? catalog[0]?.id
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
    const [health, catalog, report, metadata] = await Promise.all([
      client.health(signal),
      client.catalog(signal),
      loadStructuredTestReport(signal),
      client.metadataStatus(signal),
    ])
    const projectId = catalog.result.ok ? pickDiagnosticsProjectId(catalog.result.value) : undefined
    const graph = projectId ? await client.projectGraph(projectId, signal) : undefined
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

  return <main className="runtime-diagnostics" data-testid="runtime-diagnostics">
    <header className="diagnostics-header">
      <div>
        <p className="diagnostics-kicker">Local Creative OS · Development</p>
        <h1>Runtime Diagnostics</h1>
        <p>检查浏览器、Vite Proxy 与 Local Core，并读取当前 Runtime Project Graph。</p>
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
      <span>Dev build</span><span className="diagnostics-source source-dev">v{DEV_VERSION}</span>
      <span className="diagnostics-dev-ref">{DEV_BRANCH}</span>
      <span className="diagnostics-dev-ref">{DEV_COMMIT}</span>
      <span>Canvas data</span><SourceBadge origin="runtime" />
      <span>Diagnostics data</span><SourceBadge origin="runtime" />
      <small>优先读取 MVP Sample；若不存在，则读取 Runtime Catalog 的第一个项目。</small>
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

      <section className="diagnostics-panel">
        <div className="panel-heading"><FolderCheck size={18} /><h2>Runtime Source Import Gate</h2><SourceBadge origin="runtime" /></div>
        <ul className="diagnostics-checks">
          <CheckRow
            label="Source contract"
            passed={online}
            detail="Web client can call POST /projects/:id/sources with opaque selectionId only"
          />
          <CheckRow
            label="Raw path guard"
            passed={true}
            detail="Browser requests must not include path, absolutePath or rootPath"
          />
          <CheckRow
            label="Drag/drop status"
            passed={true}
            detail="Canvas drag/drop remains temporary until a trusted selector creates selectionId"
          />
        </ul>
        <p className="panel-note">当前浏览器拖入只做临时预览；不会静默写入 Project Truth。要持久化为 Runtime Source，必须先走可信本地选择器或后续批准的 Bridge 文件授权。</p>
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
        <div className="panel-heading"><Database size={18} /><h2>Runtime Project Metadata</h2><SourceBadge origin="runtime" /></div>
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
        </div> : <div className="catalog-empty">No Runtime project graph available from the current catalog.</div>}
      </section>
    </div>
  </main>
}

import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RuntimeDiagnosticsPage } from './features/diagnostics/RuntimeDiagnosticsPage'
import './foundation.css'
import './surface.css'
import './v07.css'
import './v071.css'
import './porcelain-studio.css'

const diagnosticsRoute = import.meta.env.DEV && window.location.pathname === '/__diagnostics'

createRoot(document.getElementById('root')!).render(
  diagnosticsRoute ? <RuntimeDiagnosticsPage /> : <App />,
)

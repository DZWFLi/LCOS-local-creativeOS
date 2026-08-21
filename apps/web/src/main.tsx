import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RuntimeDiagnosticsPage } from './features/diagnostics/RuntimeDiagnosticsPage'
import { CaptureFloatApp } from './features/capture/CaptureFloatApp'
import './foundation.css'
import './surface.css'
import './porcelain-studio.css'
import './vnext.css'
import './reconstruction.css'
import '../../../opendesign/design-systems/lcos-product/tokens/colors_and_type.css'
import './product-interface.css'
import './interaction-system.css'

const diagnosticsRoute = import.meta.env.DEV && window.location.pathname === '/__diagnostics'
const captureFloatRoute = new URLSearchParams(window.location.search).get('surface') === 'capture-float'

createRoot(document.getElementById('root')!).render(
  diagnosticsRoute ? <RuntimeDiagnosticsPage /> : captureFloatRoute ? <CaptureFloatApp /> : <App />,
)

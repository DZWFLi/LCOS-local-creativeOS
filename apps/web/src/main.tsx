import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RuntimeDiagnosticsPage } from './features/diagnostics/RuntimeDiagnosticsPage'
import './foundation.css'
import './surface.css'
import './porcelain-studio.css'
import './vnext.css'
import './reconstruction.css'
import '../../../opendesign/design-systems/lcos-product/tokens/colors_and_type.css'
import './product-interface.css'

const diagnosticsRoute = import.meta.env.DEV && window.location.pathname === '/__diagnostics'

createRoot(document.getElementById('root')!).render(
  diagnosticsRoute ? <RuntimeDiagnosticsPage /> : <App />,
)

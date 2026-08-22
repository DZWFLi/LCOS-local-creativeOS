import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const webRoot = join(import.meta.dirname, '..', 'src')

describe('Slice E: Artifact Workbench + Viewer Registry', () => {
  it('registers a unified read-only Viewer Registry', () => {
    const registrySrc = readFileSync(join(webRoot, 'features', 'viewer', 'artifactViewerRegistry.tsx'), 'utf8')
    expect(registrySrc).toContain('artifactViewerRegistry')
    expect(registrySrc).toContain('ArtifactViewerHost')
    expect(registrySrc).toContain('resolveArtifactViewerKind')
    expect(registrySrc).toContain('readOnly: true')
    expect(registrySrc).toContain('fallback')
  })

  it('reserves the Editor Host contract without a fake editor', () => {
    const registrySrc = readFileSync(join(webRoot, 'features', 'viewer', 'artifactViewerRegistry.tsx'), 'utf8')
    expect(registrySrc).toContain('ArtifactEditorHost')
    expect(registrySrc).toContain('readOnly: false')
  })

  it('opens the immersive reader on double-click and keeps Workbench for metadata and revisions', () => {
    const appSrc = readFileSync(join(webRoot, 'App.tsx'), 'utf8')
    const dialogs = readFileSync(join(webRoot, 'features', 'shell', 'DialogsHost.tsx'), 'utf8')
    expect(appSrc).toContain('setImmersiveNodeId(id)')
    expect(appSrc).toContain('Workbench remains a')
    expect(appSrc).toContain('if (node.opensScopeId)')
    expect(appSrc).not.toContain('DocumentPreviewDialog')
    expect(dialogs).toContain('<ArtifactWorkbench')
  })

  it('keeps the Workbench a single instance with local nav and Esc close', () => {
    const workbenchSrc = readFileSync(join(webRoot, 'features', 'workbench', 'ArtifactWorkbench.tsx'), 'utf8')
    expect(workbenchSrc).toContain('data-testid="artifact-workbench"')
    expect(workbenchSrc).toContain('preview')
    expect(workbenchSrc).toContain('overview')
    const appSrc = readFileSync(join(webRoot, 'App.tsx'), 'utf8')
    expect(appSrc).toContain('if (workbench) setWorkbench(null)')
  })
})

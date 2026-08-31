import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const drive = read('apps/web/src/features/project/ProjectDrive.tsx')
const assembly = read('apps/web/src/features/assembly/AssemblyCaptureWorkspace.tsx')

const checks = [
  [
    'Project Drive ordinary open consumes same-tab openProject owner',
    app.includes('onOpen: openProject,') && drive.includes('onClick={() => onOpen(project.id)}'),
  ],
  [
    'Assembly project open consumes the same same-tab openProject owner',
    app.includes('onOpenProject: openProject,') && assembly.includes('onDoubleClick={() => onOpenProject?.(project.id)}'),
  ],
  [
    'Legacy default openProjectInNewTab owner is retired',
    !app.includes('openProjectInNewTab') && !app.includes("window.open(url, '_blank', 'noopener')"),
  ],
  [
    'Same-tab open closes Assembly/Capture shell only after a real project is selected',
    app.includes('setCaptureSpaceOpen(false)\n        applyProjectState(projectId, loaded.state)')
      && app.includes('setCaptureSpaceOpen(false)\n    applyProjectState(projectId, next)'),
  ],
  [
    'Project URL remains canonical same-tab /projects/:id route',
    app.includes('`/projects/${encodeURIComponent(activeProjectId)}`')
      && app.includes("window.history.replaceState(null, '', desiredUrl)"),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A07 Project Navigation Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)

import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const moduleUrl = pathToFileURL(path.resolve('apps/web/src/features/spatial/projectColorPinIndex.ts')).href
const { projectColorPinDirectViewId } = await import(moduleUrl)

const definition = { id: 'blue', projectId: 'p', color: '#5A8CFF', createdAt: '1', updatedAt: '1' }
const record = (id, kind = 'view') => ({
  definition,
  membership: { id: `m-${id}`, projectId: 'p', colorPinId: 'blue', targetRef: { projectId: 'p', kind, id }, createdAt: '1', updatedAt: '1' },
  resolution: null,
})

assert.equal(projectColorPinDirectViewId({ id: 'g', colorPinId: 'blue', color: '#5A8CFF', records: [record('view-a')] }), 'view-a')
assert.equal(projectColorPinDirectViewId({ id: 'g', colorPinId: 'blue', color: '#5A8CFF', records: [record('a'), record('b')] }), null)
assert.equal(projectColorPinDirectViewId({ id: 'g', colorPinId: 'blue', color: '#5A8CFF', records: [record('entity-a', 'entity')] }), null)

console.log('A25-7 Color Pin interaction smoke: 3/3 PASS')

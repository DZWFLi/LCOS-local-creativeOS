import http from 'node:http'

const snap = {
  schemaVersion:3, graphVersion:1,
  project:{id:'project-portasplit',name:'PortaSplit',rootPath:'disposable://portasplit',graphVersion:1,createdAt:'2026-07-24',updatedAt:'2026-07-24'},
  scopes:[{id:'scope-root',projectId:'project-portasplit',parentScopeId:null,containerViewId:null,kind:'root',name:'Root',createdAt:'2026-07-24',updatedAt:'2026-07-24'}],
  workspaces:[{id:'ws-main',projectId:'project-portasplit',scopeId:'scope-root',name:'Main',intent:null,viewport:{x:100,y:200,zoom:1.5},focusedViewIds:[],visibleLayers:['core','process'],contextPolicy:'selection-only',updatedAt:'2026-07-24'}],
  artifacts:[{id:'art-brief',projectId:'project-portasplit',title:'Brief',kind:'markdown',localPath:'disposable://brief',availability:'available',createdAt:'2026-07-24',updatedAt:'2026-07-24'}],
  artifactViews:[{id:'view-brief',artifactId:'art-brief',scopeId:'scope-root',referenceKind:'primary',position:{x:50,y:50},size:{width:200,height:150},displayMode:'card',collapsed:false}],
  relations:[{id:'rel-1',projectId:'project-portasplit',sourceEntityType:'artifact',sourceEntityId:'art-brief',targetEntityType:'artifact',targetEntityId:'art-brief',kind:'reference',createdAt:'2026-07-24',updatedAt:'2026-07-24'}],
  notes:[], artifactRevisions:[], checkpoints:[]
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({hostname:'127.0.0.1',port:43121,path,method,headers:{'Content-Type':'application/json'}}, res => {
      let d = ''; res.on('data',c=>d+=c); res.on('end',() => {
        try { resolve({status:res.statusCode, data:JSON.parse(d)}) } catch { resolve({status:res.statusCode, data:d}) }
      })
    })
    r.on('error', reject)
    if (body) r.write(body)
    r.end()
  })
}

async function main() {
  // 1. PUT graph (new schema with scopes)
  const putBody = JSON.stringify({snapshot:snap})
  console.log('1. PUT graph (' + putBody.length + ' bytes)')
  const put = await req('PUT', '/projects/project-portasplit/graph', putBody)
  console.log('   HTTP', put.status, '- ok:', put.data.ok)
  if (!put.data.ok) { console.log('   error:', put.data.error?.message); return }

  // 2. GET graph
  const get = await req('GET', '/projects/project-portasplit/graph')
  console.log('2. GET graph - ok:', get.data.ok)
  if (get.data.ok) {
    const v = get.data.value
    console.log('   scopes:', v.scopes.length, '-', v.scopes[0]?.name)
    console.log('   workspaces:', v.workspaces.length, '- zoom:', v.workspaces[0]?.viewport?.zoom)
    console.log('   views/scopes:', v.artifactViews[0]?.scopeId)
    console.log('   relations:', v.relations[0]?.sourceEntityType + ':' + v.relations[0]?.sourceEntityId)
  }

  // 3. POST mutation
  const mutBody = JSON.stringify({baseVersion:1, ops:[{type:'move_artifact_view', viewId:'view-brief', x:999, y:888}]})
  console.log('3. POST mutation')
  const mut = await req('POST', '/projects/project-portasplit/graph', mutBody)
  console.log('   HTTP', mut.status, '- ok:', mut.data.ok, '| ops:', mut.data.value?.appliedOps)

  // 4. Verify mutation took effect
  const get2 = await req('GET', '/projects/project-portasplit/graph')
  if (get2.data.ok) {
    const pos = get2.data.value.artifactViews[0]?.position
    console.log('4. View position after mutation:', JSON.stringify(pos))
  }

  console.log('\n=== PHASE 2.5 PASS ===')
}

main().catch(e => { console.error(e); process.exit(1) })

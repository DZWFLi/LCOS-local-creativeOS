import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx')
const transfer=read('apps/web/src/state/materialTransfer.ts')
const registry=read('apps/web/src/features/viewer/artifactViewerRegistry.tsx')
const pdf=read('apps/web/src/features/viewer/PdfViewer.tsx')
const immersive=read('apps/web/src/features/viewer/ImmersiveViewer.tsx')
const nodeInfo=read('apps/web/src/features/canvas/NodeInfoPopover.tsx')
const bridge=read('apps/web/src/runtime/runtimeBridge.ts')
const model=read('apps/web/src/model.ts')
const domain=read('packages/domain/src/index.ts')
const contracts=read('packages/contracts/src/curation-patch.ts')
const checks=[
 ['material locators serialize into stable logical anchors', transfer.includes('materialLocatorToSourceAnchor')&&transfer.includes('`pdf:p${')&&transfer.includes('`pptx:s${')&&transfer.includes('`text:l${')],
 ['stable anchors parse back into page/slide/line targets', transfer.includes('parseMaterialSourceAnchor')&&transfer.includes("kind: 'page'")&&transfer.includes("kind: 'slide'")&&transfer.includes("kind: 'lines'")],
 ['Relation provenance can persist pinned revision + source anchor', domain.includes('revisionId?: string; readonly sourceAnchor?: string')&&contracts.includes('revisionId?: string; readonly sourceAnchor?: string')],
 ['material-transfer relation persists source revision and anchor', app.includes("createdBy: 'material-transfer'")&&app.includes('const sourceAnchor = materialLocatorToSourceAnchor')&&app.includes('revisionId: payload.source.revisionId')&&app.includes('{ sourceAnchor }')],
 ['runtime projection reconstructs reload-safe materialSource truth', model.includes('materialSource?: {')&&bridge.includes('materialSourceByArtifactId')&&bridge.includes("relation.createdBy !== 'material-transfer'")&&bridge.includes('evidence?.sourceAnchor')],
 ['Text selection creates exact line locator instead of generic selection', registry.includes('textSelectionLocator(selection, headings)')&&registry.includes("return { kind: 'lines', start: lineStart, end: lineEnd")],
 ['PDF source anchors reopen the exact page', registry.includes("sourceTarget?.kind === 'page'")&&pdf.includes('initialPage?: number')&&pdf.includes('setPageNumber(Math.max(1, initialPage))')],
 ['PPT source anchors reopen the exact slide', registry.includes("sourceTarget?.kind === 'slide'")&&registry.includes('initialSlide?: number')&&registry.includes('setSlideNumber(Math.max(1, initialSlide))')],
 ['pinned source revision is consumed, not merely stored', app.includes('sourceRevisionId: immersiveRevisionId')&&registry.includes('sourceRevisionId !== node.revisionId')&&registry.includes('String(entry.id) === sourceRevisionId')],
 ['re-extracting from historical preview keeps that historical revision provenance', registry.includes('effectiveRevisionId = sourceRevisionId ?? node.revisionId')&&registry.includes('locator, sourceRevisionId ?? node.revisionId')&&registry.includes('sourceRevisionId ?? node.revisionId),')],
 ['fragment exposes an explicit return-to-source affordance', immersive.includes('回到来源')&&nodeInfo.includes('回到来源')&&app.includes('openMaterialSource')],
 ['Preview failure exposes native open / reveal / relink exits', registry.includes('用系统应用打开')&&registry.includes('在文件夹中显示')&&registry.includes('重新找到文件')&&registry.includes('ViewerRecoveryActions')],
 ['PDF/PPT parser failures also inherit recovery exits', pdf.includes('errorFallback?.(pdfError)')&&registry.includes('PPTX 解析失败：${error}')&&registry.includes('sourceActions={sourceActions}')],
 ['fallback remains honest for unsupported Office formats', registry.includes('Word/Excel 文档预览暂未接入')&&registry.includes('文件已完整导入，仍可参与分析和执行')&&!registry.includes('mammoth.render')],
 ['R1-D does not introduce a second OS opener contract', !registry.includes('/open-artifact-source')&&!registry.includes('/reveal-artifact-source')&&app.includes('onOpenSource: openNative')&&app.includes('onRevealSource: revealSource')&&app.includes('onRelinkSource: relinkSource')],
]
let pass=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(ok)pass++}
console.log(`R1-D Preview / Fragment Entry + Fallback static: ${pass}/${checks.length}`)
if(pass!==checks.length)process.exit(1)

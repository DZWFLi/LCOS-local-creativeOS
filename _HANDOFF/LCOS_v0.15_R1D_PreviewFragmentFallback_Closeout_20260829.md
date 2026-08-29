# LCOS v0.15 · R1-D Preview / Fragment Entry + Fallback · Closeout · 2026-08-29

## 0. Baseline / patch boundary

- supplied RC: `7f0690d`
- R1-B Human Language Gate: already applied
- R1-C Unified Composer: already closed and treated as immutable baseline
- this patch is **R1-D incremental only**
- no R2 Pointer/Cursor work and no R3-D Assembly morphology work is pulled forward

## 1. Product question closed

R1-D closes one question:

> Can a real Project file be previewed, sliced into a usable Fragment, reloaded later with its source location intact, returned to the exact source context, and still have a usable exit when LCOS cannot render it?

The answer in this patch is **yes for the protected 0.15 Golden formats: PDF / PPTX / Text/Markdown**, with honest fallback for unsupported formats.

The resulting path is:

```text
Real Artifact
→ LCOS Preview / Reader
→ page / slide / line Fragment
→ material-transfer Artifact
→ persisted provenance Relation
→ reload-safe source Artifact + pinned Revision + logical Anchor
→ return to source
→ Reference / Selection / Glyth / Composer use
```

Unsupported rendering remains:

```text
LCOS Preview unavailable/failed
→ open with system app
→ reveal in folder
→ relink source
```

No second OS opener service is introduced.

## 2. Main gap found and closed: Fragment provenance was not durable

PDF / PPTX / Text extraction UI already existed before R1-D, but material-transfer only persisted a generic `reference` Relation between the extracted Artifact and its source Artifact.

The transfer payload already knew page / slide / line location and source Revision, but `saveMaterialReference()` dropped that information. After reload LCOS could therefore answer only “this Fragment came from this file”, not “this Fragment came from page 7 / slide 3 / lines 42–51 of this Revision”.

R1-D keeps the existing Relation truth and extends its evidence provenance with optional:

- `revisionId`
- `sourceAnchor`

No Fragment table or second provenance store is created.

Logical anchors are deliberately path-independent:

```text
PDF          pdf:p7
PPTX         pptx:s3
Text         text:l42-l51
Markdown     section:<heading>   (parser support retained)
```

Physical file paths are not encoded into the anchor.

## 3. Reload-safe source return

`runtimeBridge` now reconstructs `CanvasNode.materialSource` from canonical `material-transfer` Relations.

The projection retains:

- source Artifact ID
- source View when available
- pinned source Revision
- logical source Anchor
- human source title

A Fragment now exposes `回到来源` from both immersive reading and Node Info.

Returning to source opens the original Project Artifact at the stored logical location:

- PDF → exact page
- PPTX → exact slide
- Text/Markdown → exact line range / section

When the provenance pins an older Revision, Reader resolves that Revision's file record rather than silently reading today's Current Revision.

A second-order bug was also closed: if the user returns to a historical Revision and extracts another Fragment, the new Fragment inherits the Revision actually being viewed instead of incorrectly recording the source node's current Revision.

## 4. Protected Fragment Golden paths

### 4.1 PDF

Kept existing true PDF rendering, page rail and whole-page drag extraction.

Added/closed:

- source-anchor entry to exact page
- selection extraction retains page provenance
- PDF parser/render failure receives the same source recovery exits

### 4.2 PPTX

Kept existing slide rendering, thumbnails, whole-slide drag extraction and text selection.

Added/closed:

- source-anchor entry to exact slide
- selection extraction retains slide provenance
- parser failure receives source recovery exits

### 4.3 Text / Markdown

Kept existing direct Reader, search and text selection.

Closed a false-Golden gap in the floating Selection Drop Handle: it previously emitted a generic `selection` locator even though the copy path could calculate line numbers.

Now both copy and click/drag extraction derive exact line provenance from the selected DOM rows. Source return scrolls back to the recorded line range (or section anchor).

## 5. Preview fallback closes through existing Core APIs

Existing Core/Web actions already existed:

- `openArtifactSource`
- `revealArtifactSource`
- `relinkArtifactSource`

R1-D does not create another opener or platform service.

Preview failures and honest unsupported-format fallback now surface user-facing exits:

- `用系统应用打开`
- `在文件夹中显示`
- `重新找到文件` → `重新链接`

This applies to fetch failures and PDF/PPT parser failures as well as unsupported Viewer fallback.

DOCX/XLSX remain intentionally honest fallback in v0.15. No fake renderer and no new heavy dependency is introduced in this micro-patch.

## 6. Contract / storage compatibility

The Relation evidence extension is optional and backward-compatible:

```ts
evidenceRefs?: [{
  kind,
  id,
  label?,
  revisionId?,
  sourceAnchor?,
}]
```

The existing Local Core Relation JSON persistence already round-trips `evidenceRefs`; therefore no metadata DB schema bump is required for R1-D.

Old Relations without the new fields continue to project normally; they simply cannot deep-link to an exact historical source location.

## 7. Gates / validation

Current static and compatibility results:

```text
R1-D Preview / Fragment Entry + Fallback     15/15 PASS
R1-C Unified Command State                   12/12 PASS
Unified Composer F6B                         13/13 PASS
Cross-Surface Unified Execution F6B           8/8 PASS
Conversation Subcanvas F6B                   12/12 PASS
ResultSlot F6B                               12/12 PASS
Spatial Component Foundation                 22/22 PASS
v0.15 User Language Gate                     PASS (229 product-surface files)
Modified TS/TSX transpile diagnostics        11/11 PASS
materialTransfer pure TypeScript check       PASS
git diff --check (CRLF-aware)                PASS
```

Existing baseline debt remains unchanged:

```text
Assembly Source Bay F6A2                      9/10
```

The failing item is the same stale `Sources does not fake provider-native data with Project resources` string gate already documented in the R1-C closeout. R1-D does not rewrite an unrelated historical gate to manufacture a green number.

This sandbox has no workspace `node_modules`. Therefore full dependency-backed `lint / typecheck / test / build` is **not claimed**. Global TypeScript transpile diagnostics and the dependency-free targeted checks above are the available code validation here.

## 8. R1-D status

**Code-complete + R1-D static-Golden complete.**

The old “Fragment extraction exists, therefore Fragment provenance is done” assumption is no longer accepted. Reload/source-return is now part of the R1-D Done boundary.

## 9. Next official micro-patch

`R2-A · Marker Core ↔ Web Bridge`

Carry-forward from the recovered R2 plan:

- canonical Web marker client contract
- consume durable Marker Intent from Core
- do not fork a frontend-only Marker store
- keep automatic Glyth far-LOD for R2-B
- keep Colony overview / rail landmark / Agent mark proposal consolidation for R2-C
- keep Reference Pick / Relation / durable Glyth mapping + Pointer semantic grammar for R2-D / GUI Visual Pass

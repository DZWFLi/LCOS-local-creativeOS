# LCOS v0.15 · W0-2 Recoverable Raw Source Ledger Repair Closeout

Date: 2026-09-01  
Status: **PASS / PROVENANCE REPAIR ONLY**

---

# 0. Proposition

> Stop treating recoverable source documents as permanently lost; recover exact repo-local bytes where already available, preserve the historical loss event, and never fabricate missing originals from search excerpts.

---

# 1. Work completed

## Exact local recovery

Recovered from existing Context Library bytes into canonical `convergence/original/` names:

```text
LCOS v0.15 GUI 感知层重构与前端施工规划.md
LCOS v0.15 UX 架构第二轮收口与施工清单.md
LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md
LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md
```

All four SHA-256 values match the existing Context Library manifest.

## LS-001 correction

Old current claim:

```text
8/21 v0.3 = permanently RAW_SOURCE_LOST
```

Current evidence:

```text
8/21 v0.3 exact-name File Library object exists again
→ RAW_SOURCE_RECOVERED_EXTERNAL
→ LOCAL_VENDOR_PENDING
```

The 2026-08-31 loss event remains historical provenance.

No excerpt was turned into a fake `convergence/original` file.

## Other external recovery evidence

File Library also locates:

```text
LCOS_三工作现场_通用Glyph_项目承接_Git协作_基于最新仓库实施规划_20260821.md
LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md
```

Exact repo-local vendoring remains pending.

## Still unresolved

```text
LCOS_三大视图组件体系筛选表_v01_20260821.md
```

No exact source recovered in W0-2.

---

# 2. Files

Added:

```text
docs/v015/convergence/RECOVERED_SOURCE_PROVENANCE_20260901.md
docs/v015/convergence/W0_2_RECOVERABLE_RAW_SOURCE_LEDGER_REPAIR_CLOSEOUT_20260901.md
scripts/validate-v015-w0-2-recovered-source-ledger.mjs

docs/v015/convergence/original/LCOS v0.15 GUI 感知层重构与前端施工规划.md
docs/v015/convergence/original/LCOS v0.15 UX 架构第二轮收口与施工清单.md
docs/v015/convergence/original/LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md
docs/v015/convergence/original/LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md
```

Updated:

```text
docs/v015/convergence/LOST_SOURCE_PROVENANCE_LEDGER_20260831.md
docs/v015/convergence/ORIGINAL_SOURCE_ADJUDICATION_INDEX_20260831.md
docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md
docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md
docs/v015/context-library/MANIFEST.md
docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md
```

---

# 3. Validation

Required dedicated gate:

```text
node scripts/validate-v015-w0-2-recovered-source-ledger.mjs
```

Legacy reconstructed-authority gate must remain green:

```text
node scripts/validate-v015-sop-r1-reconstructed-authority.mjs
```

---

# 4. Acceptance

- [x] exact local recoverable authorities copied byte-for-byte;
- [x] manifest SHA-256 verified;
- [x] LS-001 historical loss preserved;
- [x] LS-001 current state corrected to external recovery;
- [x] no snippet-as-original fabrication;
- [x] unresolved screening-table provenance remains explicit;
- [x] Mandatory + Construction Index + rolling ledger updated;
- [x] no product/runtime code changed.

---

# 5. STOP / next proposition

W0-2 changes provenance only.

Next:

**W0-3 · Fresh source/runtime census at A23 line**

Audit actual production owners for:
- Voice / ASR seams;
- Pin / Focus / Search / Centered Spatial Index;
- safeInsets / Minimap / edge-scroll / overlay geometry;
- current Browser/Human runnable environment.

---

# 6. Actual gate results

```text
W0-2 Recovered Source Ledger Gate: 17/17 PASS
SOP-R1 Reconstructed Authority Gate: 8/8 PASS
```

No product/runtime code was changed in W0-2.

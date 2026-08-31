# LCOS v0.15 · SOP-R1 Raw Source Lost / Reconstructed Authority Closeout

日期：2026-08-31
状态：**PASS / FROZEN PROCESS ADDENDUM**

Product/process proposition:

> Mandatory raw source 的 FULL READ 仍是默认门禁；但当原始文件已经被确认永久丢失时，施工不得永久停摆，也不得用 snippet 冒充全文。必须通过可审计的多源权威重建 Gate 决定是否继续。

---

# 0. Verdict

```text
SOP-R1 = PASS
RAW_SOURCE_LOST exception = ACTIVE
Fabricated original = FORBIDDEN
Snippet-as-full-read = FORBIDDEN
Conflict = USER_ARBITRATION_REQUIRED / STOP
Insufficient reconstruction = STOP
```

---

# 1. Latest user adjudication

2026-08-31 用户明确确认：

- 8/21 v0.3 原稿对应历史会话可以搜索到，但全文缓存已经无法恢复；
- Main / Context / Workflow、Shared Spatial Kernel、Surface Components、Context/Workflow 语义、Conversation Receiver/Handoff 等当前定义可以通过后续详细施工、Freeze、差分审计和当前源码交叉验证；
- 不再允许一个已经消失的 raw source 永久阻塞施工；
- 授权更新 SOP，并正式落 A13。

该裁决按 Truth Priority 属于最新 L0。

---

# 2. New Gate

```text
raw source available
→ FULL READ

raw source permanently lost
→ RAW_SOURCE_LOST
→ Provenance Ledger
→ surviving upstream/peer originals
→ downstream explicit Freeze / L0
→ delta audit
→ current code/test owner
→ latest user adjudication
→ RECONSTRUCTED_AUTHORITY PASS / STOP
```

PASS 不意味着恢复了 verbatim original；只意味着当前施工域的产品 truth 有足够独立证据。

---

# 3. LS-001 adjudication

Lost source:

`LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

Judgment:

```text
RAW_SOURCE_LOST = YES
SOLE PRODUCT AUTHORITY = NO
CURRENT PRODUCT TRUTH RECONSTRUCTABILITY = HIGH
A13 IMPACT = VERY LOW
A13 BLOCKER = NO
RECONSTRUCTED_AUTHORITY = PASS
```

The surviving authority chain is recorded in `LOST_SOURCE_PROVENANCE_LEDGER_20260831.md`.

---

# 4. Files changed

```text
MOD docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md
MOD docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md
MOD docs/v015/convergence/ORIGINAL_SOURCE_ADJUDICATION_INDEX_20260831.md
MOD docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md
ADD docs/v015/convergence/LOST_SOURCE_PROVENANCE_LEDGER_20260831.md
ADD docs/v015/convergence/SOP_R1_RAW_SOURCE_RECONSTRUCTED_AUTHORITY_CLOSEOUT_20260831.md
ADD scripts/validate-v015-sop-r1-reconstructed-authority.mjs
```

---

# 5. Acceptance

- [x] available raw sources still require FULL READ;
- [x] snippet/summary cannot impersonate original full read;
- [x] raw-source loss must be explicit and auditable;
- [x] reconstruction requires independent upstream/downstream/current evidence;
- [x] conflict requires user arbitration;
- [x] insufficient evidence still stops construction;
- [x] reconstructed authority cannot override later explicit Freeze/L0;
- [x] provenance debt is retained even if construction proceeds;
- [x] 8/21 v0.3 is registered as LS-001 rather than silently deleted or falsely reconstructed.

---

# 6. STOP

SOP-R1 modifies construction process only. It does not itself implement A13 or authorize Phase B.

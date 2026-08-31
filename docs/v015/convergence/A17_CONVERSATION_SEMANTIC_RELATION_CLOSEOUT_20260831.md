# LCOS v0.15 · A17 Conversation Semantic Relation Closeout

Date: 2026-08-31
Proposition: **Conversation Glyth participates in ordinary Project Semantic Relation only through its canonical Conversation Artifact identity; Conversation Context Mapping remains a separate Semantic Drop / `conversation_context` truth.**

---

# 0. Verdict

```text
Authoritative real local baseline HEAD: 0691812
Exact uploaded 0691812 source snapshot mounted/read: PASS
A17 Source-Diff Gate: PASS
A17 source/static implementation: PASS
A17 dedicated validator: 15/15 PASS
Full runnable v0.15 static sweep: 45 PASS / 0 FAIL / 2 SKIP
Changed TS/TSX/E2E syntax transpile: 5/5 PASS
A17 exact cold apply: PASS
Full semantic typecheck in extracted archive: BLOCKED_ENV (no node_modules)
Browser E2E: BLOCKED_ENV / NOT EXECUTED
Human Product Smoke: BLOCKED_ENV / NOT EXECUTED
A17 source/static merge authorization: YES
Phase A complete: NO
Phase B admission: NO
```

The uploaded archive does not contain `.git`, so the Git lineage itself remains established by the user's local merge report. Unlike the earlier transient mount failure, the **exact source bytes of the uploaded `0691812` RC are now available and are the construction base for A17**.

---

# 1. Source-Diff Gate

## 1.1 Latest L0 physical grammar

`MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md` explicitly freezes:

```text
Glyth Orbit:
- Speak / Enter
- Relation
- Pin
- Set Current
- Assembly / More
```

and Relation:

```text
Select
→ Orbit
→ Relation
→ Orbit yields
→ source port
→ receptive target + 12–18px screen-space halo
→ commit
```

The current `0691812` Main Conversation Orbit still spends its fifth satellite on read-only `conversation-status` and has no Relation action. That is a direct implementation gap against the latest L0.

## 1.2 Semantic proof

Later Conversation/Glyth freezes distinguish two different truths:

```text
Project Semantic Relation
= ordinary durable semantic relation between Project objects

Conversation Context Mapping
= material/context binding into a Conversation
= body / Semantic Drop → Glyth
= `conversation_context` / Context Field truth
= NOT ordinary Relation
```

Current Core/runtime also provides the structural identity chain:

```text
ConversationSession
→ conversationArtifactId
→ conversationViewId
→ real ArtifactView-backed CanvasNode
```

and Domain Relation already supports `artifact` endpoints.

Therefore ordinary Conversation Project Semantic Relation resolves to:

```text
artifact:<conversationArtifactId>
```

not:

```text
conversationViewId
connectedConversationId
activeReceiverId
provider/title/time guesses
```

`conversationViewId` remains the physical projection identity. Receiver identity remains execution/handoff truth. Conversation Context Mapping remains its own `conversation_context` path.

## 1.3 Classification

```text
PREVIOUS FAIL-CLOSE = CORRECT WHILE SEMANTICS UNPROVEN
SEMANTIC OWNER NOW PROVEN = YES
IMPLEMENTATION_GAP = YES
NEW PRODUCT INVENTION = NO
```

---

# 2. Implementation

## 2.1 Canonical endpoint resolver

`projectRelationEndpointForNode()` now supports:

```text
Conversation CanvasNode + conversation.conversationArtifactId
→ { entityType: 'artifact', entityId: conversationArtifactId }

Conversation CanvasNode without conversationArtifactId
→ null / fail-close
```

This preserves A16's fail-close discipline while admitting only the proven canonical identity.

## 2.2 Main Glyth Orbit

The obsolete read-only status satellite is retired.

Main Conversation Orbit now follows the latest L0 priority as closely as available owners allow:

```text
Enter
Relation
Pin
Current / Set Current
Locate
```

Relation is emitted only when the selected Glyth's real Conversation projection carries `conversation.conversationArtifactId`.

```text
Glyth Orbit → Relation
→ existing beginRelationIntent(viewId)
→ Orbit yields
→ existing temporary Main source port
```

Main edge geometry still uses the physical Conversation ArtifactView id. A17 does not move Main persistence into Domain Relation.

## 2.3 Main Glyth target

A17 does not restore generic `[data-node-id]` targeting.

Instead it adds one explicit Glyth receptor:

```text
[data-node-id]
[data-entity-kind="conversation"]
[data-conversation-artifact-id]
```

using A15's existing 16px screen-space halo helper. A Conversation without canonical Artifact identity is therefore not admitted as a target.

The old pointer block that swallowed Conversation while Relation was active is removed.

## 2.4 Context / Workflow

A13 already owns shared physical Project-material Relation gesture.
A16 already makes eligibility resolver-driven.

Therefore, once the canonical resolver proves a Conversation Artifact endpoint, `SurfaceObject` no longer suppresses Conversation Orbit. It reuses the capability-filtered shared `ProjectObjectOrbit` shell on Context / Workflow; only actions whose real callbacks exist are emitted. Relation therefore becomes a real source action without inventing a second Conversation state owner.

```text
Context / Workflow Glyth
→ select → local Orbit → Relation
→ same A13 physical gesture
→ A16 physical node lookup
→ artifact:<conversationArtifactId>
→ existing Surface-provenance saveRelation
```

Workflow Step→Step action linking remains separate.

---

# 3. Explicit non-goals

A17 does **not**:

- alter ConnectedConversation / ActiveReceiver identity;
- alter Conversation Context Mapping;
- turn `conversation_context` into a visible ordinary edge;
- use `conversationViewId` as Domain Relation truth;
- invent a generic `connect()` ontology;
- merge Main CanvasEdge, Domain Relation, or Workflow Step-link persistence;
- add Assembly/More plumbing merely to fill an Orbit slot;
- start Phase B morphology work.

---

# 4. Runtime acceptance required after local merge

Minimum Human Product Smoke:

```text
Main source:
Select Glyth
→ Orbit contains Relation
→ Relation
→ source port
→ ordinary target
→ commit

Main target:
ordinary object → Relation
→ approach/click conversationArtifact-backed Glyth body or 16px halo
→ receptive
→ commit

Fail-close:
Conversation projection without conversationArtifactId
→ no Relation capability / no persistence

Context / Workflow:
conversationArtifact-backed Glyth ↔ eligible Project object
→ commit
→ save
→ reload
→ Domain Relation survives as artifact endpoint

Separation:
Artifact body/Semantic Drop → Glyth
→ Conversation Context Mapping
→ NOT ordinary Relation
```

Browser E2E and Human Smoke remain required before Phase A close.

---

# 4.1 Source/static evidence executed on exact 0691812 source

```text
A17 dedicated validator                15/15 PASS
A13 regression                         12/12 PASS
A14 regression                         10/10 PASS
A15 regression                         12/12 PASS
A16 regression                         16/16 PASS
Native Visual corrected stale status   14/14 PASS
full runnable validate-v015-*          45 PASS / 0 FAIL / 2 SKIP
  SKIP: S9 / S10 external semantic/provider gates
changed TS/TSX/E2E transpile           5/5 PASS
git diff --check                       PASS (CRLF-aware)
exact 0691812 git apply --check       PASS
exact 0691812 cold apply               PASS
post-apply full static sweep            45 PASS / 0 FAIL / 2 SKIP
```

The Native Visual gate previously required `conversation-status`; that assertion was corrected because latest L0 explicitly assigns the scarce Glyth Orbit slot to Relation and treats Lifecycle/status as body/HUD state rather than a high-frequency satellite. This is test-truth supersession, not a product workaround.

Full semantic typecheck was attempted in the extracted archive and is:

```text
BLOCKED_ENV
TS2688: missing `node` type definitions
TS2688: missing `vite/client` type definitions
```

The user's real `0691812` dependency environment previously passed full typecheck and units. Those baseline results are provenance only and are **not** reused as post-A17 evidence.

---

# 5. Phase boundary

A17 closes the last **known source/static Conversation Relation semantic debt** from the A12–A16 Relation sequence.

It does not close Phase A by itself.

After real local A17 merge, the next action is a fresh Phase A runtime/parity census. Do not name A18 in advance. Do not admit Phase B until runtime evidence and the fresh census say so.

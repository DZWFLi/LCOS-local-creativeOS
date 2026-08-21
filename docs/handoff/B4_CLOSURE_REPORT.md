# B4 Closure Report — Attention + Intent Runtime

## Status

**Implementation / contract closure: PASS**  
**Executable no-dependency runtime smoke: PASS**  
**Full dependency-backed verification in this sandbox: BLOCKED by dependency installation timeout**

B4 已从“Agent Attention 设想”推进成 Local Core 的实际 Runtime：WorkState → Intent → Attention Evidence → Continuity Candidates → Progressive Context Pack → Skill / Target proposal。

## B4.0 WorkState / Recent Delta

直接扩展现有 ActiveContextStore，没有新增第二数据库：

- currentSurface
- currentHarness
- selected / pinned / excluded / locked
- explicitIntent
- dismissedContinuityKeys
- recentDelta projection
- Open Loop projection
- semanticFingerprint

semanticFingerprint 排除 viewport-only / candidate-only 噪声，避免用户拖 Camera 就重跑模型。

## B4.1 Intent Resolution

顺序：

```text
Explicit Intent
→ deterministic high-confidence rules
→ provider model for ambiguous state
→ deterministic fallback
```

结构输出包含 type / goal / constraints / expectedOutput / evidence / confidence / provider/model provenance。

用户修正 Intent 会回写 WorkState；模型不可用不阻塞 B4。

## Multi-provider intelligence

实现 provider / model / role 三层分离：

- roles: utility / chat
- protocols: OpenAI Responses, OpenAI Chat-compatible, Anthropic Messages, Gemini native, Azure OpenAI, Ollama
- DeepSeek 是一等 preset
- 另有多家主流 cloud/API presets 与 generic OpenAI-compatible endpoint
- preferred provider 失败时继续同 role 的 provider fallback chain
- 全部 provider 失败才回 deterministic rules
- key 只留 Local Core 环境边界，状态接口脱敏

## B4.2 Attention Evidence

Evidence providers 基于已有 LCOS Truth：

```text
Selected
Pinned / Locked
Explicit Relation
Workflow Requirement
Same Context
Same Collection
Same Scene
Recent Delta
Spatial Neighbourhood
Semantic Retrieval
```

冻结：

- Explicit > inferred
- Relation / structural locality > pure spatial
- Spatial proximity is evidence, not truth
- no fixed radius membership
- Hover 不写 persisted Attention

## Huabu 化用

化用：
- edge-to-edge spatial distance
- local grouping / arrangement thinking
- preview-first / read-on-demand
- structured provenance

拒绝：
- Frame / Grandframe ontology
- Agent Node 唯一 anchor
- `2000px = Related`
- Huabu persistence / ReactFlow ownership

## B4.2B Attention projection

同一份 Selected / Pinned / Related / Retrieved 来源投影到 Arrange / Context / Workflow。

Native Selection 保持最强视觉态；Pinned / Related / Retrieved 只是 Presentation marks，不写 Project Truth。

## B4.3 Continuity Candidates

候选类型：
- Resume
- Resolve
- Review
- Explore（无强信号才使用）

候选基于 WorkState / Intent / Open Loops / Attention，并支持“稍后” suppression。viewport-only 改变不会让候选无意义重排。

## B4.4 Progressive Context Composer

读取层：
- L0 Identity
- L1 Preview
- L2 Focused Content
- L3 Full Content

Selected/Pinned 必选；Related 与 Retrieved 进入同一 optional budget 按 evidence strength 竞争，避免弱空间邻居挤死强 Intent retrieval。

保留来源 bucket / provenance / reason / token estimate。

## B4.5 Skill / Target / Side-effect routing

Intent + WorkState + currentHarness → Skill / target proposal。

side-effect classes：
- READ_ONLY
- PREPARE
- LOCAL_MUTATION
- EXTERNAL_ACTION
- DESTRUCTIVE

B4 只自动做理解 / 准备，不自动执行 mutation。`LOCAL_MUTATION+` 必须 explicit approval，真正 ChangeSet 执行留 B5/C0。

## Runtime verification

### AttentionRuntime executable smoke — PASS
- ambiguous state → model Intent `revise`
- provider provenance = DeepSeek test provider
- explicit Relation outranks spatial
- same Scene outranks spatial
- pure spatial candidate remains spatial evidence
- semantic retrieval survives model Intent path
- Retrieved enters bounded Context Pack
- token budget respected
- viewport-only state keeps semantic fingerprint and model cache
- semantic Selection change reruns Intent

### Provider executable smoke — PASS
- DeepSeek / OpenAI-chat compatible path
- Responses strict JSON schema path
- Responses `store:false`
- no forced `temperature` on Responses
- secret absent from status
- provider failure → next configured utility provider

## Static closure

B4 static: 19/19.

All A4→B4 static contracts total: **119/119 PASS**.

## Environment-limited verification

`npm ci` timed out and did not create `node_modules`. Full Vitest / Playwright / lint / workspace typecheck / build must be rerun on the real development machine. Any failure reopens B4 Closure.

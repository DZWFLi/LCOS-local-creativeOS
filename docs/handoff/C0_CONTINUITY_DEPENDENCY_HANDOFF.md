# C0 Continuity Dependency Handoff

After remaining B reliability work, C0 should connect B4 to real session continuity.

## Inputs already ready
- WorkStateSnapshot
- semantic fingerprint
- Intent
- Attention buckets
- Context Pack
- Continuity Candidates
- utility/chat provider roles
- currentHarness hint
- Skill / Target proposal

## C0 sequence
1. Project Resolver / structured binding
2. Session Binding / Resume
3. Companion Continuity Loop
4. Minimal Harness Adapter
5. Minimal Return Loop
6. Browser → LCOS Capture only

Target loop:

```text
Resolve Project
→ Resume Scene / WorkState
→ Intent
→ Attention
→ Context Pack
→ Skill / Target
→ Attach to current Agent
→ Return Insight / Artifact
→ Persist
```

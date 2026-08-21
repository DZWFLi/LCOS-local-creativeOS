# LCOS Skill V4.3 · PASS8 Inheritance Implementation Handoff

**Baseline**: `LCOS_FULLSTACK_DESKTOP_CAPTURE_BASELINE_PASS8_20260818`  
**Input Bundle**: `LCOS_SKILLS_PASS8_UPGRADE_BUNDLE_20260818`  
**Principle**: 先继承，再扩展；已有真实能力不重写。

## Completed in this upgrade bundle

### Skill spec / install truth

- `SKILL_SPEC v1 → v2`：支持 Simple / Indexed Skill、5K overhead discipline、Saved vs Active Context、managed/user install boundary。
- 新增 `packages/skills/managed-skills.json`。
- installer 改为从 manifest 读取 7 个 managed skills，消除 index/installer 双真相。
- `packages/skills/index.md` 收敛全部 7 个 Skill 的 managed 状态与角色边界。
- 新增 `scripts/validate-lcos-skills.mjs`。

### Project Context

- 保留 PASS8 bind → ActiveContext → AgentExecutionPlan → validate → Run 主链。
- 新增 `saved-context-boundary.md`。
- 冻结：Saved Context 由 Curator 管，ActiveContext/ContextManifest 由 Project Context 管。

### Curator V2.1

保留：resolver / index / conditional load / budget / SkillTrace / no-Run / search-first。

新增 routes：

```text
context_build
context_edit
workflow_build
workflow_edit
filesystem_organize
handoff_continue
```

新增 policies / recipes / diagnostics：

```text
capability-gate
surface-identity
review-change
filesystem-safety
context-from-selection
context-to-workflow
filesystem-plan
handoff-pack
verify-context
verify-workflow
verify-filesystem-plan
verify-handoff
```

### Huabu-style reorganize

没有新建平行 layout subsystem。

现有：

```text
ReorganizeProposal → ghost → accept → apply → snapshot/rollback
```

升级目标：

```text
Presentation ChangeSet → current Surface pending review → Keep/Revert → finalize
```

Skill 明确 capability-gated；当前 Core 没 live review 就走 PASS8 fallback。

### Skill Author

- 支持 Simple / Indexed 两种结构。
- 保留七段法。
- 增加 capability truth、eval、controlled promotion。
- managed system Skill 与普通 user-authored Skill 分离；普通用户 Skill 不默认写 `packages/skills`。

### LCOS self-maintenance

没有新建 `lcos-system-maintainer` 平行 Skill。

- `local-creative-os-backend-flow` 升级为 System / Backend Maintenance Kernel。
- `local-creative-os-frontend-loop` 保留为 Frontend Specialist，并把旧 Make-era 产品冻结移入 legacy reference。
- 当前 GUI 规则改为 Entity First、Search/Focus 分离、临时 Reader、自由 Main Canvas、Context/Workflow 差异、Huabu review。

### WorkBuddy

- Root 从 PASS8 大型机器说明收成 <3KB。
- protocol/bootstrap/instruction/Feishu 分文件按需加载。
- PASS8 原完整 Root 留 `legacy-pass8-root.md`，只用于迁移/旧机器排障。

## New architecture tests included

```text
tests/architecture/lcos-skill-spec-v2-contract.test.ts
tests/architecture/lcos-project-curator-v43-contract.test.ts
tests/architecture/lcos-dev-skill-contract.test.ts
```

同时更新：

```text
tests/architecture/lcos-skill-author-contract.test.ts
```

PASS8 原 `lcos-skill-contract.test.ts` 保留。

## Local bundle validation already run

```text
node --check scripts/install-lcos-codex-skill.mjs
node --check scripts/validate-lcos-skills.mjs
node scripts/validate-lcos-skills.mjs
```

结果：7/7 managed root Skill 均 <6KB；frontmatter 完整；Curator index 引用存在；managed index 漂移已收敛。

## Must be done after syncing into full PASS8 repo

### Gate A · Capability census

对 6 条 Curator 新 Route：

```text
Contract
→ Core route/service
→ CLI / MCP
→ GUI/review surface（如果需要）
→ architecture/integration test
```

逐条标：READY / PARTIAL / MISSING。

**MISSING 不得通过改 Skill 名称或 shell workaround 变成“完成”。**

### Gate B · Existing resolver compatibility

本包保持 `skill.index.yaml schema_version: 1`。必须跑真实：

```text
lcos skill resolve lcos-project-curator --intent ...
```

验证 11 个 routes 的 entry/load 都能解析，且无跨 intent 污染。

### Gate C · Architecture tests

运行完整：

```text
npm run test:architecture
```

如果旧测试 pin 了 root 文案/旧 managed 状态，只改测试中已经被 V4.3 明确替代的断言；不要为了过测试恢复旧产品架构。

### Gate D · Managed install

```text
npm run lcos:install-skill
```

检查：

- manifest 读取正确；
- 7 个 managed skill 全安装；
- references/routes/policies 等完整复制；
- treeHash/sourceHash 正常；
- unmanaged skill overwrite protection 未退化。

### Gate E · Full baseline

按 PASS8 baseline request：

```text
npm run typecheck
npm run test
npm run build
npm run check:0.1:deterministic
npm run desktop:doctor -- --ready
```

Windows 再做 Desktop/Capture/Skill/MCP 真机验证。

## Hard blockers / do not fake

1. `filesystem_organize` Apply 必须等真实 Core File Organization capability。
2. Context/Workflow write 命令只有 full repo census 后才能写进 cli/*.md。
3. Huabu Keep/Revert 只有真实 ChangeSet/review surface 后才能从 PASS8 fallback 升成“已实现”。
4. user-skill installer 还没在本 bundle 里实现；Skill Author 已 fail-closed。

## Do not regress

- 不删 `lcos-project-context` 并全塞 Curator。
- 不重写 `lcos skill resolve / trace / review`。
- 不造第二套 Presentation organizer。
- 不造第二套 System Maintainer。
- 不把 ActiveContext 当 Saved Context。
- 不允许 Curator 创建 Managed Run。
- 不让 filesystem route 用 shell 绕 Core。

## Recommended next Codex slice

```text
1. Apply this bundle to full PASS8 tree
2. Run static + architecture gates
3. Census Context/Workflow/Presentation/File capabilities
4. Wire only READY capabilities into Curator route CLI references
5. Keep PARTIAL/MISSING routes proposal-only
6. Then implement missing Core P0 one capability at a time
```

## Static Curator load audit in this bundle

使用偏保守的中英混合估算（仅用于本地静态对比，不替代真实 provider tokenizer），`Curator root + route entry + base_load` 当前约：

| Route | 估算方法层 tokens |
|---|---:|
| ingest_conversation | ~1.6K |
| ingest_capture_batch | ~1.7K |
| reorganize | ~2.3K |
| retrieve_for_task | ~1.6K |
| update_existing_project | ~1.6K |
| context_build | ~2.0K |
| context_edit | ~1.9K |
| workflow_build | ~1.8K |
| workflow_edit | ~1.8K |
| filesystem_organize | ~1.9K |
| handoff_continue | ~1.5K |

结论：**当前最值得做的是守住 V2 的按需读取，不是先造 Capsule Compiler。** 5K Hard Cap 仍有较大空间留给 tool schema / compact result / verifier；真实业务 evidence 另算。

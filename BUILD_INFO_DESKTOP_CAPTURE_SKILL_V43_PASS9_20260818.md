# BUILD INFO · LCOS Desktop + Capture + Skill V4.3 · PASS9

日期：2026-08-18

## 输入

- `LCOS_FULLSTACK_DESKTOP_CAPTURE_BASELINE_PASS8_20260818.zip`
- `LCOS_SKILLS_PASS8_V43_UPGRADE_RELATIVE_20260818.patch`
- `LCOS_SKILL_V43_IMPLEMENTATION_HANDOFF_20260818.md`

## 同步方法

1. 在原 PASS8 Skill extraction bundle 上 `git apply --check` + `git apply` V4.3 patch。
2. V4.3 bundle local validator 通过后，将 67 个 repo-relevant 文件同步进 PASS8 full tree。
3. bundle-only `README_FOR_SKILL_UPGRADE.md` / `SKILL_BUNDLE_MANIFEST.json` 不污染 full repo root。
4. 保留 V4.3 implementation handoff 到 `docs/handoffs/`。
5. 新增 full-stack capability census 与 PASS9 phase snapshot。

## V4.3 已确认

- `SKILL_SPEC v2`
- `managed-skills.json` 为 7 个 managed skills 单一 truth
- installer 从 manifest 读取 managed skills
- Saved Context ≠ ActiveContext
- Curator 新增 6 routes
- System/Backend Maintenance Kernel 不另起平行 Skill
- Frontend Specialist 使用当前 Entity-first / Search-Focus / free canvas / Context-Workflow 规则
- WorkBuddy root 收小并按需加载 references

## 实跑 Gate

### Static Skill validator

```text
7 / 7 managed Skill PASS
Curator index references: 41 PASS
Managed index convergence PASS
```

### Resolver

11 / 11 Curator route intent resolve PASS。

### Managed install

临时 `CODEX_HOME`：7 / 7 install PASS；marker/sourceHash PASS。

### Architecture test

未完成：当前 standalone source snapshot 不含 `node_modules`，执行 `npm run test:architecture` 得到 `vitest: not found`。这不是测试断言失败，需 Windows/bootstrap 环境恢复依赖后跑。

## Capability Census

- `handoff_continue`: READY
- `context_build`: PARTIAL
- `context_edit`: PARTIAL
- `workflow_build`: PARTIAL
- `workflow_edit`: PARTIAL
- `filesystem_organize`: MISSING / DEFERRED, 0.1 plan-only

详见 `docs/handoffs/LCOS_SKILL_V43_CAPABILITY_CENSUS_PASS9_20260818.md`。

## 0.1 重要边界

V4.3 Skill 的未来 route 不构成 Core capability 已实现的证据。PARTIAL/MISSING 必须 fail-closed。

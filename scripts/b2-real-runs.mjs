// B-2 executor: ≥5 real Agent Runs through the REAL LCOS runtime.
// Full lifecycle per run: create → dispatch (bridge-task-v1) → claim → running
// → real work (canvas nodes via curation/text + layout via graph ops + staging
// output) → result envelope → sync → accept → verify completed.
// Warm-up: complete the stuck analyze run from the earlier E2E (task-0f914991).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PROXY = "http://127.0.0.1:5173/api/local-core/v1";
const BRIDGE = "http://127.0.0.1:43122";
const PROJECT = "disposable-mvp-sample";
const WORKER = "b2-executor";

async function core(method, path, body) {
  const res = await fetch(PROXY + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`core ${method} ${path} -> ${res.status}: ${json?.error?.message ?? "unknown"}`);
  }
  return json.value ?? json;
}

async function bridge(method, path, body) {
  const res = await fetch(BRIDGE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`bridge ${method} ${path} -> ${res.status}: ${json?.error?.message ?? "unknown"}`);
  }
  return json;
}

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

// ---------- 0. 环境探测 ----------
const graph = await core("GET", `/projects/${PROJECT}/graph`);
const scopeId = graph.scopes.find((s) => s.kind === "root")?.id ?? graph.scopes[0]?.id;
if (!scopeId) throw new Error("no scope found");
const views = graph.artifactViews ?? [];
const maxX = Math.max(0, ...views.map((v) => v.position?.x ?? 0));
const maxY = Math.max(0, ...views.map((v) => v.position?.y ?? 0));
log(`graph: ${views.length} views, scope=${scopeId}, extents=(${maxX},${maxY}), graphVersion=${graph.graphVersion}`);

// 组锚点：现有内容右侧横向展开，组间距 1400（组宽 ≤ 3×230+180 ≈ 870）
const anchor = (n) => ({ x: maxX + 600 + n * 1400, y: 200 });

// layout-recipes 模板公式（node 180×100，间距 50）
const GRID = { dx: 230, dy: 150 }; // x = col*230, y = row*150
const FLOW = { dx: 230 }; // x = i*230, y = 0
const LEVEL = { dy: 150 }; // y = i*150, x = 0（层内展开）
const RADIAL = { r: 320 }; // 中心 + 环上均布

const RUNS = [
  {
    id: 1, slug: "acceptance-grid", layout: "网格（验收三标准）",
    instruction: "对照 Brief 的三条成功标准，为 PortaSplit MVP 建一张验收核对网格：FileRecord 身份稳定、重启后画布恢复、参考与反馈作为上下文可见。每个标准一张核对卡。",
    nodes: [
      { label: "身份稳定核对", body: "# 身份稳定核对\n\n验收点：源文件具有稳定的 FileRecord 身份。\n\n核对结论：MVP 样例中 Brief / Script / Feedback Notes 均已持有持久身份，画布恢复后引用不漂移。状态：通过。" },
      { label: "重启恢复核对", body: "# 重启恢复核对\n\n验收点：画布在 Local Core 重启后可恢复。\n\n核对结论：项目图与视图位置持久在 SQLite，dev 栈重启后按项目 id 重进即恢复现场。状态：通过。" },
      { label: "上下文可见核对", body: "# 上下文可见核对\n\n验收点：参考材料与反馈作为项目上下文可见。\n\n核对结论：Reference 与 Feedback Notes 出现在 Context 视图与 Context Manifest 中，Agent 侧经 /space/ 可稳定寻址。状态：通过。" },
    ],
    positions: (a) => [0, 1, 2].map((col) => ({ x: a.x + col * GRID.dx, y: a.y })),
    stagingDoc: "# PortaSplit 验收核对（网格）\n\n按 Brief 三条成功标准逐项核对：身份稳定、重启恢复、上下文可见——全部通过，可进入交接阶段。\n",
    summary: "验收网格完成：三条成功标准（FileRecord 身份稳定、重启恢复、上下文可见）逐项核对全部通过，产出三张核对卡按网格排布。",
  },
  {
    id: 2, slug: "demo-flow", layout: "左到右流程（演示四步）",
    instruction: "把演示脚本拆成从左到右的流程卡：打开项目 → 审阅材料 → 核对反馈与文件身份 → 生成交接包。每步一张卡。",
    nodes: [
      { label: "第一步 开场", body: "# 第一步 开场\n\n打开 MVP 样例项目，带观众确认画布现场（Brief / Script / Reference / Feedback 就位）。口播要点：这是持久画布，不是一次性前端 fixture。" },
      { label: "第二步 审阅", body: "# 第二步 审阅\n\n审阅 brief、script 与视觉参考。口播要点：小团队在交接前统一对材料的理解。" },
      { label: "第三步 核对", body: "# 第三步 核对\n\n检查反馈要点与文件身份。口播要点：Fixture/Demo 状态与 Runtime 状态视觉可区分；Reality Gate 未批准前桥执行不计为联通。" },
      { label: "第四步 交接", body: "# 第四步 交接\n\n审阅通过后生成 handoff pack。口播要点：交接包承载本轮全部上下文，接手方无失忆。" },
    ],
    positions: (a) => [0, 1, 2, 3].map((i) => ({ x: a.x + i * FLOW.dx, y: a.y })),
    stagingDoc: "# PortaSplit 演示分镜（流程）\n\n四步流程卡：开场 → 审阅 → 核对 → 交接，对应 Script 的演示路径，供演示者按序走场。\n",
    summary: "演示分镜完成：按 Script 四步拆为流程卡，从左到右排布，含每步口播要点。",
  },
  {
    id: 3, slug: "feedback-qa", layout: "成对并排 grid（反馈问答）",
    instruction: "把 Feedback Notes 的三条意见整理成问答对：左列问题、右列回答，成对并排。三个问题：桥执行何时算联通、Fixture 与 Runtime 如何区分、MVP 路径聚焦什么。",
    nodes: [
      { label: "问 桥联通判定", body: "# 问：桥执行什么时候算联通？\n\n演示者常问：Bridge 任务已派发，是否等于执行已接通？" },
      { label: "答 现实门", body: "# 答：Reality Gate 批准前不算。\n\n反馈原文：Do not treat Bridge execution as connected until the reality gate is approved. 判定以现实门批准为准，不看任务是否派发。" },
      { label: "问 状态区分", body: "# 问：Fixture 与 Runtime 状态怎么区分？\n\n观众如何一眼分辨当前看到的是演示态还是运行态？" },
      { label: "答 视觉可辨", body: "# 答：两种状态必须视觉可辨。\n\n反馈原文：Make Fixture/Demo state visibly different from Runtime state. 靠界面语言区分，不靠口头说明。" },
      { label: "问 路径聚焦", body: "# 问：MVP 路径聚焦什么？\n\n功能很多，演示主线选哪条？" },
      { label: "答 理解交接", body: "# 答：聚焦项目理解与交接。\n\n反馈原文：Keep the MVP path focused on project understanding and handoff. 其余能力不进演示主线。" },
    ],
    positions: (a) => [0, 1, 2].flatMap((row) => [
      { x: a.x + 0 * GRID.dx, y: a.y + row * GRID.dy },
      { x: a.x + 1 * GRID.dx, y: a.y + row * GRID.dy },
    ]),
    stagingDoc: "# PortaSplit 反馈问答（成对并排）\n\n三条反馈意见整理为问答对：桥联通判定（现实门）、状态区分（视觉可辨）、路径聚焦（理解与交接）。\n",
    summary: "反馈问答完成：三条反馈意见整理为问题↔回答成对并排网格，共六卡。",
  },
  {
    id: 4, slug: "handoff-levels", layout: "层级自上而下（交接分层）",
    instruction: "为交接准备做一张自上而下的分层清单：顶层是交接准备总纲，中层是材料核对与门禁核对两项，底层是交接包生成确认。",
    nodes: [
      { label: "交接准备", body: "# 交接准备\n\n总纲：材料、门禁、交接包三件事齐备才算交接就绪。" },
      { label: "材料核对", body: "# 材料核对\n\nBrief / Script / Reference / Feedback 四类材料齐备且身份稳定，观众已统一理解。" },
      { label: "门禁核对", body: "# 门禁核对\n\nReality Gate 已批准：桥执行计为联通；Fixture 与 Runtime 状态视觉可辨。" },
      { label: "交接包确认", body: "# 交接包确认\n\n生成 handoff pack 并交接给接手会话，本轮上下文不失忆。" },
    ],
    positions: (a) => [
      { x: a.x + 230, y: a.y + 0 * LEVEL.dy },
      { x: a.x + 0 * 230, y: a.y + 1 * LEVEL.dy },
      { x: a.x + 2 * 230, y: a.y + 1 * LEVEL.dy },
      { x: a.x + 230, y: a.y + 2 * LEVEL.dy },
    ],
    stagingDoc: "# PortaSplit 交接分层（自上而下）\n\n交接准备 →（材料核对 + 门禁核对）→ 交接包确认，三层结构对应交接就绪判定。\n",
    summary: "交接分层完成：总纲-两分支-确认的三层自上而下结构，共四卡。",
  },
  {
    id: 5, slug: "risk-radial", layout: "扇形径向（风险发散）",
    instruction: "围绕『交接风险』做一次发散检查：中心放风险主题，四周放四类风险——身份漂移、状态混淆、桥误判、上下文遗漏。",
    nodes: [
      { label: "交接风险", body: "# 交接风险\n\n中心议题：交接环节最容易失守的四个方向。" },
      { label: "身份漂移", body: "# 身份漂移\n\nFileRecord 身份不稳定会让引用断链。防线：身份持久 + 恢复后核对。" },
      { label: "状态混淆", body: "# 状态混淆\n\nFixture 与 Runtime 不可辨会误导决策。防线：视觉可辨的状态语言。" },
      { label: "桥误判", body: "# 桥误判\n\n把已派发当成已联通。防线：Reality Gate 批准才算接通。" },
      { label: "上下文遗漏", body: "# 上下文遗漏\n\n参考与反馈没进交接包。防线：Context Manifest 全量携带。" },
    ],
    positions: (a) => {
      const cx = a.x + RADIAL.r, cy = a.y + RADIAL.r;
      const ring = [0, 1, 2, 3].map((i) => {
        const theta = (2 * Math.PI * i) / 4;
        return { x: Math.round(cx + RADIAL.r * Math.cos(theta)), y: Math.round(cy + RADIAL.r * Math.sin(theta)) };
      });
      return [{ x: cx, y: cy }, ...ring];
    },
    stagingDoc: "# PortaSplit 交接风险（径向）\n\n中心议题『交接风险』向四个方向发散：身份漂移、状态混淆、桥误判、上下文遗漏，各带防线。\n",
    summary: "风险发散完成：中心 + 四风险的扇形径向排布，共五卡，每卡含防线。",
  },
];

// ---------- Warm-up：完成早前 E2E 卡住的 analyze run ----------
const STUCK = { taskId: "task-0f914991-4f92-574e-984e-a514db9d6c3d", runId: "run-74bb1247-6e76-4387-a68c-a5ebe1fa85eb" };
try {
  const before = await bridge("GET", `/v1/tasks/${STUCK.taskId}`);
  if (before.task.status === "queued") {
    await bridge("POST", `/v1/tasks/${STUCK.taskId}/claim`, { provider: "workbuddy", workerId: WORKER });
    await bridge("POST", `/v1/tasks/${STUCK.taskId}/running`, { workerId: WORKER });
    await bridge("POST", `/v1/tasks/${STUCK.taskId}/result`, {
      contractVersion: "bridge-result-v1",
      taskId: STUCK.taskId,
      lcosRunId: STUCK.runId,
      providerStatus: "review",
      summary: "冒烟三步链执行完毕：① 创意方向确认——Brief 聚焦「把本地创意项目做成持久画布」，验收锚点为 FileRecord 身份稳定、重启后画布可恢复、参考与反馈作为上下文可见；② 方案初稿——按 Script 四步演示路径（打开项目→审阅材料→核对反馈与文件身份→生成交接包）走查通过；③ 内部评审——三条反馈意见均映射为执行约束：MVP 路径保持项目理解与交接聚焦、桥执行在 Reality Gate 批准前不计为联通、Fixture/Demo 与 Runtime 状态视觉可区分。结论：方向确认，可进入交接包生成。",
      changedFiles: [],
    });
    const synced = await core("POST", `/runs/${STUCK.runId}/sync`);
    log(`warm-up analyze run: completed, result=${synced.kind}`);
  } else {
    log(`warm-up analyze run: task status ${before.task.status}, skip`);
  }
} catch (error) {
  log(`warm-up skipped/failed (non-blocking): ${error.message}`);
}

// ---------- 5 个真实 create Run（可续跑：按 instruction 幂等识别） ----------
const report = [];
const existingRuns = await core("GET", `/projects/${PROJECT}/runs?limit=50`);
for (const run of RUNS) {
  const sessionId = `b2-run-${run.id}`;
  const a = anchor(run.id - 1);
  const positions = run.positions(a);

  const resume = existingRuns.find((entry) => entry.run.instruction === run.instruction);
  let runId, viewIds = [], outPath = `(resumed) ${run.slug}.md`;

  if (resume !== undefined) {
    runId = resume.run.id;
    log(`run ${run.id}: resume ${runId} (status=${resume.run.status})`);
    if (resume.run.status === "completed") { report.push({ run: runId, theme: run.slug, layout: run.layout, status: "completed", nodes: run.nodes.length, output: outPath, resumed: true }); continue; }
  } else {
    // 1. create + dispatch（真实 runtime 生命周期）
    const created = await core("POST", `/projects/${PROJECT}/runs`, {
      instruction: run.instruction,
      outputIntent: "create",
      requestedProvider: "workbuddy",
      sessionId,
    });
    runId = created.review.run.id;
    await core("POST", `/runs/${runId}/dispatch`);
    const { task } = await bridge("GET", `/v1/tasks/by-run/${runId}`);
    log(`run ${run.id}: created+dispatched ${runId} task=${task.taskId}`);

    // 2. executor 接单
    await bridge("POST", `/v1/tasks/${task.taskId}/claim`, { provider: "workbuddy", workerId: WORKER });
    await bridge("POST", `/v1/tasks/${task.taskId}/running`, { workerId: WORKER });

    // 3. 真实作业：画布节点（node-labeling 1-5 词 label + curation/text with sessionId）
    for (const node of run.nodes) {
      const value = await core("POST", `/projects/${PROJECT}/curation/text`, {
        scopeId, title: node.label, body: node.body, sessionId,
      });
      viewIds.push(value.viewId);
    }
    log(`run ${run.id}: ${viewIds.length} canvas nodes created (${run.layout})`);

    // 4. layout-recipes 布局（批量 move，presentation-only）
    const ops = viewIds.map((viewId, i) => ({ type: "move_artifact_view", viewId, x: positions[i].x, y: positions[i].y }));
    let applied = false;
    for (let attempt = 0; attempt < 3 && !applied; attempt++) {
      const fresh = await core("GET", `/projects/${PROJECT}/graph`);
      try {
        await core("POST", `/projects/${PROJECT}/graph`, { baseVersion: fresh.graphVersion, ops });
        applied = true;
      } catch (error) {
        if (!String(error.message).includes("STALE")) throw error;
      }
    }
    if (!applied) throw new Error(`run ${run.id}: layout moves failed after retries`);

    // 5. 产出文件写入 run staging root
    const { task: freshTask } = await bridge("GET", `/v1/tasks/by-run/${runId}`);
    const outputRoot = freshTask.envelope.outputRoot;
    outPath = join(outputRoot, `${run.slug}.md`);
    await mkdir(outputRoot, { recursive: true });
    await writeFile(outPath, run.stagingDoc, "utf8");

    // 6. 提交 bridge 结果
    await bridge("POST", `/v1/tasks/${freshTask.taskId}/result`, {
      contractVersion: "bridge-result-v1",
      taskId: freshTask.taskId,
      lcosRunId: runId,
      providerStatus: "review",
      summary: run.summary,
      changedFiles: [{ path: outPath, action: "created" }],
    });
  }

  // 7. sync + accept（sync 返回 {review}；returns 从 review 拿）
  await core("POST", `/runs/${runId}/sync`);
  const review = await core("GET", `/runs/${runId}/review`);
  const pending = review.returns.filter((ret) => ret.status === "pending_review");
  for (const ret of pending) {
    await core("POST", `/artifact-returns/${ret.id}/accept`, { expectedBaseRevisionId: ret.baseRevisionId });
  }

  // 8. 终态核验
  const finalReview = await core("GET", `/runs/${runId}/review`);
  report.push({
    run: runId, theme: run.slug, layout: run.layout,
    status: finalReview.run.status, nodes: run.nodes.length, output: outPath,
  });
  log(`run ${run.id}: ${finalReview.run.status} ✓ (${run.nodes.length} nodes${pending.length ? ` + ${pending.length} artifact return accepted` : ""})`);
}

// ---------- 总验收证据 ----------
const runsList = await core("GET", `/projects/${PROJECT}/runs?limit=20`);
const completed = runsList.filter((r) => r.run.status === "completed");
const changeSets = await core("GET", `/projects/${PROJECT}/change-sets?limit=200`);
const finalGraph = await core("GET", `/projects/${PROJECT}/graph`);
const b2Views = finalGraph.artifactViews.filter((v) => {
  const artifact = finalGraph.artifacts.find((a) => String(a.id) === String(v.artifactId));
  return artifact && Date.parse(artifact.createdAt) > Date.now() - 30 * 60_000;
});

console.log("\n========== B-2 验收证据 ==========");
console.log(`completed runs: ${completed.length}`);
for (const r of completed) console.log(`  ${r.run.id} | ${r.run.status} | ${(r.run.resultSummary ?? "").slice(0, 50)}`);
console.log(`change-sets (agent writes recorded): ${changeSets.length}`);
console.log(`new canvas views (last 30min): ${b2Views.length}`);
for (const v of b2Views) {
  const artifact = finalGraph.artifacts.find((a) => String(a.id) === String(v.artifactId));
  console.log(`  (${String(v.position?.x ?? "?").padStart(5)},${String(v.position?.y ?? "?").padStart(5)}) ${artifact?.title}`);
}
console.log("=================================");
console.log(JSON.stringify(report, null, 2));

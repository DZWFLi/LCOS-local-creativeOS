import { existsSync, mkdirSync, readFileSync, appendFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SKILLS_ROOT = resolve(join(process.cwd(), "packages", "skills"));
const LEARNING_ROOT = process.env.LCOS_SKILL_LEARNING_ROOT ?? join(homedir(), ".lcos", "skill-learning");

/** 极简 YAML 子集解析：只处理本 skill.index.yaml 的结构（列表/映射/标量）。 */
function parseSimpleYaml(text) {
  const lines = text.split(/\r?\n/);
  const root = { __kind: "map", __map: {} };
  const stack = [{ indent: -1, node: root }];
  const push = (node, key, value) => {
    if (node.__kind === "map") node.__map[key] = value;
    else if (node.__kind === "list") node.__list.push(value);
  };
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s*$/, "");
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)[0].length;
    const content = line.slice(indent);
    const listItem = content.match(/^-\s*(?:"([^"]*)"|'([^']*)'|(.*))$/);
    const keyValue = content.match(/^([^:#]+):\s*(?:"([^"]*)"|'([^']*)'|(.*))$/);
    if (listItem !== null) {
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parentNode = stack[stack.length - 1].node;
      if (parentNode.__kind === "undecided") parentNode.__kind = "list";
      else if (parentNode.__kind !== "list") throw new Error(`YAML list item under non-list parent: ${content}`);
      const value = listItem[1] ?? listItem[2] ?? listItem[3]?.trim() ?? "";
      parentNode.__list.push(value);
    } else if (keyValue !== null) {
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parentNode = stack[stack.length - 1].node;
      if (parentNode.__kind === "undecided") parentNode.__kind = "map";
      else if (parentNode.__kind !== "map") throw new Error(`YAML key under non-map parent: ${content}`);
      const key = keyValue[1].trim();
      const raw = keyValue[2] ?? keyValue[3] ?? keyValue[4]?.trim() ?? "";
      if (raw === "") {
        // 无值 key：容器类型由第一个子行决定（list item → list；key → map）
        const next = { __kind: "undecided", __map: {}, __list: [] };
        push(parentNode, key, next);
        stack.push({ indent, node: next });
      } else {
        push(parentNode, key, raw);
      }
    } else {
      throw new Error(`Unsupported YAML line: ${content}`);
    }
  }
  return materialize(root);
}

function materialize(node) {
  if (node.__kind === "list") return node.__list.map((item) => (typeof item === "object" ? materialize(item) : item));
  if (node.__kind === "undecided") {
    // 空容器（如 evals 无子行）：按 map 处理
    return node.__map;
  }
  const out = {};
  for (const [key, value] of Object.entries(node.__map)) {
    out[key] = typeof value === "object" ? materialize(value) : value;
  }
  return out;
}

function readIndex(skill) {
  const path = join(SKILLS_ROOT, skill, "skill.index.yaml");
  if (!existsSync(path)) throw new Error(`Skill index not found: ${path}`);
  return parseSimpleYaml(readFileSync(path, "utf8"));
}

export async function runSkillCommand({ action, rest }) {
  const option = (name) => {
    const index = rest.indexOf(`--${name}`);
    return index < 0 ? undefined : rest[index + 1];
  };
  const positional = rest.filter((value, index) => !value.startsWith("--") && !rest[index - 1]?.startsWith("--"));

  if (action === "resolve") {
    const skill = positional[0] ?? "lcos-project-curator";
    const intent = option("intent");
    if (!intent) throw new Error("--intent is required");
    const index = readIndex(skill);
    const route = index.routes?.[intent];
    if (route === undefined) throw new Error(`Unknown intent ${intent}; available: ${Object.keys(index.routes ?? {}).join(", ")}`);
    const files = new Set(route.base_load ?? []);
    const conditions = [];
    for (let position = 0; position < rest.length; position += 1) {
      if (rest[position] === "--condition" && rest[position + 1] !== undefined) conditions.push(rest[position + 1]);
    }
    for (const conditionName of conditions) {
      for (const file of route.conditional_load?.[conditionName] ?? []) files.add(file);
    }
    return {
      skill,
      intent,
      entry: route.entry,
      load: [...files],
      budget: route.budget ?? {},
    };
  }

  if (action === "trace") {
    const skill = positional[0] ?? "lcos-project-curator";
    const dataFile = option("file");
    const trace = dataFile
      ? JSON.parse(readFileSync(resolve(dataFile), "utf8"))
      : JSON.parse(rest.join(" ") || "{}");
    trace.skill = trace.skill ?? skill;
    trace.id = trace.id ?? `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    trace.startedAt = trace.startedAt ?? new Date().toISOString();
    const dir = join(LEARNING_ROOT, skill);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "traces.jsonl");
    appendFileSync(file, `${JSON.stringify(trace)}\n`, "utf8");
    return { ok: true, traceId: trace.id, file };
  }

  if (action === "review") {
    const skill = positional[0] ?? "lcos-project-curator";
    const recent = Number(option("recent") ?? 30);
    const file = join(LEARNING_ROOT, skill, "traces.jsonl");
    if (!existsSync(file)) return { skill, traces: 0, summary: {} };
    const traces = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-recent);
    const byRoute = {};
    const byOutcome = {};
    let totalChars = 0;
    for (const trace of traces) {
      byRoute[trace.route ?? "unknown"] = (byRoute[trace.route ?? "unknown"] ?? 0) + 1;
      byOutcome[trace.outcome ?? "unknown"] = (byOutcome[trace.outcome ?? "unknown"] ?? 0) + 1;
      totalChars += Number(trace.loadedChars ?? 0);
    }
    return {
      skill,
      traces: traces.length,
      summary: {
        byRoute,
        byOutcome,
        avgLoadedChars: traces.length ? Math.round(totalChars / traces.length) : 0,
        correctionRefs: traces.flatMap((trace) => trace.correctionRefs ?? []),
      },
    };
  }

  throw new Error("Usage: lcos skill resolve|trace|review");
}

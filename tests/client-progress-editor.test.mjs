// Mocked actions, server render paths and editor callbacks. No SQL or browser.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
function loader(mocks = {}, fallback) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const code = ts.transpileModule(read(filename), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      const substituted = fallback?.(name);
      if (substituted) return substituted;
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((item) => nodes(item, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function text(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const first = (tree, type) => nodes(tree, (node) => node.type === type)[0];
const button = (tree, label) => nodes(tree, (node) => node.type === "button" && text(node) === label)[0];
const stage = (id, title, sort_order) => ({ id, title, status: "planned", sort_order });
const snapshot = (version = 3) => ({
  object_id: 47, overall_percent: 30, completed_summary: "Готово", next_summary: "Далі",
  updated_at: "2026-09-21T10:00:00.000Z", version,
  stages: [stage(10, "Перший", 0), stage(11, "Другий", 1)],
});

test("admin/manager see progress tab; worker URL falls back with zero progress queries; only active tab loads", async () => {
  for (const role of ["admin", "object_manager", "worker"]) {
    let reads = 0, failProgress = false;
    const Tabs = loader()("components/ObjectTabs.tsx");
    const load = loader({
      "next/navigation": { notFound: () => { throw new Error("not-found"); } },
      "@/components/ObjectTabs": Tabs,
      "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: true }) },
      "@/services/clientProgressManagementService": { getManagementClientObjectProgress: async (id) => { assert.equal(id, 47); reads++; if (failProgress) throw new Error("SECRET"); return snapshot(); } },
      "@/services/objectService": { getObject: async () => ({ id: 47 }), getManagementObject: async () => ({ id: 47 }) },
      "@/services/objectDetailService": {
        getObjectOverviewPreview: async () => ({}), getManagementObjectCostSummary: async () => ({ materialsCost: 0, laborCost: 0 }),
      },
      "@/services/objectExpenseService": { getObjectExpenseTotal: async () => 0 },
      "@/services/objectPaymentScheduleService": { getObjectPaymentTotals: async () => new Map(), getObjectPaymentSchedule: async () => [] },
    }, (name) => {
      if (name.startsWith("@/components/")) return { __esModule: true, default: function Stub() {} };
      if (name.startsWith("@/services/")) return {};
    });
    const Page = load("app/objects/[id]/page.tsx").default;
    for (const tab of ["client-progress", "overview"]) {
      reads = 0;
      const page = await Page({ params: Promise.resolve({ id: "47" }), searchParams: Promise.resolve({ tab }) });
      const tabNode = nodes(page, (node) => node.type === Tabs.default)[0];
      assert.equal(tabNode.props.activeTab, role === "worker" ? "overview" : tab);
      const nav = Tabs.default(tabNode.props);
      assert.equal(text(nav).includes("Прогрес для клієнта"), role !== "worker");
      assert.equal(reads, 0); // Async tab only executes inside existing Suspense.
      const content = nodes(page, (node) => node.type?.name === "ObjectTabContent")[0];
      const result = await content.type(content.props);
      assert.equal(reads, role !== "worker" && tab === "client-progress" ? 1 : 0);
      if (reads) {
        assert.deepEqual(Object.keys(result.props).sort(), ["initialProgress", "loadFailed", "objectId"]);
        assert.deepEqual(result.props.initialProgress, snapshot());
        failProgress = true;
        const failed = await content.type(content.props);
        assert.equal(failed.props.loadFailed, true);
        assert.equal(failed.props.initialProgress, null);
        assert.doesNotMatch(JSON.stringify(failed.props), /SECRET/);
        failProgress = false;
      }
      if (role === "worker") {
        await content.type({ ...content.props, activeTab: "client-progress" });
        assert.equal(reads, 0); // Defensive branch guard as well as URL fallback.
      }
    }
  }
});

function actionFixture() {
  let identity = "internal", profile = { role: "admin", is_active: true };
  let result = { data: [snapshot(1)], error: null };
  const rpcCalls = [], invalidations = [];
  const load = loader({
    "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => { rpcCalls.push(args); return result; } }) },
  });
  return { actions: load("app/actions/clientProgressActions.ts"), rpcCalls, invalidations,
    identity: (value) => { identity = value; }, profile: (value) => { profile = value; }, result: (value) => { result = value; } };
}
const publication = () => ({ object_id: 47, overall_percent: 30, completed_summary: "Готово", next_summary: "Далі", stages: [], expected_version: 0 });

test("actions verify internal identity/active management role before RPC; validate and strip caller metadata", async () => {
  const f = actionFixture();
  for (const identity of ["client", "guest", "denied"]) {
    f.identity(identity);
    assert.equal((await f.actions.publishClientProgress(publication())).ok, false);
    assert.equal((await f.actions.reloadClientProgress(47)).ok, false);
  }
  f.identity("internal");
  for (const profile of [null, { role: "worker", is_active: true }, { role: "admin", is_active: false }]) {
    f.profile(profile);
    assert.equal((await f.actions.publishClientProgress(publication())).ok, false);
    assert.equal((await f.actions.reloadClientProgress(47)).ok, false);
  }
  assert.equal(f.rpcCalls.length, 0); assert.equal(f.invalidations.length, 0);
  for (const role of ["admin", "object_manager"]) {
    f.profile({ role, is_active: true });
    const invalid = await f.actions.publishClientProgress({ ...publication(), overall_percent: 101 });
    assert.equal(invalid.ok, false);
    const before = f.rpcCalls.length;
    const response = await f.actions.publishClientProgress({ ...publication(), created_by: "fake", version: 900, created_at: "fake" });
    assert.equal(response.ok, true);
    assert.equal(f.rpcCalls.length, before + 1);
    assert.deepEqual(Object.keys(f.rpcCalls.at(-1)[1]).sort(), ["p_object_id", "p_overall_percent", "p_completed_summary", "p_next_summary", "p_stages", "p_expected_version"].sort());
    assert.deepEqual(Object.keys(response.progress).sort(), ["object_id", "overall_percent", "completed_summary", "next_summary", "updated_at", "stages", "version"].sort());
  }
  assert.deepEqual(f.invalidations, ["/objects/47", "/client/objects/47", "/objects/47", "/client/objects/47"]);
});

test("SQL 40001 crosses action boundary as typed conflict; failure never revalidates or exposes internals", async () => {
  const f = actionFixture();
  f.result({ data: null, error: { code: "40001", message: "SECRET" } });
  const conflict = await f.actions.publishClientProgress(publication());
  assert.equal(conflict.ok, false); assert.equal(conflict.conflict, true);
  assert.match(conflict.message, /іншим користувачем/);
  assert.equal(f.rpcCalls.length, 1); assert.equal(f.invalidations.length, 0);
  f.result({ data: null, error: { code: "XX000", message: "SECRET", details: "stack" } });
  const failure = await f.actions.publishClientProgress(publication());
  assert.equal(failure.ok, false); assert.equal(failure.conflict, false);
  assert.doesNotMatch(JSON.stringify(failure), /SECRET|stack/);
  f.result({ data: [], error: null });
  assert.deepEqual(await f.actions.reloadClientProgress(47), { ok: true, progress: null });
  assert.equal(f.invalidations.length, 0);
});

function editorFixture(initialProgress = null, loadFailed = false) {
  const slots = []; let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
  };
  let publish = async () => ({ ok: true, progress: snapshot(1) });
  let reload = async () => ({ ok: true, progress: snapshot(8) });
  const calls = [], reloads = [];
  const Component = loader({
    react,
    "@/app/actions/clientProgressActions": {
      publishClientProgress: async (input) => { calls.push(input); return publish(input); },
      reloadClientProgress: async (id) => { reloads.push(id); return reload(id); },
    },
  })("components/objects/ClientProgressEditor.tsx").default;
  const props = { objectId: 47, initialProgress, loadFailed };
  const render = () => { cursor = 0; return Component(props); };
  const submit = () => first(render(), "form").props.onSubmit({ preventDefault() {} });
  return { render, submit, props, calls, reloads, publish: (value) => { publish = value; }, reload: (value) => { reload = value; } };
}

test("first publication is explicit; pending lock prevents double submit; returned IDs/version/timestamp retained", async () => {
  const f = editorFixture();
  assert.match(text(f.render()), /ще не опубліковано/);
  assert.match(text(f.render()), /Цю інформацію бачитиме клієнт/);
  assert.equal(f.calls.length, 0);
  let resolvePublish;
  f.publish(() => new Promise((resolve) => { resolvePublish = resolve; }));
  const pending = f.submit(); await f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].expected_version, 0); assert.equal(f.calls[0].overall_percent, 0);
  assert.equal(first(f.render(), "fieldset").props.disabled, true);
  resolvePublish({ ok: true, progress: snapshot(1) }); await pending;
  assert.match(text(f.render()), /Оновлення опубліковано/);
  assert.equal(first(f.render(), "time").props.dateTime, snapshot(1).updated_at);
  f.publish(async () => ({ ok: true, progress: snapshot(2) }));
  await f.submit();
  assert.equal(f.calls[1].expected_version, 1);
  assert.deepEqual(f.calls[1].stages.map((s) => s.id), [10, 11]);
});

test("stage edit/add/reorder/remove preserves canonical IDs and produces contiguous ordered payload", async () => {
  const f = editorFixture(snapshot());
  let tree = f.render();
  assert.equal(first(tree, "input").props.value, "30");
  const options = nodes(tree, (n) => n.type === "option").slice(0, 3);
  assert.deepEqual(options.map((n) => [n.props.value, text(n)]), [["planned", "Заплановано"], ["in_progress", "В роботі"], ["completed", "Завершено"]]);
  button(tree, "+ Додати етап").props.onClick();
  tree = f.render();
  nodes(tree, (n) => n.type === "input")[3].props.onChange({ target: { value: "Новий" } });
  tree = f.render();
  nodes(tree, (n) => n.type === "select")[2].props.onChange({ target: { value: "completed" } });
  tree = f.render();
  nodes(tree, (n) => n.props?.["aria-label"] === "Перемістити етап 3 вгору")[0].props.onClick();
  tree = f.render();
  nodes(tree, (n) => n.props?.["aria-label"] === "Видалити етап 1")[0].props.onClick();
  tree = f.render();
  nodes(tree, (n) => n.type === "input")[2].props.onChange({ target: { value: "Другий змінений" } });
  f.publish(async () => ({ ok: true, progress: snapshot(4) }));
  await f.submit();
  assert.equal(f.calls[0].expected_version, 3); assert.equal(f.calls[0].overall_percent, 30);
  assert.deepEqual(f.calls[0].stages, [
    { id: null, title: "Новий", status: "completed", sort_order: 0 },
    { id: 11, title: "Другий змінений", status: "planned", sort_order: 1 },
  ]);
});

test("editor caps stages at 50, rejects invalid percent before action, and releases failed-submit lock", async () => {
  const f = editorFixture({ ...snapshot(), stages: Array.from({ length: 50 }, (_, i) => stage(i + 1, "Етап", i)) });
  assert.equal(button(f.render(), "+ Додати етап").props.disabled, true);
  button(f.render(), "+ Додати етап").props.onClick(); // Also guard the handler itself.
  assert.equal(nodes(f.render(), (n) => n.type === "select").length, 50);
  first(f.render(), "input").props.onChange({ target: { value: "101" } });
  await f.submit(); assert.equal(f.calls.length, 0);
  first(f.render(), "input").props.onChange({ target: { value: "" } });
  await f.submit(); assert.equal(f.calls.length, 0);
  first(f.render(), "input").props.onChange({ target: { value: "70" } });
  f.publish(async () => { throw new Error("SECRET"); });
  await f.submit();
  assert.equal(first(f.render(), "fieldset").props.disabled, false);
  assert.doesNotMatch(text(f.render()), /SECRET/);
  f.publish(async () => ({ ok: true, progress: snapshot(4) }));
  await f.submit(); assert.equal(f.calls.length, 2);
});

test("conflict preserves draft/version until explicit reload; background props cannot silently rebase it", async () => {
  const f = editorFixture(snapshot());
  first(f.render(), "input").props.onChange({ target: { value: "65" } });
  f.props.initialProgress = snapshot(7); // Server revalidation is not consent to rebase a draft.
  f.publish(async () => ({ ok: false, conflict: true, message: "Прогрес уже було змінено іншим користувачем. Оновіть дані перед повторним збереженням." }));
  await f.submit();
  assert.equal(f.calls[0].expected_version, 3);
  assert.equal(first(f.render(), "input").props.value, "65");
  assert.equal(button(f.render(), "Опублікувати оновлення").props.disabled, true);
  await f.submit(); assert.equal(f.calls.length, 1); assert.equal(f.reloads.length, 0);
  assert.match(text(f.render()), /замінить незбережені зміни/);
  await button(f.render(), "Оновити дані").props.onClick();
  assert.deepEqual(f.reloads, [47]); assert.equal(first(f.render(), "input").props.value, "30");
  f.publish(async () => ({ ok: true, progress: snapshot(9) }));
  await f.submit(); assert.equal(f.calls[1].expected_version, 8);
});

test("initial load error never presents an empty publication form and supports safe retry", async () => {
  const f = editorFixture(null, true);
  assert.equal(first(f.render(), "form"), undefined);
  f.reload(async () => ({ ok: false, conflict: false, message: "Не вдалося завантажити прогрес." }));
  await button(f.render(), "Оновити дані").props.onClick();
  assert.equal(first(f.render(), "form"), undefined);
  f.reload(async () => ({ ok: true, progress: null }));
  await button(f.render(), "Оновити дані").props.onClick();
  assert.ok(first(f.render(), "form")); assert.equal(f.calls.length, 0);
});

test("management editor/action use dedicated DTO/service, no broad object fields or service role", () => {
  const editor = read("components/objects/ClientProgressEditor.tsx");
  const action = read("app/actions/clientProgressActions.ts");
  assert.doesNotMatch(editor + action, /service.role|supabaseAdmin|ObjectItem|workLogService|activityLogService|getClientObjectProgress|\.from\(/iu);
  assert.match(editor, /<form onSubmit=\{handleSubmit\}/u);
  assert.doesNotMatch(editor, /<form action=|form\.reset/u);
  assert.match(action, /managementClientObjectProgressDto/u);
});

// Run: node --test tests/task-template-lookup.test.mjs
// Isolated action/component assertions: no database, network or browser access.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const tick = () => new Promise((done) => setImmediate(done));

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", output)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

// Minimal hook harness to exercise the real component's state and callbacks.
// This is not a substitute for React DOM/browser integration tests.
function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        return slots[index] ??= { current: initial };
      },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
          slots[index]?.cleanup?.();
          slots[index] = { effect, deps };
          effects.push(index);
        }
      },
    },
    render(component, props) { cursor = 0; return component(props); },
    runEffects() { for (const index of effects) slots[index].cleanup = slots[index].effect(); effects = []; },
    replayEffects() { for (const slot of slots) if (slot?.effect) { slot.cleanup?.(); slot.cleanup = slot.effect(); } },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const element = (tree, type) => nodes(tree, (node) => node.type === type)[0];
const button = (tree, label) => nodes(tree, (node) => node.type === "button" && String(node.props.children).includes(label))[0];

function pickerFixture({ initial, fail = false } = {}) {
  const harness = hooks();
  const requests = [];
  const load = loader({
    react: harness.react,
    "@/app/actions/taskTemplateLookupActions": {
      searchTemplateOptions: async (...args) => {
        requests.push(args);
        if (fail) { fail = false; throw new Error("Simulated network failure"); }
        const [, query, page] = args;
        return { ok: true, page, hasMore: !query && page === 1, options: query
          ? [{ id: 71, label: "Знайдений працівник" }]
          : Array.from({ length: 20 }, (_, i) => ({ id: (page - 1) * 20 + i + 1, label: `Працівник ${i + 1}` })) };
      },
    },
  });
  const Component = load("components/tasks/TaskTemplateLookup.tsx").default;
  const props = { kind: "employee", label: "Відповідальний", initial, value: initial ? String(initial.id) : "", onChange: (value) => { props.value = value; } };
  const render = () => harness.render(Component, props);
  return { harness, requests, props, render };
}

test("opening employee picker loads one page without an explicit search; Strict Mode does not duplicate it", async () => {
  const fixture = pickerFixture();
  fixture.render(); fixture.harness.runEffects(); fixture.harness.replayEffects();
  await tick();
  assert.deepEqual(fixture.requests, [["employee", "", 1]]);
  const tree = fixture.render();
  assert.equal(nodes(tree, (node) => node.type === "option").length, 21);
  assert.equal(element(tree, "select").props.value, "");
  assert.equal(element(tree, "option").props.children, "Не призначено");
  assert.ok(button(tree, "Далі"));
});

test("canonical selection survives pagination/search; clearing remains valid", async () => {
  const fixture = pickerFixture();
  fixture.render(); fixture.harness.runEffects(); await tick();
  element(fixture.render(), "select").props.onChange({ target: { value: "7" } });
  assert.equal(fixture.props.value, "7");
  button(fixture.render(), "Далі").props.onClick(); await tick();
  assert.deepEqual(fixture.requests.at(-1), ["employee", "", 2]);
  assert.ok(nodes(fixture.render(), (node) => node.type === "option" && node.props.value === 7).length);
  element(fixture.render(), "input").props.onChange({ target: { value: "Тест" } });
  button(fixture.render(), "Знайти").props.onClick(); await tick();
  assert.deepEqual(fixture.requests.at(-1), ["employee", "Тест", 1]);
  element(fixture.render(), "select").props.onChange({ target: { value: "71" } });
  assert.equal(fixture.props.value, "71");
  element(fixture.render(), "select").props.onChange({ target: { value: "" } });
  assert.equal(element(fixture.render(), "select").props.value, "");
});

test("edit displays the current assignee outside the fetched page", async () => {
  const fixture = pickerFixture({ initial: { id: 99, label: "Поточний працівник" } });
  let tree = fixture.render();
  assert.equal(element(tree, "select").props.value, "99");
  fixture.harness.runEffects(); await tick(); tree = fixture.render();
  assert.equal(element(tree, "select").props.value, "99");
  assert.equal(nodes(tree, (node) => node.type === "option" && node.props.value === 99)[0].props.children, "Поточний працівник");
});

test("initial failure stays local and explicit search can retry", async () => {
  const fixture = pickerFixture({ fail: true });
  fixture.render(); fixture.harness.runEffects(); await tick();
  assert.equal(nodes(fixture.render(), (node) => node.props?.role === "alert").length, 1);
  assert.equal(button(fixture.render(), "Знайти").props.disabled, false);
  button(fixture.render(), "Знайти").props.onClick(); await tick();
  assert.equal(nodes(fixture.render(), (node) => node.type === "option").length, 21);
});

test("management action returns narrow paged employees; worker is rejected before the employee query", async () => {
  let role = "admin";
  let clients = 0;
  const calls = [];
  const load = loader({
    "@/services/profileService": { getCurrentUserProfile: async () => role ? { role } : null },
    "@/lib/supabase/server": { createClient: async () => {
      clients++;
      return { from(table) {
        calls.push(["from", table]);
        const query = {};
        for (const method of ["select", "or", "order", "range"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
        query.then = (done, reject) => Promise.resolve({ error: null, data: Array.from({ length: 21 }, (_, i) => ({ id: i + 1, first_name: "Ім’я", last_name: `Прізвище ${i}` })) }).then(done, reject);
        return query;
      } };
    } },
  });
  const { searchTemplateOptions } = load("app/actions/taskTemplateLookupActions.ts");
  for (role of ["admin", "object_manager"]) {
    calls.length = 0;
    const result = await searchTemplateOptions("employee", "", 1);
    assert.equal(result.ok, true);
    assert.equal(result.options.length, 20);
    assert.equal(result.options[0].id, 1);
    assert.equal(result.hasMore, true);
    assert.deepEqual(calls.find(([method]) => method === "select"), ["select", "id, first_name, last_name"]);
    assert.deepEqual(calls.find(([method]) => method === "range"), ["range", 0, 20]);
    assert.ok(!calls.some(([method]) => method === "or"));
  }
  calls.length = 0;
  await searchTemplateOptions("employee", "Ім’я", 2);
  assert.ok(calls.some(([method]) => method === "or"));
  assert.deepEqual(calls.find(([method]) => method === "range"), ["range", 20, 40]);
  const before = clients;
  for (role of ["worker", null]) {
    // Expected denial is logged by the server action; silence only that test diagnostic.
    const original = console.error;
    let result;
    try { console.error = () => {}; result = await searchTemplateOptions("employee", "", 1); }
    finally { console.error = original; }
    assert.equal(result.ok, false);
  }
  assert.equal(clients, before);
});

test("create/edit forms pass numeric canonical IDs or null to their existing actions", async () => {
  for (const [editing, employeeValue] of [[false, "71"], [false, ""], [true, "71"], [true, ""]]) {
    const harness = hooks();
    const saved = [];
    const actions = {};
    for (const name of ["createTaskTemplateAction", "updateTaskTemplateAction"]) actions[name] = async (input) => { saved.push(input); return { template: { id: 5 } }; };
    function Lookup() {}
    const load = loader({
      react: harness.react,
      "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }) },
      "@/app/actions/taskTemplateActions": actions,
      "@/components/tasks/TaskTemplateLookup": { default: Lookup },
      "@/components/tasks/TaskRecurrenceFields": { default: () => null },
      "@/components/tasks/StopRecurringTaskButton": { default: () => null },
    });
    const Component = load("components/tasks/TaskTemplatesPanel.tsx").default;
    const template = { id: 5, assigned_employee_id: 99, employee: { last_name: "Поточний", first_name: "Працівник" }, title: "Тест", recurrence_type: "weekly", recurrence_interval: 1, is_active: true, object_id: 3, equipment_id: null, source_template_id: null, target_type: "object", priority: "Середній", anchor_due_date: "2026-09-19" };
    const render = () => harness.render(Component, editing ? { template } : {});
    let tree = render();
    if (editing) { button(tree, "Редагувати").props.onClick(); tree = render(); }
    const picker = () => nodes(render(), (node) => node.type === Lookup && node.props.kind === "employee")[0];
    if (editing) {
      assert.equal(picker().props.value, "99");
      assert.deepEqual(picker().props.initial, { id: 99, label: "Поточний Працівник" });
    }
    picker().props.onChange(employeeValue);
    await element(render(), "form").props.onSubmit({ preventDefault() {} });
    assert.equal(saved.at(-1).assignedEmployeeId, employeeValue ? 71 : null);
  }
});

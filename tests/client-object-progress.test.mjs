// Real TS page/service/presentation with mocked session RPCs; no SQL or browser.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Use actual Next navigation errors/rethrow to test that the fallback does not
// swallow notFound/redirect control flow.
const { notFound, redirect, unstable_rethrow } = require("next/navigation");
const read = (file) => readFileSync(file, "utf8");
function loader(mocks = {}) {
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

function progress(objectId = 47) {
  return {
    object_id: objectId, overall_percent: 35,
    completed_summary: "Підготовлено ділянку.\nПрибрано територію.", next_summary: "Посадка рослин.",
    updated_at: "2026-09-21T10:00:00.000Z",
    stages: [
      { id: 13, title: "Догляд", status: "planned", sort_order: 2 },
      { id: 11, title: "Підготовка", status: "completed", sort_order: 0 },
      { id: 12, title: "Посадка", status: "in_progress", sort_order: 1 },
    ],
  };
}
function fixture() {
  let session = "A", identity = "client", result = null, afterObject = () => {};
  const grants = { A: new Set([47]), B: new Set([48]) };
  const calls = [];
  const load = loader({
    "next/navigation": { notFound, redirect, unstable_rethrow },
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => createElement("a", { ...props, href }, children) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => ({
      from: () => assert.fail("No direct table queries"),
      rpc: async (name, args) => {
        calls.push({ session, name, args });
        if (name === "get_client_object_photos") {
          assert.deepEqual(Object.keys(args), ["p_object_id", "p_page"]);
          assert.equal(args.p_page, 1);
          return grants[session].has(args.p_object_id)
            ? { data: [], error: null }
            : { data: null, error: { code: "42501" } };
        }
        assert.deepEqual(Object.keys(args), ["p_object_id"]);
        const id = args.p_object_id;
        if (name === "get_client_object") {
          const data = grants[session].has(id) ? [{ id, name: `Сад ${id}`, address: "Вулиця Садова", status: "В роботі", private_note: "SECRET_OBJECT" }] : [];
          afterObject();
          return { data, error: null };
        }
        assert.equal(name, "get_client_object_progress", "Never management/global progress RPC");
        if (!grants[session].has(id)) return { data: null, error: { code: "42501", message: "SECRET_DENIAL" } };
        if (typeof result === "function") return result();
        return result ?? { data: [progress(id)], error: null };
      },
    }) },
  });
  const Page = load("app/client/objects/[id]/page.tsx").default;
  const Component = load("components/client/ClientObjectProgress.tsx").default;
  const service = load("services/clientPortalService.ts");
  return {
    page: (id = "47") => Page({ params: Promise.resolve({ id }) }), Component, service, calls, grants,
    session: (value) => { session = value; }, identity: (value) => { identity = value; },
    result: (value) => { result = value; }, afterObject: (value) => { afterObject = value; },
  };
}
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
const is404 = (error) => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

test("published progress renders below object header: manual percentage, ordered Ukrainian stages, summaries and Kyiv time", async () => {
  const f = fixture();
  const tree = await f.page();
  const html = renderToStaticMarkup(tree);
  assert.ok(html.indexOf("Сад 47") < html.indexOf("Прогрес об’єкта"));
  assert.match(html, /35%/);
  assert.match(html, /role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"[^>]*aria-valuenow="35"/);
  assert.match(html, /width:35%/);
  assert.ok(html.indexOf("Підготовка") < html.indexOf("Посадка"));
  assert.ok(html.indexOf("Посадка") < html.indexOf("Догляд"));
  for (const label of ["Заплановано", "В роботі", "Завершено", "Що виконано", "Що далі"]) assert.ok(html.includes(label));
  assert.match(html, /21\.09\.2026 13:00/); // 10:00 UTC -> Kyiv, regardless of host timezone.
  assert.match(html, /dateTime="2026-09-21T10:00:00.000Z"/);
  assert.deepEqual(f.calls.map(({ name, args }) => [name, args]), [
    ["get_client_object", { p_object_id: 47 }], ["get_client_object_progress", { p_object_id: 47 }],
    ["get_client_object_photos", { p_object_id: 47, p_page: 1 }],
  ]);
  const progressHtml = renderToStaticMarkup(nodes(tree, (n) => n.type === f.Component)[0]);
  assert.doesNotMatch(progressHtml, /<(?:form|input|textarea|select|button)\b/);
});

test("unpublished is not fabricated 0%; published 0 and 100 are valid; optional sections are omitted", async () => {
  const f = fixture();
  f.result({ data: [], error: null });
  let html = renderToStaticMarkup(await f.page());
  assert.match(html, /Оновлення прогресу ще не опубліковано/);
  assert.match(html, /Сад 47/); assert.match(html, /Вулиця Садова/);
  assert.doesNotMatch(html, /role="progressbar"|>\s*0%(?:<!-- -->)?\s*<|Що виконано|Що далі|Останнє оновлення/);
  for (const value of [0, 100]) {
    f.result({ data: [{ ...progress(), overall_percent: value, completed_summary: null, next_summary: null, stages: [] }], error: null });
    html = renderToStaticMarkup(await f.page());
    assert.ok(html.includes(`aria-valuenow="${value}"`));
    assert.ok(html.includes(`width:${value}%`));
    assert.doesNotMatch(html, /Оновлення прогресу ще не опубліковано|Що виконано|Що далі|Етапи проєкту/);
  }
});

test("only exact client DTO reaches presentation; actors/version/finance/notes never enter props or markup", async () => {
  const f = fixture();
  f.result({ data: [{ ...progress(), version: 999, created_by: "SECRET_ACTOR", updated_by: "SECRET_ACTOR", created_at: "SECRET_DATE", cost: "SECRET_COST", private_note: "SECRET_NOTE",
    stages: progress().stages.map((s) => ({ ...s, employee_id: "SECRET_EMPLOYEE", internal_note: "SECRET_STAGE" })) }], error: null });
  const tree = await f.page();
  const dto = nodes(tree, (n) => n.type === f.Component)[0].props.progress;
  assert.deepEqual(Object.keys(dto), ["object_id", "overall_percent", "completed_summary", "next_summary", "updated_at", "stages"]);
  for (const stage of dto.stages) assert.deepEqual(Object.keys(stage), ["id", "title", "status", "sort_order"]);
  assert.doesNotMatch(JSON.stringify(tree), /SECRET_|"version"|"created_by"|"updated_by"|"employee_id"/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /SECRET_/);
});

test("mocked session A/B authorization is preserved: cross-object/missing/revoked pages fail before progress read", async () => {
  const f = fixture();
  assert.match(renderToStaticMarkup(await f.page("47")), /Сад 47/);
  f.session("B");
  assert.match(renderToStaticMarkup(await f.page("48")), /Сад 48/);
  for (const [session, id] of [["A", "48"], ["B", "47"], ["A", "999"]]) {
    f.session(session);
    const before = f.calls.length;
    await assert.rejects(() => f.page(id), is404);
    assert.equal(f.calls.length, before + 1);
    assert.equal(f.calls.at(-1).name, "get_client_object");
    // Independent service guard also rejects a direct progress request.
    await assert.rejects(() => f.service.getClientObjectProgress(Number(id)), is404);
  }
  f.session("A"); f.grants.A.delete(47);
  await assert.rejects(() => f.page(), is404);
});

test("revocation/identity loss between object and progress reads still escapes fallback as notFound/redirect", async () => {
  const f = fixture();
  f.afterObject(() => f.grants.A.delete(47));
  await assert.rejects(() => f.page(), is404);
  assert.equal(f.calls.length, 2);
  const blocked = fixture();
  blocked.afterObject(() => blocked.identity("denied"));
  await assert.rejects(() => blocked.page(), (error) => error.digest.startsWith("NEXT_REDIRECT;") && error.digest.includes("/access-denied"));
  assert.equal(blocked.calls.length, 1);
  for (const identity of ["denied", "guest", "internal"]) {
    const fixtureForRole = fixture(); fixtureForRole.identity(identity);
    await assert.rejects(() => fixtureForRole.page(), (error) => error.digest.startsWith("NEXT_REDIRECT;"));
    assert.equal(fixtureForRole.calls.length, 0);
  }
});

test("ordinary RPC/network/malformed-result failures preserve authorized object and render only safe error text", async () => {
  for (const result of [
    { data: null, error: { code: "XX000", message: "SECRET_BACKEND", details: "SECRET_STACK" } },
    () => { throw new Error("SECRET_NETWORK"); },
    { data: [{ ...progress(), overall_percent: 200 }], error: null },
  ]) {
    const f = fixture(); f.result(result);
    const tree = await f.page(); const html = renderToStaticMarkup(tree);
    assert.match(html, /Сад 47/);
    assert.match(html, /Не вдалося завантажити оновлення прогресу/);
    assert.doesNotMatch(html, /SECRET_|progressbar|Оновлення прогресу ще не опубліковано/);
    assert.doesNotMatch(JSON.stringify(tree), /SECRET_/);
  }
  const wrongObject = fixture();
  wrongObject.result({ data: [progress(48)], error: null });
  await assert.rejects(() => wrongObject.page(), is404);
});

test("public text is escaped, queries are repeated per request, invalid IDs never reach RPC", async () => {
  const f = fixture();
  f.result({ data: [{ ...progress(), completed_summary: "<script>alert('x')</script>", next_summary: null }], error: null });
  const html = renderToStaticMarkup(await f.page());
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  f.result({ data: [{ ...progress(), overall_percent: 72 }], error: null });
  assert.match(renderToStaticMarkup(await f.page()), /72%/);
  const perRequest = [
    ["get_client_object", { p_object_id: 47 }],
    ["get_client_object_progress", { p_object_id: 47 }],
    ["get_client_object_photos", { p_object_id: 47, p_page: 1 }],
  ];
  assert.deepEqual(f.calls.map(({ name, args }) => [name, args]), [...perRequest, ...perRequest]);
  const beforeInvalidRequests = f.calls.length;
  for (const id of ["invalid", "0", "-1", "99999999999999999999"]) await assert.rejects(() => f.page(id), is404);
  assert.equal(f.calls.length, beforeInvalidRequests);
});

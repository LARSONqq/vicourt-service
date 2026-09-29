// Presentation/interaction checks only; production DB and browser are not used.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (p) => readFileSync(p, "utf8");
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const js = ts.transpileModule(read(filename), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => {
        delete props.prefetch;
        return React.createElement("a", { href, ...props }, children);
      } };
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", js)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const nodes = (tree, match) => !tree || typeof tree !== "object" ? [] : Array.isArray(tree)
  ? tree.flatMap((n) => nodes(n, match)) : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
const html = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));

test("landing uses only supplied client objects, no single-object redirect; touch card/name/address/status and empty pagination", async () => {
  const calls = [];
  let items = [{ id: 47, name: "Назва".repeat(70), address: "Адреса".repeat(70), status: "В роботі" }];
  const Page = loader({ "@/services/clientPortalService": { getClientObjectsPage: async (page) => {
    calls.push(page); return { items, page, hasMore: page === 2 };
  } } })("app/client/page.tsx").default;
  const tree = await Page({ searchParams: Promise.resolve({ page: "2" }) });
  const markup = renderToStaticMarkup(tree);
  assert.deepEqual(calls, [2]);
  assert.match(markup, /Відкрити об’єкт/); assert.match(markup, /href="\/client\/objects\/47"/);
  assert.ok(markup.includes(items[0].name)); assert.ok(markup.includes(items[0].address));
  assert.match(markup, /href="\/client\?page=1"/); assert.match(markup, /href="\/client\?page=3"/);
  assert.match(markup, /min-w-0/); assert.match(markup, /overflow-wrap:anywhere/);
  items = [];
  const empty = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.match(empty, /Поки немає доступних об’єктів/); assert.doesNotMatch(empty, /Сторінки об’єктів/);
});

test("section anchors retain query params; active hash supports deep links, unknown hash and Back/Forward, with cleanup", () => {
  const previous = globalThis.window, events = new Map();
  let subscription, snapshot, serverSnapshot, changes = 0;
  globalThis.window = { location: { hash: "" },
    addEventListener: (event, fn) => events.set(event, fn), removeEventListener: (event) => events.delete(event) };
  try {
    const Navigation = loader({ react: { ...React, useSyncExternalStore: (subscribe, getSnapshot, getServerSnapshot) => {
      subscription = subscribe; snapshot = getSnapshot; serverSnapshot = getServerSnapshot;
      return getSnapshot();
    } } })("components/client/ClientObjectNavigation.tsx").default;
    const ids = ["client-overview", "client-progress-title", "client-photos-title", "client-documents-title"];
    for (const id of [...ids, "unknown"]) {
      window.location.hash = `#${id}`;
      const tree = Navigation(), links = nodes(tree, (n) => n.type === "a");
      assert.equal(links.length, 4);
      assert.equal(links.filter((n) => n.props["aria-current"] === "location").length, 1);
      assert.equal(links.find((n) => n.props["aria-current"]).props.href, `#${ids.includes(id) ? id : ids[0]}`);
      for (const link of links) {
        const url = new URL(link.props.href, "https://example.test/client/objects/47?photoPage=2&documentPage=3");
        assert.equal(url.search, "?photoPage=2&documentPage=3");
        assert.match(link.props.className, /min-h-11/);
      }
    }
    const cleanup = subscription(() => { changes++; });
    window.location.hash = "#client-photos-title"; events.get("hashchange")();
    assert.equal(snapshot(), "client-photos-title");
    window.location.hash = "#client-documents-title"; events.get("popstate")();
    assert.equal(snapshot(), "client-documents-title"); assert.equal(serverSnapshot(), "client-overview");
    assert.equal(changes, 2); cleanup(); assert.equal(events.size, 0);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test("manual percent remains authoritative even when all stages completed; 0/100, no stages and unpublished stay distinct", () => {
  const Progress = loader()("components/client/ClientObjectProgress.tsx").default;
  const progress = { object_id: 47, overall_percent: 17, completed_summary: null, next_summary: null,
    updated_at: "2026-09-28T10:00:00Z", stages: [{ id: 1, title: "Готово", status: "completed", sort_order: 0 }] };
  assert.match(html(Progress, { progress }), /aria-valuenow="17"/);
  for (const overall_percent of [0, 100]) {
    const markup = html(Progress, { progress: { ...progress, overall_percent, stages: [] } });
    assert.ok(markup.includes(`aria-valuenow="${overall_percent}"`));
    assert.match(markup, /Етапи проєкту ще не додано/); assert.doesNotMatch(markup, /<ol/);
  }
  assert.doesNotMatch(html(Progress, { progress: null }), /role="progressbar"|Останнє оновлення/);
});

test("shared loading/empty/error/not-found views render safe copy and retry without error detail props", () => {
  const load = loader();
  assert.match(html(load("app/client/loading.tsx").default), /role="status".*aria-label="Завантаження кабінету"/);
  const NotFound = load("app/client/not-found.tsx").default;
  const markup = html(NotFound);
  assert.match(markup, /Сторінка недоступна/); assert.match(markup, /href="\/client"/);
  let retried = 0;
  const ErrorView = load("app/client/error.tsx").default;
  const tree = ErrorView({ reset: () => { retried++; }, error: new Error("SECRET_DB_PATH") });
  nodes(tree, (n) => n.type === "button")[0].props.onClick();
  assert.equal(retried, 1); assert.doesNotMatch(renderToStaticMarkup(tree), /SECRET_DB_PATH/);
});

test("photo load failure stays local and client-safe; dialog open/close and same-origin source remain intact", () => {
  const state = []; let cursor = 0, shown = 0, closed = 0;
  const ref = { current: { showModal: () => { shown++; }, close: () => { closed++; } } };
  const Gallery = loader({ react: { ...React,
    useRef: () => ref,
    useState: (initial) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (v) => { state[i] = v; }]; },
  } })("components/client/ClientObjectPhotos.tsx").default;
  const props = { objectId: 47, photos: { items: [{ id: 11, object_id: 47, caption: "Клієнтський підпис" }], page: 1, hasNextPage: false } };
  const render = () => { cursor = 0; return Gallery(props); };
  let tree = render();
  nodes(tree, (n) => n.type === "button" && n.props["aria-haspopup"] === "dialog")[0].props.onClick();
  tree = render(); assert.equal(shown, 1);
  const preview = nodes(tree, (n) => n.props?.preview === true)[0];
  const imageTree = preview.type(preview.props);
  const image = nodes(imageTree, (n) => n.type === "img")[0];
  assert.equal(image.props.src, "/client/objects/47/photos/11/file");
  assert.equal(image.props.alt, "Клієнтський підпис");
  image.props.onError({ message: "SECRET_STORAGE" });
  cursor = 1;
  const failed = renderToStaticMarkup(preview.type(preview.props));
  assert.match(failed, /Фото тимчасово недоступне/); assert.doesNotMatch(failed, /SECRET|<img/);
  let prevented = false;
  nodes(tree, (n) => n.type === "dialog")[0].props.onCancel({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(closed, 1);
  assert.equal(nodes(render(), (n) => n.props?.preview === true).length, 0);
});

test("polish components have no data/management/file metadata dependencies; object authorizations still precede UI", () => {
  for (const file of ["ClientObjectNavigation", "ClientObjectStatus", "ClientPortalState", "ClientObjectProgress", "ClientObjectPhotos", "ClientObjectDocuments"]) {
    const source = read(`components/client/${file}.tsx`);
    assert.doesNotMatch(source, /storage_path|original_file_name|access_level|created_by|SERVICE_ROLE|createSignedUrl|get_management_|@\/services\/|@\/lib\/supabase/);
  }
  const source = read("app/client/objects/[id]/page.tsx");
  for (const fn of ["getClientObject", "getClientObjectProgress", "getClientObjectPhotosPage", "getClientObjectDocumentsPage"])
    assert.ok(source.indexOf(`await ${fn}(`) < source.indexOf("return <>"));
  assert.doesNotMatch(read("app/client/layout.tsx"), /Sidebar|AppShell|Header.*@\/components\/layout/);
  assert.match(read("app/client/layout.tsx"), /await requireClientAccess\(\)/);
});

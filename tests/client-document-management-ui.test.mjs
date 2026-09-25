// Mocked server/component flows only. No SQL, Storage calls or browser smoke.
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
    const code = ts.transpileModule(read(filename), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      const stub = fallback?.(name); if (stub) return stub;
      if (name.startsWith("@/")) { const base = resolve(name.slice(2)); return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`); }
      return require(name);
    };
    new Function("require", "module", "exports", code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const first = (tree, type) => nodes(tree, (n) => n.type === type)[0];
const button = (tree, label) => nodes(tree, (n) => n.type === "button" && text(n) === label)[0];
const inputNode = (tree, type) => nodes(tree, (n) => n.type === "input" && n.props.type === type)[0];
const time = "2026-09-25T09:00:00Z";
const state = (published = false) => ({ document_id: 11, is_published: published, client_title: published ? "План для клієнта" : null,
  client_description: null, sort_order: 0 });
const snapshot = (published = false) => ({ ...state(published), object_id: 47, published_at: published ? time : null,
  unpublished_at: null, updated_at: published ? time : null });
const documents = [11, 12].map((id) => ({ id, object_id: 47, title: `План ${id}`, category: "drawing", access_level: "team",
  original_file_name: "SECRET_FILENAME", storage_path: `SECRET_PATH/${id}.pdf`, note: "SECRET_NOTE", created_by: "SECRET_ACTOR",
  mime_type: "application/pdf", file_size: 1234, created_at: time, updated_at: time }));
const input = () => ({ object_id: 47, document_id: 11, is_published: true, client_title: "План для клієнта", client_description: null, sort_order: 0 });

test("Documents tab batches only current-page IDs for management; worker never queries or receives publication state", async () => {
  for (const role of ["admin", "object_manager", "worker"]) {
    const calls = []; let fail = false, items = documents;
    function Documents() {}
    const Page = loader({
      "@/components/ObjectTabs": loader()("components/ObjectTabs.tsx"),
      "next/navigation": { notFound: () => { throw Error("not-found"); } },
      "@/components/objects/ObjectDocuments": { __esModule: true, default: Documents },
      "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: true }) },
      "@/services/accountIdentityService": { getAccountIdentity: async () => "internal" },
      "@/services/objectService": { getObject: async () => ({ id: 47 }), getManagementObject: async () => ({ id: 47 }) },
      "@/services/objectDocumentService": { getObjectDocumentsPage: async (id, page) => {
        assert.equal(id, 47); assert.equal(page, 2);
        return { items, page: 2, pageSize: 20, total: 22, hasPreviousPage: true, hasNextPage: false };
      } },
      "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => {
        calls.push(args); if (fail) return { data: null, error: { code: "XX000", message: "SECRET_DB" } };
        return { data: [{ ...snapshot(true), ...Object.fromEntries(["storage_path", "note", "created_by"].map((key) => [key, "SECRET"])) },
          { ...snapshot(), document_id: 12 }], error: null };
      } }) },
    }, (name) => name.startsWith("@/components/") ? { __esModule: true, default: function Stub() {} }
      : name.startsWith("@/services/") && name !== "@/services/clientDocumentManagementService" ? {} : undefined)("app/objects/[id]/page.tsx").default;
    const page = await Page({ params: Promise.resolve({ id: "47" }), searchParams: Promise.resolve({ tab: "documents", page: "2" }) });
    assert.equal(calls.length, 0, "lazy tab only");
    const content = nodes(page, (n) => n.type?.name === "ObjectTabContent")[0];
    const result = await content.type(content.props);
    const props = nodes(result, (n) => n.type === Documents)[0].props;
    assert.deepEqual(props.documents, documents); assert.equal(props.totalCount, 22);
    if (role === "worker") {
      assert.deepEqual(calls, []); assert.equal("publications" in props, false); assert.equal(props.canManage, false);
    } else {
      assert.equal(props.canManage, true);
      assert.deepEqual(calls, [["get_management_client_document_publications", { p_object_id: 47, p_document_ids: [11, 12] }]]);
      assert.deepEqual(props.publications, [state(true), { ...state(), document_id: 12 }]);
      assert.doesNotMatch(JSON.stringify(props.publications), /SECRET|storage_path|original_file_name|access_level|created_by|updated_at|published_at|object_id/);
      fail = true;
      const failed = await content.type(content.props);
      const failedProps = nodes(failed, (n) => n.type === Documents)[0].props;
      assert.equal(failedProps.publications, undefined); assert.deepEqual(failedProps.documents, documents);
    }
    const before = calls.length; items = [];
    await content.type(content.props); assert.equal(calls.length, before, "empty pages skip publication RPC");
  }
});

test("existing desktop/mobile Documents views mount only management controls with narrow editor props", async () => {
  function Editor() {}
  const deletes = [], opens = [];
  const Documents = loader({
    react: { useState: (initial) => [initial, () => {}], useMemo: (fn) => fn() },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/actions/objectDocumentActions": {
      deleteObjectDocument: async (...args) => { deletes.push(args); },
      createObjectDocumentSignedUrl: async (id) => { opens.push(id); return { url: "existing-internal-url" }; },
    },
    "./ObjectDocumentForm": { __esModule: true, default: function Upload() {} },
    "./ObjectDocumentMetadataForm": { __esModule: true, default: function Metadata() {} },
    "./ClientDocumentPublicationEditor": { __esModule: true, default: Editor },
  })("components/objects/ObjectDocuments.tsx").default;
  for (const canManage of [true, false]) {
    const tree = Documents({ objectId: 47, documents, canManage, publications: [state()] });
    const editors = nodes(tree, (n) => n.type === Editor);
    assert.equal(editors.length, canManage ? 4 : 0, "same editor in desktop rows and mobile cards");
    assert.equal(Boolean(button(tree, "+ Додати документ")), canManage);
    assert.equal(Boolean(button(tree, "Видалити")), canManage);
    assert.equal(Boolean(button(tree, "Редагувати")), canManage);
    if (canManage) {
      assert.deepEqual(editors[0].props, { objectId: 47, defaultTitle: "План 11", initialPublication: state() });
      assert.doesNotMatch(JSON.stringify(editors.map((n) => n.props)), /SECRET|storage_path|original_file_name|access_level|created_by|note/);
    }
  }
  globalThis.window = { confirm: () => true, open: () => ({ location: { replace() {} } }) };
  const tree = Documents({ objectId: 47, documents, canManage: true });
  await button(tree, "Відкрити").props.onClick(); await button(tree, "Видалити").props.onClick();
  assert.deepEqual(opens, [11]); assert.deepEqual(deletes, [[11, 47]]);
  const paging = read("services/objectDocumentService.ts");
  assert.match(paging, /OBJECT_DOCUMENT_PAGE_SIZE =\s*20/u);
  assert.match(paging, /\.range\(from, to\)/u);
  assert.match(paging, /\.eq\("is_ready", true\)/u);
});

function actionFixture() {
  let identity = "internal", profile = { role: "admin", is_active: true }, result = { data: [snapshot(true)], error: null };
  const calls = [], invalidations = [];
  const action = loader({
    "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => ({
      rpc: async (...args) => { calls.push(args); if (result instanceof Error) throw result; return result; },
      from: () => assert.fail("no direct publication table writes"),
    }) },
  })("app/actions/clientDocumentActions.ts").saveClientDocumentPublication;
  return { action, calls, invalidations, identity: (value) => { identity = value; }, profile: (value) => { profile = value; }, result: (value) => { result = value; } };
}

test("publication action rejects worker/client/inactive before RPC; management uses canonical service and returns only editor state", async () => {
  const f = actionFixture();
  for (const profile of [null, { role: "worker", is_active: true }, { role: "admin", is_active: false }]) {
    f.profile(profile); assert.equal((await f.action(input())).ok, false);
  }
  f.identity("client"); f.profile({ role: "admin", is_active: true }); assert.equal((await f.action(input())).ok, false);
  assert.equal(f.calls.length, 0); assert.equal(f.invalidations.length, 0); f.identity("internal");
  for (const role of ["admin", "object_manager"]) {
    f.profile({ role, is_active: true });
    f.result({ data: [{ ...snapshot(true), storage_path: "SECRET", note: "SECRET", created_by: "SECRET", access_level: "SECRET", original_file_name: "SECRET" }], error: null });
    assert.deepEqual(await f.action({ ...input(), created_by: "fake" }), { ok: true, publication: state(true) });
    assert.deepEqual(f.calls.at(-1), ["set_client_object_document_publication", {
      p_object_id: 47, p_document_id: 11, p_is_published: true, p_client_title: "План для клієнта", p_client_description: null, p_sort_order: 0,
    }]);
  }
  assert.deepEqual(f.invalidations, ["/objects/47", "/client/objects/47", "/objects/47", "/client/objects/47"]);
  const before = f.calls.length;
  for (const change of [{ client_title: "" }, { client_title: " " }, { client_title: "x".repeat(151) }, { client_description: "x".repeat(1001) },
    { sort_order: -1 }, { sort_order: 0.5 }, { sort_order: 2147483648 }, { document_id: "11" }]) {
    assert.equal((await f.action({ ...input(), ...change })).ok, false);
  }
  assert.equal(f.calls.length, before);
});

test("action reports safe denial/unsafe/not-ready/not-found/network errors without raw DB details or success invalidations", async () => {
  const f = actionFixture();
  for (const [code, expected] of [["42501", /Недостатньо прав/u], ["22023", /готовність файла.*дозволеним/u], ["P0002", /більше не знайдено/u], ["XX000", /Не вдалося/u]]) {
    f.result({ data: null, error: { code, message: "SECRET_SQL", details: "SECRET_METADATA" } });
    const response = await f.action(input());
    assert.equal(response.ok, false); assert.match(response.message, expected); assert.doesNotMatch(JSON.stringify(response), /SECRET/);
  }
  f.result(Error("SECRET_NETWORK")); assert.doesNotMatch(JSON.stringify(await f.action(input())), /SECRET/);
  assert.deepEqual(f.invalidations, []);
});

test("unpublish action changes only publication state and retains metadata through canonical RPC", async () => {
  const f = actionFixture();
  f.result({ data: [{ ...snapshot(true), is_published: false, unpublished_at: time }], error: null });
  const result = await f.action({ ...input(), is_published: false });
  assert.deepEqual(result, { ok: true, publication: { ...state(true), is_published: false } });
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], "set_client_object_document_publication");
  assert.deepEqual(f.calls[0][1], { p_object_id: 47, p_document_id: 11, p_is_published: false,
    p_client_title: "План для клієнта", p_client_description: null, p_sort_order: 0 });
});

function editorFixture(initialPublication = state()) {
  const slots = []; let cursor = 0, confirm = true, refreshes = 0;
  const calls = [], confirmations = [];
  let save = async (value) => ({ ok: true, publication: { document_id: value.document_id, is_published: value.is_published,
    client_title: value.client_title, client_description: value.client_description, sort_order: value.sort_order } });
  const Editor = loader({
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], (value) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "@/app/actions/clientDocumentActions": { saveClientDocumentPublication: async (value) => { calls.push(value); return save(value); } },
  })("components/objects/ClientDocumentPublicationEditor.tsx").default;
  globalThis.window = { confirm: (message) => { confirmations.push(message); return confirm; } };
  const render = () => { cursor = 0; return Editor({ objectId: 47, defaultTitle: "Внутрішня назва", initialPublication }); };
  const submit = () => first(render(), "form").props.onSubmit({ preventDefault() {} });
  return { render, submit, calls, confirmations, refreshes: () => refreshes, confirm: (value) => { confirm = value; }, save: (value) => { save = value; } };
}

test("first publication defaults only title from internal document, empty description/order zero, explicit opt-in and confirmation", async () => {
  const f = editorFixture(); assert.match(text(f.render()), /Не опубліковано/u);
  button(f.render(), "Доступ клієнта").props.onClick();
  assert.equal(inputNode(f.render(), "text").props.value, "Внутрішня назва");
  assert.equal(first(f.render(), "textarea").props.value, "");
  assert.equal(inputNode(f.render(), "number").props.value, "0");
  assert.equal(inputNode(f.render(), "checkbox").props.checked, false);
  assert.deepEqual(f.calls, []);
  inputNode(f.render(), "checkbox").props.onChange({ target: { checked: true } });
  assert.equal(f.calls.length, 0);
  f.confirm(false); await f.submit(); assert.equal(f.calls.length, 0);
  f.confirm(true); await f.submit();
  assert.deepEqual(f.calls, [{ ...input(), client_title: "Внутрішня назва" }]);
  assert.match(f.confirmations[0], /клієнти, які мають доступ/u);
  assert.match(text(f.render()), /Видно клієнту/u); assert.equal(first(f.render(), "form"), undefined);
  assert.equal(f.refreshes(), 1);
});

test("editor validates required/limited title, description and int32 order locally; private publication draft remains private", async () => {
  const f = editorFixture(); button(f.render(), "Доступ клієнта").props.onClick();
  for (const value of ["", "   ", "x".repeat(151)]) {
    inputNode(f.render(), "text").props.onChange({ target: { value } }); await f.submit();
    assert.match(text(f.render()), /назву для клієнта від 1 до 150/u);
  }
  inputNode(f.render(), "text").props.onChange({ target: { value: " Назва " } });
  first(f.render(), "textarea").props.onChange({ target: { value: "x".repeat(1001) } }); await f.submit();
  assert.match(text(f.render()), /не більше 1000/u);
  first(f.render(), "textarea").props.onChange({ target: { value: "   " } });
  for (const value of ["", "-1", "1.5", "2147483648"]) {
    inputNode(f.render(), "number").props.onChange({ target: { value } }); await f.submit();
    assert.match(text(f.render()), /Порядок має бути цілим/u);
  }
  assert.equal(f.calls.length, 0);
  inputNode(f.render(), "number").props.onChange({ target: { value: "0" } }); await f.submit();
  assert.deepEqual(f.calls, [{ ...input(), is_published: false, client_title: "Назва" }]);
  assert.match(text(f.render()), /Не опубліковано/u); assert.equal(f.confirmations.length, 0);
});

test("edit keeps client metadata, unpublish preserves saved values and source; cancel never mutates", async () => {
  const f = editorFixture({ ...state(true), client_description: "Публічний опис", sort_order: 3 });
  button(f.render(), "Доступ клієнта").props.onClick();
  assert.equal(inputNode(f.render(), "text").props.value, "План для клієнта");
  assert.equal(first(f.render(), "textarea").props.value, "Публічний опис");
  inputNode(f.render(), "text").props.onChange({ target: { value: "Не збережено" } });
  button(f.render(), "Скасувати").props.onClick(); assert.equal(f.calls.length, 0);
  button(f.render(), "Доступ клієнта").props.onClick();
  assert.equal(inputNode(f.render(), "text").props.value, "План для клієнта");
  inputNode(f.render(), "text").props.onChange({ target: { value: " Новий план " } });
  await f.submit(); assert.equal(f.confirmations.length, 0);
  assert.deepEqual(f.calls.at(-1), { ...input(), client_title: "Новий план", client_description: "Публічний опис", sort_order: 3 });
  f.confirm(false); await button(f.render(), "Приховати від клієнта").props.onClick(); assert.equal(f.calls.length, 1);
  f.confirm(true); await button(f.render(), "Приховати від клієнта").props.onClick();
  assert.deepEqual(f.calls.at(-1), { ...input(), is_published: false, client_title: "Новий план", client_description: "Публічний опис", sort_order: 3 });
  assert.match(f.confirmations.at(-1), /Оригінал залишиться/u); assert.match(text(f.render()), /Не опубліковано/u);
});

test("publication checkbox supports confirmed unpublish with metadata editing", async () => {
  const f = editorFixture(state(true)); button(f.render(), "Доступ клієнта").props.onClick();
  inputNode(f.render(), "checkbox").props.onChange({ target: { checked: false } });
  f.confirm(false); await f.submit(); assert.equal(f.calls.length, 0);
  f.confirm(true); await f.submit(); assert.deepEqual(f.calls, [{ ...input(), is_published: false }]);
});

test("pending lock prevents duplicate mutations; safe errors preserve draft and unlock without automatic retry", async () => {
  const f = editorFixture(state(true)); button(f.render(), "Доступ клієнта").props.onClick();
  inputNode(f.render(), "text").props.onChange({ target: { value: "Змінена назва" } });
  let finish;
  f.save(() => new Promise((resolve) => { finish = resolve; }));
  const pending = f.submit(); await f.submit(); assert.equal(f.calls.length, 1);
  assert.equal(first(f.render(), "fieldset").props.disabled, true);
  finish({ ok: false, message: "Перевірте готовність файла. Формат документа має бути дозволеним." }); await pending;
  assert.match(text(first(f.render(), "form")), /Назва для клієнта/u);
  assert.match(text(nodes(f.render(), (n) => n.props?.role === "alert")[0]), /готовність файла/u);
  assert.equal(inputNode(f.render(), "text").props.value, "Змінена назва");
  assert.equal(first(f.render(), "fieldset").props.disabled, false); assert.equal(f.refreshes(), 0);
  f.save(async () => { throw Error("SECRET_NETWORK"); }); await f.submit();
  assert.doesNotMatch(text(f.render()), /SECRET/u); assert.equal(f.calls.length, 2);
  assert.equal(first(f.render(), "fieldset").props.disabled, false);
});

test("unknown publication state is not unpublished and cannot mutate; new flow has no storage/table writes", () => {
  const f = editorFixture(null); assert.match(text(f.render()), /Стан публікації недоступний/u);
  assert.equal(button(f.render(), "Доступ клієнта"), undefined); assert.doesNotMatch(text(f.render()), /Не опубліковано/u);
  button(f.render(), "Оновити стан публікації").props.onClick(); assert.equal(f.refreshes(), 1); assert.equal(f.calls.length, 0);
  const action = read("app/actions/clientDocumentActions.ts"), editor = read("components/objects/ClientDocumentPublicationEditor.tsx");
  assert.match(action, /^"use server";/u); assert.match(editor, /^"use client";/u);
  assert.doesNotMatch(action + editor, /deleteObjectDocument|\.remove\(|\.delete\(|supabase|storage_path|original_file_name|access_level|created_by|createSignedUrl/iu);
});

// Mocked server/component flows only. No SQL, Storage request or browser smoke.
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
const state = (published = false) => ({ photo_id: 11, is_published: published, client_caption: null, sort_order: 0 });
const snapshot = (published = false) => ({ ...state(published), object_id: 47, published_at: published ? "2026-09-22T09:00:00Z" : null,
  unpublished_at: null, updated_at: null });
const photos = [11, 12].map((id) => ({ id, object_id: 47, caption: "INTERNAL", storage_path: `47/${id}.jpg`, public_url: `signed:${id}` }));

test("only management batches current-page publication IDs; worker receives no publication props/query; failure stays local", async () => {
  for (const role of ["admin", "object_manager", "worker"]) {
    const calls = []; let fail = false;
    function Gallery() {}
    const Page = loader({
      "@/components/ObjectTabs": loader()("components/ObjectTabs.tsx"),
      "next/navigation": { notFound: () => { throw Error("not-found"); } },
      "@/components/objects/ObjectPhotos": { __esModule: true, default: Gallery },
      "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: true }) },
      "@/services/objectService": { getObject: async () => ({ id: 47 }), getManagementObject: async () => ({ id: 47 }) },
      "@/services/objectDetailService": { getObjectPhotosPage: async (id, page) => {
        assert.equal(id, 47); assert.equal(page, 2);
        return { items: photos, page: 2, pageSize: 12, total: 14, hasPreviousPage: true, hasNextPage: false };
      } },
      "@/services/clientPhotoManagementService": { getManagementClientPhotoPublications: async (...args) => {
        calls.push(args); if (fail) throw Error("SECRET_DB");
        return [snapshot(true), { ...snapshot(), photo_id: 12, created_by: "SECRET" }];
      } },
    }, (name) => name.startsWith("@/components/") ? { __esModule: true, default: function Stub() {} }
      : name.startsWith("@/services/") ? {} : undefined)("app/objects/[id]/page.tsx").default;
    const page = await Page({ params: Promise.resolve({ id: "47" }), searchParams: Promise.resolve({ tab: "photos", page: "2" }) });
    assert.equal(calls.length, 0);
    const content = nodes(page, (n) => n.type?.name === "ObjectTabContent")[0];
    const result = await content.type(content.props);
    const props = nodes(result, (n) => n.type === Gallery)[0].props;
    assert.deepEqual(props.photos, photos);
    if (role === "worker") {
      assert.deepEqual(calls, []); assert.equal("publications" in props, false); assert.equal(props.canManage, false);
    } else {
      assert.deepEqual(calls, [[47, [11, 12]]]);
      assert.deepEqual(props.publications, [state(true), { ...state(), photo_id: 12 }]);
      assert.doesNotMatch(JSON.stringify(props.publications), /SECRET|updated_at|published_at|object_id|created_by/);
      fail = true;
      const failed = await content.type(content.props);
      const failedProps = nodes(failed, (n) => n.type === Gallery)[0].props;
      assert.equal(failedProps.publications, undefined); assert.deepEqual(failedProps.photos, photos);
    }
  }
});

test("gallery keeps upload/delete/signed images and only mounts publication controls for management", () => {
  function Editor() {}
  const Gallery = loader({
    react: { useState: (initial) => [initial, () => {}] },
    "@/app/actions/photoActions": { deleteObjectPhoto: () => {} },
    "./AddPhotoForm": { __esModule: true, default: function Upload() {} },
    "./ClientPhotoPublicationEditor": { __esModule: true, default: Editor },
  })("components/objects/ObjectPhotos.tsx").default;
  for (const canManage of [true, false]) {
    const tree = Gallery({ objectId: 47, photos, canManage, publications: [state()] });
    assert.equal(nodes(tree, (n) => n.type === Editor).length, canManage ? 2 : 0);
    assert.equal(nodes(tree, (n) => n.type === "form").length, canManage ? 2 : 0);
    assert.equal(Boolean(button(tree, "+ Додати фото")), canManage);
    assert.deepEqual(nodes(tree, (n) => n.type === "a").map((n) => n.props.href), ["signed:11", "signed:12"]);
    if (canManage) assert.deepEqual(nodes(tree, (n) => n.type === Editor)[0].props, { objectId: 47, initialPublication: state() });
  }
  const paging = read("services/objectDetailService.ts");
  assert.match(paging, /OBJECT_PHOTO_PAGE_SIZE = 12/u);
  assert.match(paging, /createSignedUrls\(/u);
});

function actionFixture() {
  let identity = "internal", profile = { role: "admin", is_active: true }, result = { data: [snapshot(true)], error: null };
  const calls = [], invalidations = [];
  const action = loader({
    "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => { calls.push(args); if (result instanceof Error) throw result; return result; } }) },
  })("app/actions/clientPhotoActions.ts").saveClientPhotoPublication;
  return { action, calls, invalidations, identity: (value) => { identity = value; }, profile: (value) => { profile = value; }, result: (value) => { result = value; } };
}
const input = () => ({ object_id: 47, photo_id: 11, is_published: true, client_caption: null, sort_order: 0 });
test("action rejects worker/client/inactive before RPC; management validates and returns narrow result, revalidating only success", async () => {
  const f = actionFixture();
  for (const role of ["worker", "admin"]) {
    f.profile({ role, is_active: role === "worker" }); assert.equal((await f.action(input())).ok, false);
  }
  f.identity("client"); f.profile({ role: "admin", is_active: true }); assert.equal((await f.action(input())).ok, false);
  assert.equal(f.calls.length, 0); f.identity("internal");
  for (const role of ["admin", "object_manager"]) {
    f.profile({ role, is_active: true });
    assert.deepEqual(await f.action({ ...input(), created_by: "fake" }), { ok: true, publication: state(true) });
    assert.deepEqual(f.calls.at(-1), ["set_client_object_photo_publication", {
      p_object_id: 47, p_photo_id: 11, p_is_published: true, p_client_caption: null, p_sort_order: 0,
    }]);
  }
  assert.deepEqual(f.invalidations, ["/objects/47", "/client/objects/47", "/objects/47", "/client/objects/47"]);
  const before = f.calls.length;
  for (const change of [{ sort_order: -1 }, { sort_order: 1.5 }, { client_caption: "x".repeat(501) }, { photo_id: "11" }]) {
    assert.equal((await f.action({ ...input(), ...change })).ok, false);
  }
  assert.equal(f.calls.length, before);
});
test("expected errors are safe and generic DB/network details never cross action boundary", async () => {
  const f = actionFixture();
  for (const [code, message] of [["22023", /JPEG.*PNG.*WebP.*GIF.*AVIF/u], ["P0002", /більше не знайдено/u], ["42501", /Недостатньо прав/u], ["XX000", /Не вдалося/u]]) {
    f.result({ data: null, error: { code, message: "SECRET_SQL", details: "SECRET_STACK" } });
    const value = await f.action(input()); assert.equal(value.ok, false); assert.match(value.message, message);
    assert.doesNotMatch(JSON.stringify(value), /SECRET/);
  }
  f.result(Error("SECRET_NETWORK")); assert.doesNotMatch(JSON.stringify(await f.action(input())), /SECRET/);
  assert.equal(f.invalidations.length, 0);
});

function editorFixture(initialPublication = state()) {
  const slots = []; let cursor = 0, confirm = true, refreshes = 0;
  const calls = [], confirmations = [];
  let save = async (value) => ({ ok: true, publication: { ...value, photo_id: 11 } });
  const Editor = loader({
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], (value) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "@/app/actions/clientPhotoActions": { saveClientPhotoPublication: async (value) => { calls.push(value); return save(value); } },
  })("components/objects/ClientPhotoPublicationEditor.tsx").default;
  globalThis.window = { confirm: (message) => { confirmations.push(message); return confirm; } };
  const render = () => { cursor = 0; return Editor({ objectId: 47, initialPublication }); };
  const submit = () => first(render(), "form").props.onSubmit({ preventDefault() {} });
  return { render, submit, calls, confirmations, refreshes: () => refreshes, confirm: (value) => { confirm = value; }, save: (value) => { save = value; } };
}
test("publication is explicit; caption starts empty, confirmation required, success updates badge and synchronous lock blocks doubles", async () => {
  const f = editorFixture(); assert.match(text(f.render()), /Не опубліковано/u); assert.equal(f.calls.length, 0);
  button(f.render(), "Опублікувати для клієнта").props.onClick();
  assert.equal(first(f.render(), "textarea").props.value, "");
  f.confirm(false); await f.submit(); assert.equal(f.calls.length, 0);
  f.confirm(true); let finish;
  f.save(() => new Promise((resolve) => { finish = resolve; }));
  const pending = f.submit(); await f.submit(); assert.equal(f.calls.length, 1);
  assert.equal(first(f.render(), "fieldset").props.disabled, true);
  assert.match(f.confirmations[0], /клієнти, які мають доступ/u);
  finish({ ok: true, publication: state(true) }); await pending;
  assert.match(text(f.render()), /Видно клієнту/u); assert.equal(first(f.render(), "form"), undefined);
});
test("edit keeps published state; validation/errors preserve draft; unpublish uses saved caption and never deletes original", async () => {
  const f = editorFixture({ ...state(true), client_caption: "Публічний" });
  button(f.render(), "Редагувати публікацію").props.onClick();
  assert.equal(first(f.render(), "textarea").props.value, "Публічний");
  first(f.render(), "input").props.onChange({ target: { value: "-1" } }); await f.submit(); assert.equal(f.calls.length, 0);
  first(f.render(), "input").props.onChange({ target: { value: "2" } });
  first(f.render(), "textarea").props.onChange({ target: { value: " Новий " } });
  f.save(async () => { throw Error("SECRET"); }); await f.submit();
  assert.doesNotMatch(text(f.render()), /SECRET/u); assert.equal(first(f.render(), "fieldset").props.disabled, false);
  assert.equal(first(f.render(), "textarea").props.value, " Новий ");
  f.save(async () => ({ ok: true, publication: { ...state(true), client_caption: "Новий", sort_order: 2 } }));
  await f.submit(); assert.equal(f.confirmations.length, 0);
  assert.deepEqual(f.calls.at(-1), { ...input(), client_caption: "Новий", sort_order: 2 });
  f.confirm(false); await button(f.render(), "Приховати від клієнта").props.onClick(); assert.equal(f.calls.length, 2);
  f.confirm(true); f.save(async () => ({ ok: true, publication: { ...state(), client_caption: "Новий", sort_order: 2 } }));
  await button(f.render(), "Приховати від клієнта").props.onClick();
  assert.deepEqual(f.calls.at(-1), { ...input(), is_published: false, client_caption: "Новий", sort_order: 2 });
  assert.match(text(f.render()), /Не опубліковано/u);
  assert.doesNotMatch(read("app/actions/clientPhotoActions.ts") + read("components/objects/ClientPhotoPublicationEditor.tsx"), /deleteObjectPhoto|\.remove\(|\.delete\(|service.role|supabaseAdmin/iu);
});
test("unknown publication state never fabricates unpublished status or enables mutation", () => {
  const f = editorFixture(null); const tree = f.render();
  assert.match(text(tree), /Стан публікації недоступний/u); assert.doesNotMatch(text(tree), /Не опубліковано|Опублікувати для клієнта/u);
  button(tree, "Оновити стан").props.onClick(); assert.equal(f.refreshes(), 1); assert.equal(f.calls.length, 0);
});

test("server validation failure stays in editor without retry, preserves draft and releases submit lock", async () => {
  const f = editorFixture();
  button(f.render(), "Опублікувати для клієнта").props.onClick();
  first(f.render(), "textarea").props.onChange({ target: { value: "Підпис для клієнта" } });
  f.save(async () => ({ ok: false, message: "Для публікації доступні лише JPEG, PNG, WebP, GIF або AVIF з відповідним розширенням." }));
  await f.submit();
  assert.equal(f.calls.length, 1);
  assert.match(text(nodes(f.render(), (n) => n.props?.role === "alert")[0]), /JPEG.*AVIF/u);
  assert.equal(first(f.render(), "textarea").props.value, "Підпис для клієнта");
  assert.equal(first(f.render(), "fieldset").props.disabled, false);
  assert.match(text(f.render()), /Не опубліковано/u);
});

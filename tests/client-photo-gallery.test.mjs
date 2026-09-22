// Real page, DTO, services and file handler with mocked user-scoped RPC/Storage.
// These tests do not execute SQL or prove production Storage RLS behavior.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { notFound, redirect } = require("next/navigation");
const read = (file) => readFileSync(file, "utf8");
function loader(mocks) {
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
const photo = (id = 11, objectId = 47) => ({
  id, object_id: objectId, caption: "Клієнтський підпис", published_at: "2026-09-22T10:00:00Z", total_count: 1,
  storage_path: "SECRET_PATH", internal_caption: "SECRET_CAPTION", created_by: "SECRET_ACTOR",
});
const denied = () => ({ data: null, error: { code: "42501", message: "SECRET_DENIAL" } });
const is404 = (error) => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((n) => nodes(n, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function fixture() {
  let identity = "client", session = "A", galleryResult, fileResult, afterProgress = () => {};
  let downloadResult = { data: new Blob(["mock-image"], { type: "image/jpeg" }), error: null };
  const calls = [], downloads = [], grants = { A: new Set([47]), B: new Set([48]) };
  const load = loader({
    "next/navigation": { notFound, redirect },
    "next/link": { __esModule: true, default: ({ href, children }) => createElement("a", { href }, children) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => ({
      from: () => assert.fail("No direct internal table reads"),
      rpc: async (name, args) => {
        calls.push([name, args]);
        const id = args.p_object_id;
        if (name === "get_client_object") return { data: grants[session].has(id)
          ? [{ id, name: `Сад ${id}`, address: "Садова", status: "В роботі" }] : [], error: null };
        if (!grants[session].has(id)) return denied();
        if (name === "get_client_object_progress") { afterProgress(); return { data: [], error: null }; }
        if (name === "get_client_object_photos") return typeof galleryResult === "function" ? galleryResult(args)
          : galleryResult ?? { data: [photo(11, id)], error: null };
        assert.equal(name, "get_client_object_photo_file", "Only dedicated client RPCs");
        if (fileResult !== undefined) return fileResult;
        return args.p_photo_id === (id === 47 ? 11 : 12)
          ? { data: [{ storage_path: `${id}/mock.jpg` }], error: null } : denied();
      },
      storage: { from: (bucket) => {
        assert.equal(bucket, "object-photos");
        return { download: async (path) => { downloads.push([bucket, path]); return downloadResult; } };
      } },
    }) },
  });
  const Page = load("app/client/objects/[id]/page.tsx").default;
  const Gallery = load("components/client/ClientObjectPhotos.tsx").default;
  const { GET } = load("app/client/objects/[id]/photos/[photoId]/file/route.ts");
  return {
    page: (id = "47", photoPage) => Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ photoPage }) }),
    file: (id = "47", photoId = "11") => GET(new Request("https://example.test/client/photo"), { params: Promise.resolve({ id, photoId }) }),
    service: load("services/clientPhotoService.ts"), Gallery, calls, downloads, grants,
    identity: (v) => { identity = v; }, session: (v) => { session = v; },
    gallery: (v) => { galleryResult = v; }, fileResult: (v) => { fileResult = v; },
    download: (v) => { downloadResult = v; }, afterProgress: (v) => { afterProgress = v; },
  };
}

test("published gallery renders only client caption and same-origin lazy image; DTO/props contain no path or internals", async () => {
  const f = fixture(), tree = await f.page(), html = renderToStaticMarkup(tree);
  const gallery = nodes(tree, (n) => n.type === f.Gallery)[0];
  assert.deepEqual(Object.keys(gallery.props.photos.items[0]), ["id", "object_id", "caption", "published_at"]);
  assert.equal(gallery.props.photos.pageSize, 12);
  assert.doesNotMatch(JSON.stringify(tree), /SECRET_|storage_path|internal_caption|created_by/);
  assert.match(html, /Клієнтський підпис/);
  assert.match(html, /src="\/client\/objects\/47\/photos\/11\/file"/);
  assert.match(html, /loading="lazy"/);
  assert.ok(html.indexOf("Прогрес об’єкта") < html.indexOf('id="client-photos-title"'));
  assert.doesNotMatch(html, /SECRET_|supabase|storage_path/);
  f.gallery({ data: [{ ...photo(), caption: null }], error: null });
  assert.doesNotMatch(renderToStaticMarkup(await f.page()), /Клієнтський підпис|SECRET_CAPTION/);
});

test("zero published photos is a real empty state, distinct from technical/network/malformed failures", async () => {
  const f = fixture(); f.gallery({ data: [], error: null });
  const tree = await f.page();
  assert.deepEqual(nodes(tree, (n) => n.type === f.Gallery)[0].props.photos.items, []);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Фото ще не опубліковано\./); assert.doesNotMatch(html, /<img|Не вдалося завантажити фото/);
  for (const result of [
    { data: null, error: { code: "XX000", message: "SECRET_DB" } },
    () => { throw new Error("SECRET_NETWORK"); },
    { data: [{ ...photo(), id: -1 }], error: null },
  ]) {
    f.gallery(result);
    const failed = renderToStaticMarkup(await f.page());
    assert.match(failed, /Сад 47/);
    assert.match(failed, /Не вдалося завантажити фото. Спробуйте оновити сторінку пізніше\./);
    assert.doesNotMatch(failed, /Фото ще не опубліковано|SECRET_|<img/);
  }
});

test("photo 42501 (returned or thrown) aborts whole page; post-object/progress revocation never returns a partial passport", async () => {
  for (const result of [denied(), () => { throw { code: "42501", message: "SECRET" }; }]) {
    const f = fixture(); f.gallery(result);
    await assert.rejects(() => f.page(), is404);
    assert.deepEqual(f.calls.map(([name]) => name), ["get_client_object", "get_client_object_progress", "get_client_object_photos"]);
  }
  const revoked = fixture(); revoked.afterProgress(() => revoked.grants.A.delete(47));
  await assert.rejects(() => revoked.page(), is404);
  assert.equal(revoked.calls.at(-1)[0], "get_client_object_photos");
  const inactive = fixture(); inactive.afterProgress(() => inactive.identity("denied"));
  await assert.rejects(() => inactive.page(), (error) => error.digest.startsWith("NEXT_REDIRECT;"));
  assert.equal(inactive.calls.length, 2);
});

test("mocked A/B grants are independent on direct gallery service and file route; inactive/revoked identities fail closed", async () => {
  const f = fixture();
  for (const [session, allowed, forbidden] of [["A", 47, 48], ["B", 48, 47]]) {
    f.session(session);
    assert.equal((await f.service.getClientObjectPhotosPage(allowed)).items[0].object_id, allowed);
    await assert.rejects(() => f.service.getClientObjectPhotosPage(forbidden), is404);
    await assert.rejects(() => f.page(String(forbidden)), is404);
    assert.equal((await f.file(String(forbidden))).status, 404);
  }
  f.session("A"); f.grants.A.clear();
  await assert.rejects(() => f.service.getClientObjectPhotosPage(47), is404);
  assert.equal((await f.file()).status, 404);
  for (const identity of ["denied", "guest", "internal"]) {
    f.identity(identity);
    await assert.rejects(() => f.service.getClientObjectPhotosPage(47));
    assert.equal((await f.file()).status, 404);
  }
  assert.deepEqual(f.downloads, []);
});

test("pagination stays scoped at 12/page with URL links, normalized invalid pages and safe out-of-range redirect", async () => {
  const f = fixture();
  f.gallery({ data: Array.from({ length: 12 }, (_, i) => ({ ...photo(i + 1), total_count: 30 })), error: null });
  const tree = await f.page("47", "2"), gallery = nodes(tree, (n) => n.type === f.Gallery)[0];
  assert.equal(gallery.props.photos.pageSize, 12); assert.equal(gallery.props.photos.page, 2);
  assert.equal(gallery.props.photos.items.length, 12); assert.equal(gallery.props.photos.hasNextPage, true);
  assert.deepEqual(f.calls.at(-1), ["get_client_object_photos", { p_object_id: 47, p_page: 2 }]);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /href="\/client\/objects\/47\?photoPage=1"/);
  assert.match(html, /href="\/client\/objects\/47\?photoPage=3"/);
  assert.deepEqual(f.downloads, [], "Metadata never prefetches image binaries");
  for (const page of [undefined, "0", "-1", "1.5", "abc", "100001", ["2", "3"]]) {
    await f.page("47", page);
    assert.equal(f.calls.at(-1)[1].p_page, 1);
  }
  f.gallery({ data: [], error: null });
  await assert.rejects(() => f.page("47", "99"), (error) => error.digest.startsWith("NEXT_REDIRECT;") && error.digest.includes("/client/objects/47?photoPage=1"));
});

test("gallery rejects duplicate IDs, wrong-object rows and inconsistent totals rather than forwarding them", async () => {
  for (const rows of [
    [photo(), photo()], [{ ...photo(), total_count: 0 }],
    [{ ...photo(), total_count: 2 }, { ...photo(12), total_count: 3 }],
  ]) {
    const f = fixture(); f.gallery({ data: rows, error: null });
    assert.match(renderToStaticMarkup(await f.page()), /Не вдалося завантажити фото/);
  }
  const f = fixture(); f.gallery({ data: [photo(11, 48)], error: null });
  await assert.rejects(() => f.page(), is404);
});

function privateResponse(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("location"), null);
}
test("file delivery uses canonical lookup then user-scoped private bucket download, with only reviewed raster MIME responses", async () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
    const f = fixture(); f.download({ data: new Blob(["mock-image"], { type }), error: null });
    const response = await f.file();
    assert.equal(response.status, 200); privateResponse(response);
    assert.equal(response.headers.get("content-type"), type);
    assert.equal(await response.text(), "mock-image");
    assert.deepEqual(f.calls, [["get_client_object_photo_file", { p_object_id: 47, p_photo_id: 11 }]]);
    assert.deepEqual(f.downloads, [["object-photos", "47/mock.jpg"]]);
    assert.doesNotMatch(JSON.stringify([...response.headers]), /mock.jpg|SECRET/);
  }
});

test("SVG/HTML/unknown/missing MIME and unexpected Storage response fail with the same empty private 404", async () => {
  for (const data of [
    ...["image/svg+xml", "text/html", "application/octet-stream", "", "image/jpeg; charset=utf-8"].map((type) => new Blob(["SECRET"], { type })),
    { type: "image/jpeg", body: "SECRET" }, null,
  ]) {
    const f = fixture(); f.download({ data, error: null });
    const response = await f.file();
    assert.equal(response.status, 404); privateResponse(response);
    assert.equal(await response.text(), ""); assert.equal(response.headers.get("content-type"), null);
  }
});

test("wrong-object/unpublished/missing/inaccessible IDs use identical 404 responses without downloading; Storage re-denial is also safe", async () => {
  const f = fixture();
  for (const [object, photoId] of [["48", "11"], ["47", "12"], ["999", "11"], ["47", "999"], ["0", "11"], ["47", "-1"], ["invalid", "11"]]) {
    const response = await f.file(object, photoId);
    assert.equal(response.status, 404); privateResponse(response); assert.equal(await response.text(), "");
  }
  assert.deepEqual(f.downloads, []);
  f.fileResult({ data: [], error: null });
  assert.equal((await f.file()).status, 404); assert.deepEqual(f.downloads, []);
  f.fileResult(undefined);
  f.download({ data: null, error: { message: "SECRET_STORAGE_DENIAL" } });
  const response = await f.file();
  assert.equal(response.status, 404); privateResponse(response); assert.equal(await response.text(), "");
  assert.equal(f.downloads.length, 1, "Storage independently rechecks a previously authorized lookup");
});

test("client flow never uses management RPCs, signed URLs, privileged clients or shared image optimization", () => {
  for (const file of ["services/clientPhotoService.ts", "components/client/ClientObjectPhotos.tsx", "app/client/objects/[id]/page.tsx", "app/client/objects/[id]/photos/[photoId]/file/route.ts"]) {
    assert.doesNotMatch(read(file), /get_management_|clientPhotoManagementService|createSignedUrl|SERVICE_ROLE|supabaseAdmin|next\/image/);
  }
  const gallery = read("components/client/ClientObjectPhotos.tsx");
  assert.doesNotMatch(gallery, /storage_path|internal_caption/);
  assert.match(gallery, /prefetch=\{false\}/);
  assert.match(gallery, /showModal\(\)/); assert.match(gallery, /onCancel=/); assert.match(gallery, /aria-labelledby=/);
  const route = read("app/client/objects/[id]/photos/[photoId]/file/route.ts");
  assert.match(route, /from "@\/lib\/supabase\/server"/);
  assert.match(route, /dynamic = "force-dynamic"/);
});

test("session proxy preserves normal identity redirects but denies binary requests with private 404 rather than redirect HTML", async () => {
  const { NextRequest } = require("next/server");
  for (const identity of ["guest", "denied", "internal", "client"]) {
    const { updateSession } = loader({
      "@supabase/ssr": { createServerClient: () => ({
        auth: { getClaims: async () => ({ data: { claims: identity === "guest" ? null : { sub: "mock-user" } }, error: null }) },
        rpc: async (name) => { assert.equal(name, "get_application_identity"); return { data: identity, error: null }; },
      }) },
    })("lib/supabase/proxy.ts");
    const fileResponse = await updateSession(new NextRequest("https://example.test/client/objects/47/photos/11/file"));
    if (identity === "client") assert.equal(fileResponse.headers.get("x-middleware-next"), "1");
    else { assert.equal(fileResponse.status, 404); privateResponse(fileResponse); }
    const pageResponse = await updateSession(new NextRequest("https://example.test/client/objects/47"));
    assert.equal(pageResponse.status, identity === "client" ? 200 : 307);
  }
});

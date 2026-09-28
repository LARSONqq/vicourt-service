// Real TS page/service/handler with separate mocked metadata and user clients.
// No SQL or browser execution; production session/RLS smoke remains required.
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
function loader(mocks = {}) {
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
const time = "2026-09-25T12:00:00Z";
const document = (id = 11, objectId = 47) => ({
  id, object_id: objectId, title: "План для клієнта", description: "Погоджена схема", mime_type: "application/pdf",
  file_size: 2048, published_at: time, total_count: 1,
  storage_path: "SECRET_PATH", original_file_name: "SECRET_NAME", note: "SECRET_NOTE", internal_title: "SECRET_TITLE",
  access_level: "SECRET_ACCESS", created_by: "SECRET_ACTOR",
});
const denied = () => ({ data: null, error: { code: "42501", message: "SECRET_DENIAL" } });
const is404 = (error) => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";
const userIds = { A: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", B: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" };
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function fixture() {
  let identity = "client", session = "A", listResult, fileResult, photoResult, authResult, afterPhotos = () => {}, afterLookup = () => {};
  let downloadResult = { data: new Blob(["mock-document"], { type: "application/pdf" }), error: null };
  const calls = [], metadataCalls = [], downloads = [], grants = { A: new Set([47]), B: new Set([48]) };
  const docs = new Map([[11, { objectId: 47, published: true, ready: true }], [12, { objectId: 48, published: true, ready: true }]]);
  let clients = 0, verifiedClient;
  const load = loader({
    "next/navigation": { notFound, redirect },
    "next/link": { __esModule: true, default: ({ href, children }) => createElement("a", { href }, children) },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/admin": { createServiceRoleClient: () => ({
      get storage() { assert.fail("NEVER service-role Storage"); },
      from: () => assert.fail("No generic table reads with service credential"),
      rpc: async (name, args) => {
        metadataCalls.push([name, args]);
        assert.equal(name, "get_client_object_document_file_server");
        assert.ok(verifiedClient, "Metadata lookup must follow auth.getUser()");
        assert.equal(args.p_client_user_id, userIds[session], "Only the verified session ID");
        const id = args.p_object_id;
        if (identity !== "client" || !grants[session].has(id)) return denied();
        if (fileResult !== undefined) return typeof fileResult === "function" ? fileResult(args) : fileResult;
        const doc = docs.get(args.p_document_id);
        if (!doc || doc.objectId !== id || !doc.published || !doc.ready) return denied();
        afterLookup();
        return { data: [{ storage_path: `${id}/SECRET_STORAGE.pdf`, mime_type: "application/pdf", client_title: "План для клієнта" }], error: null };
      },
    }) },
    "@/lib/supabase/server": { createClient: async () => {
      const clientNumber = ++clients;
      return {
        auth: { getUser: async () => {
          verifiedClient = clientNumber;
          if (authResult !== undefined) return typeof authResult === "function" ? authResult() : authResult;
          return { data: { user: identity === "guest" ? null : { id: userIds[session] } }, error: null };
        } },
        from: () => assert.fail("No internal table read/write"),
        rpc: async (name, args) => {
          calls.push([name, args]);
          const id = args.p_object_id;
          if (name === "get_client_object") return { data: grants[session].has(id)
            ? [{ id, name: `Сад ${id}`, address: "Садова", status: "В роботі" }] : [], error: null };
          if (!grants[session].has(id)) return denied();
          if (name === "get_client_object_progress") return { data: [], error: null };
          if (name === "get_client_object_photos") { afterPhotos(); return photoResult ?? { data: [], error: null }; }
          if (name === "get_client_object_documents") return typeof listResult === "function" ? listResult(args)
            : listResult ?? { data: [...docs].filter(([, d]) => d.objectId === id && d.published && d.ready).map(([key]) => document(key, id)), error: null };
          assert.fail(`No file metadata RPC on user client: ${name}`);
        },
        storage: { from: (bucket) => {
          assert.equal(bucket, "object-documents");
          assert.equal(clientNumber, verifiedClient, "auth.getUser and download MUST use the same original user client");
          return { download: async (path) => {
            downloads.push([bucket, path]);
            if (!grants[session].has(Number(path.split("/")[0])) || !docs.get(11).published || identity !== "client") return denied();
            return typeof downloadResult === "function" ? downloadResult() : downloadResult;
          } };
        } },
      };
    } },
  });
  const Page = load("app/client/objects/[id]/page.tsx").default;
  const Component = load("components/client/ClientObjectDocuments.tsx").default;
  const { GET } = load("app/client/objects/[id]/documents/[documentId]/file/route.ts");
  return {
    page: (id = "47", query = {}) => Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }),
    file: (id = "47", documentId = "11") => GET(new Request("https://example.test/client/document"), { params: Promise.resolve({ id, documentId }) }),
    service: load("services/clientDocumentService.ts"), Component, calls, metadataCalls, downloads, grants, docs,
    identity: (v) => { identity = v; }, session: (v) => { session = v; }, list: (v) => { listResult = v; },
    fileResult: (v) => { fileResult = v; }, download: (v) => { downloadResult = v; }, photos: (v) => { photoResult = v; },
    afterPhotos: (v) => { afterPhotos = v; }, afterLookup: (v) => { afterLookup = v; },
    auth: (v) => { authResult = v; },
  };
}

test("published documents render only seven allowlisted fields with same-origin download links and no source metadata", async () => {
  const f = fixture(), tree = await f.page(), html = renderToStaticMarkup(tree);
  const props = nodes(tree, (n) => n.type === f.Component)[0].props;
  assert.deepEqual(Object.keys(props.documents.items[0]), ["id", "object_id", "title", "description", "mime_type", "file_size", "published_at"]);
  assert.equal(props.documents.pageSize, 20);
  assert.equal(props.documents.totalCount, 1);
  assert.doesNotMatch(JSON.stringify(tree), /SECRET_|storage_path|original_file_name|access_level|created_by|internal_title/);
  assert.match(html, /План для клієнта/); assert.match(html, /Погоджена схема/);
  assert.match(html, /PDF/); assert.match(html, /2 КБ/); assert.match(html, /25\.09\.2026 15:00/);
  assert.match(html, /href="\/client\/objects\/47\/documents\/11\/file" download=""/);
  assert.doesNotMatch(html, /SECRET_|storage_path|supabase|<iframe|<object/);
  assert.deepEqual(f.downloads, [], "Listing never fetches file binaries");
  assert.deepEqual(f.metadataCalls, [], "Listing never uses a service credential");
  f.list({ data: [{ ...document(), title: "<script>title</script>", description: null }], error: null });
  const escaped = renderToStaticMarkup(await f.page());
  assert.match(escaped, /&lt;script&gt;/); assert.doesNotMatch(escaped, /<script>|Погоджена схема/);
});

test("documents have distinct empty/technical error states; authorization errors abort the whole passport", async () => {
  const f = fixture(); f.list({ data: [], error: null });
  assert.match(renderToStaticMarkup(await f.page()), /Документи ще не опубліковано/);
  for (const result of [
    { data: null, error: { code: "XX000", message: "SECRET_DB" } }, () => { throw new Error("SECRET_NETWORK"); },
    { data: [{ ...document(), mime_type: "text/html" }], error: null },
  ]) {
    f.list(result);
    const html = renderToStaticMarkup(await f.page());
    assert.match(html, /Сад 47/); assert.match(html, /Не вдалося завантажити документи/);
    assert.doesNotMatch(html, /Документи ще не опубліковано|SECRET_/);
  }
  for (const result of [denied(), () => { throw { code: "42501", message: "SECRET" }; }, { data: [document(11, 48)], error: null }]) {
    f.list(result); await assert.rejects(() => f.page(), is404);
  }
  const revoked = fixture(); revoked.afterPhotos(() => revoked.grants.A.delete(47));
  await assert.rejects(() => revoked.page(), is404);
  assert.equal(revoked.calls.at(-1)[0], "get_client_object_documents");
});

test("document pagination is DB-scoped 20/page, normalizes invalid values and preserves photo pagination both ways", async () => {
  const f = fixture();
  f.list({ data: Array.from({ length: 20 }, (_, i) => ({ ...document(i + 1), total_count: 42 })), error: null });
  f.photos({ data: [{ id: 111, object_id: 47, caption: null, published_at: time, total_count: 30 }], error: null });
  const tree = await f.page("47", { documentPage: "2", photoPage: "2" }), html = renderToStaticMarkup(tree);
  assert.deepEqual(f.calls.at(-1), ["get_client_object_documents", { p_object_id: 47, p_page: 2 }]);
  const result = nodes(tree, (n) => n.type === f.Component)[0].props.documents;
  assert.equal(result.page, 2); assert.equal(result.items.length, 20); assert.equal(result.hasNextPage, true);
  assert.match(html, /documentPage=1&amp;photoPage=2#client-documents-title/);
  assert.match(html, /documentPage=3&amp;photoPage=2#client-documents-title/);
  assert.match(html, /photoPage=1&amp;documentPage=2/); assert.match(html, /photoPage=3&amp;documentPage=2/);
  for (const documentPage of [undefined, "0", "-1", "1.5", "abc", "100001", "999999999999999999999", ["2", "3"]]) {
    await f.page("47", { documentPage }); assert.equal(f.calls.at(-1)[1].p_page, 1);
  }
  f.list({ data: [], error: null });
  await assert.rejects(() => f.page("47", { documentPage: "100000", photoPage: "2" }), (e) => e.digest.includes("/client/objects/47?photoPage=2&documentPage=1"));
  f.list({ data: [{ ...document(), total_count: 42 }], error: null }); f.photos({ data: [], error: null });
  await assert.rejects(() => f.page("47", { documentPage: "2", photoPage: "99" }), (e) => e.digest.includes("/client/objects/47?photoPage=1&documentPage=2"));
});

test("mocked A/B isolation and internal/inactive/guest rejection apply independently to listing and file lookup", async () => {
  const f = fixture();
  for (const [session, own, foreign, docId] of [["A", 47, 48, 11], ["B", 48, 47, 12]]) {
    f.session(session);
    assert.equal((await f.service.getClientObjectDocumentsPage(own)).items[0].object_id, own);
    assert.equal((await f.file(String(own), String(docId))).status, 200);
    await assert.rejects(() => f.service.getClientObjectDocumentsPage(foreign), is404);
    assert.equal((await f.file(String(foreign), String(docId))).status, 404);
  }
  for (const identity of ["guest", "denied", "internal"]) {
    f.identity(identity); const before = f.calls.length;
    await assert.rejects(() => f.service.getClientObjectDocumentsPage(47));
    assert.equal((await f.file()).status, 404); assert.equal(f.calls.length, before);
  }
});

const mimeExtensions = [
  ["application/pdf", "pdf"], ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["text/csv", "csv"], ["application/csv", "csv"], ["text/plain", "txt"],
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
];
function privateResponse(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("location"), null);
}
async function empty404(response) {
  assert.equal(response.status, 404); privateResponse(response); assert.equal(await response.text(), "");
  assert.equal(response.headers.get("content-disposition"), null); assert.equal(response.headers.get("content-type"), null);
}
test("all reviewed MIME types including images download as attachment using canonical title extension and same session client", async () => {
  for (const [mime, ext] of mimeExtensions) {
    const f = fixture();
    // Legacy Excel/text source may be CSV: output extension still follows MIME.
    const sourceExt = ["application/vnd.ms-excel", "text/plain"].includes(mime) ? "csv" : ext;
    f.fileResult({ data: [{ storage_path: `47/SECRET_ORIGINAL.${sourceExt}`, mime_type: mime, client_title: "План для клієнта" }], error: null });
    f.download({ data: new Blob(["mock-file"], { type: mime }), error: null });
    const response = await f.file();
    assert.equal(response.status, 200); privateResponse(response); assert.equal(response.headers.get("content-type"), mime);
    const disposition = response.headers.get("content-disposition");
    assert.ok(disposition.startsWith("attachment;"));
    assert.equal(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]), `План для клієнта.${ext}`);
    assert.equal(await response.text(), "mock-file");
    assert.deepEqual(f.calls, [], "User client cannot request metadata");
    assert.deepEqual(f.metadataCalls, [["get_client_object_document_file_server", {
      p_client_user_id: userIds.A, p_object_id: 47, p_document_id: 11,
    }]]);
    assert.deepEqual(f.downloads, [["object-documents", `47/SECRET_ORIGINAL.${sourceExt}`]]);
    assert.doesNotMatch(JSON.stringify([...response.headers]), /SECRET_|storage_path|original_file_name/);
  }
});

test("filename strips header/path/bidi/control syntax and never derives extension from the client title", async () => {
  for (const title of ["План\r\nX-Evil: 1/\\\"; <x>.html", "\u202eabc.exe\u0000", "\ud800", "🌿", "П".repeat(150)]) {
    const f = fixture(); f.fileResult({ data: [{ storage_path: "47/SECRET.pdf", mime_type: "application/pdf", client_title: title }], error: null });
    const response = await f.file(); assert.equal(response.status, 200);
    const disposition = response.headers.get("content-disposition");
    const name = decodeURIComponent(disposition.split("filename*=UTF-8''")[1]);
    assert.ok(name.endsWith(".pdf")); assert.ok(Array.from(name).length <= 104);
    assert.doesNotMatch(name, /[\r\n\u0000\u202e/\\";<>]/u);
    assert.equal(response.headers.get("x-evil"), null);
  }
});

test("missing/unpublished/not-ready/foreign/invalid documents are indistinguishable private 404s without Storage download", async () => {
  const f = fixture();
  for (const [objectId, docId] of [["48", "12"], ["47", "12"], ["47", "999"], ["0", "11"], ["47", "-1"], ["x", "11"], ["47", "1.1"], ["47", "999999999999999999999"]]) {
    await empty404(await f.file(objectId, docId));
  }
  f.docs.get(11).published = false; await empty404(await f.file());
  f.docs.get(11).published = true; f.docs.get(11).ready = false; await empty404(await f.file());
  f.docs.get(11).ready = true; f.grants.A.clear(); await empty404(await f.file());
  assert.deepEqual(f.downloads, []);
});

test("unsafe lookup/MIME/storage/network failures fail closed without browser error details", async () => {
  for (const result of [denied(), { data: [], error: null },
    { data: [{ storage_path: "../SECRET.pdf", mime_type: "application/pdf", client_title: "План" }], error: null },
    { data: [{ storage_path: "47/SECRET.svg", mime_type: "image/svg+xml", client_title: "План" }], error: null },
    () => { throw new Error("SECRET_RPC"); },
  ]) {
    const f = fixture(); f.fileResult(result); await empty404(await f.file()); assert.deepEqual(f.downloads, []);
  }
  for (const data of [null, { type: "application/pdf" }, new Blob([] , { type: "application/pdf" }),
    ...["text/html", "image/svg+xml", "image/png", "application/x-unknown", "application/pdf; boundary=unknown"].map((type) => new Blob(["SECRET"], { type })),
  ]) {
    const f = fixture(); f.download({ data, error: null }); await empty404(await f.file());
  }
  for (const result of [{ data: null, error: { message: "SECRET_PATH" } }, () => { throw new Error("SECRET_STORAGE"); }]) {
    const f = fixture(); f.download(result); await empty404(await f.file());
  }
});

test("revocation, inactivity or unpublish after file lookup is independently denied by mocked Storage authorization", async () => {
  for (const revoke of [(f) => f.grants.A.clear(), (f) => { f.docs.get(11).published = false; }, (f) => f.identity("denied")]) {
    const f = fixture(); f.afterLookup(() => revoke(f));
    await empty404(await f.file()); assert.equal(f.downloads.length, 1);
  }
});

test("verified user is mandatory before privileged metadata; identity/credential failures stay empty private 404", async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: { id: userIds.A } }, error: { message: "SECRET_AUTH" } },
    () => { throw new Error("SECRET_AUTH_NETWORK"); },
  ]) {
    const f = fixture(); f.auth(result);
    await empty404(await f.file());
    assert.deepEqual(f.metadataCalls, []); assert.deepEqual(f.downloads, []);
  }
  for (const identity of ["internal", "dual", "denied", "unclassified"]) {
    const f = fixture(); f.identity(identity);
    await empty404(await f.file());
    assert.equal(f.metadataCalls.length, 1, "Resolver must recheck an authenticated non-client identity");
    assert.deepEqual(f.downloads, []);
  }
  const { GET } = loader({
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userIds.A } }, error: null }) },
      get storage() { assert.fail("Missing credential must stop before download"); },
    }) },
    "@/lib/supabase/admin": { createServiceRoleClient: () => { throw new Error("SECRET_CONFIG"); } },
  })("app/client/objects/[id]/documents/[documentId]/file/route.ts");
  await empty404(await GET(new Request("https://example.test/file?p_client_user_id=forged"), {
    params: Promise.resolve({ id: "47", documentId: "11" }),
  }));
});

test("transport MIME allows normalized matching/absent/generic types but never broadens stored MIME eligibility", async () => {
  const { clientDocumentTransportMimeMatches } = loader()("lib/clientDocument.ts");
  for (const type of ["application/pdf", " APPLICATION/PDF ", "application/pdf; charset=UTF-8",
    'application/pdf; CHARSET="utf-8"', "", "application/octet-stream", " application/octet-stream; charset=utf-8 "]) {
    assert.equal(clientDocumentTransportMimeMatches(type, "application/pdf"), true);
    const f = fixture(); f.download({ data: new Blob(["valid-file"], { type }), error: null });
    const response = await f.file();
    assert.equal(response.status, 200); privateResponse(response);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition"), /^attachment;/u);
  }
  for (const type of ["text/html", "image/png", "application/unknown", "application/pdf; boundary=other"])
    assert.equal(clientDocumentTransportMimeMatches(type, "application/pdf"), false);
  for (const mime of ["text/html", "image/svg+xml", "application/octet-stream", "", "APPLICATION/PDF"])
    assert.equal(clientDocumentTransportMimeMatches("", mime), false);
});

test("client document source wiring has no management, direct tables, signed URLs, admin client or path in presentation", () => {
  const files = ["app/client/objects/[id]/page.tsx", "components/client/ClientObjectDocuments.tsx", "services/clientDocumentService.ts", "app/client/objects/[id]/documents/[documentId]/file/route.ts"];
  for (const file of files) assert.doesNotMatch(read(file), /get_management_|clientDocumentManagementService|createSignedUrl|createAdminClient|SERVICE_ROLE|\.from\(["'](?:object_documents|client_object_document_publications)/u);
  assert.doesNotMatch(read(files[0]) + read(files[1]), /storage_path|original_file_name|access_level|created_by|\bnote\b|internal_title/);
  assert.match(read(files[1]), /^import "server-only";/u);
  assert.doesNotMatch(read(files[3]), /console\.|new URL|\.redirect\(|\.getPublicUrl/u);
  assert.doesNotMatch(read(files[2]), /get_client_object_document_file|clientDocumentFileService|supabase\/admin/u);
  const resolver = read("services/clientDocumentFileService.ts");
  assert.match(resolver, /^import "server-only";/u);
  assert.match(resolver, /createServiceRoleClient.*from "@\/lib\/supabase\/admin"/u);
  assert.doesNotMatch(resolver, /\.storage\b|createSignedUrl|metadataClient\.from\(|console\.|process\.env/u);
});

test("session proxy uses the existing private 404 behavior for both photo and document binaries; page redirects unchanged", async () => {
  const { NextRequest } = require("next/server");
  for (const identity of ["guest", "denied", "internal", "client"]) {
    const { updateSession } = loader({ "@supabase/ssr": { createServerClient: () => ({
      auth: { getClaims: async () => ({ data: { claims: identity === "guest" ? null : { sub: "mock" } }, error: null }) },
      rpc: async (name) => { assert.equal(name, "get_application_identity"); return { data: identity, error: null }; },
    }) } })("lib/supabase/proxy.ts");
    for (const kind of ["photos", "documents"]) {
      const response = await updateSession(new NextRequest(`https://example.test/client/objects/47/${kind}/11/file`));
      if (identity === "client") assert.equal(response.headers.get("x-middleware-next"), "1");
      else await empty404(response);
    }
    const page = await updateSession(new NextRequest("https://example.test/client/objects/47"));
    assert.equal(page.status, identity === "client" ? 200 : 307);
  }
});

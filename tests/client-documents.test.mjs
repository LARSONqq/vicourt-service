// Static SQL and mocked service tests only: no SQL/Storage execution.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const output = ts.transpileModule(read(filename), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
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
    new Function("require", "module", "exports", output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const mapper = loader()("lib/clientDocument.ts");
const pre = read("database/client-portal-1.0c2-pre-deploy.sql");
const audit = read("database/client-portal-1.0c2-production-audit.sql");
const functions = [...pre.matchAll(/create or replace function\s+([\w.]+)\(([^)]*)\)([\s\S]*?)as \$function\$([\s\S]*?)\$function\$/gu)];
const body = (name) => functions.find((m) => m[1].endsWith(`.${name}`))[4];
const time = "2026-09-23T12:00:00Z";
const document = (id = 11) => ({ id, object_id: 47, title: "План озеленення", description: null,
  mime_type: "application/pdf", file_size: 1234, published_at: time, total_count: 1 });
const publication = () => ({ document_id: 11, object_id: 47, is_published: true, client_title: "План озеленення",
  client_description: null, sort_order: 0, published_at: time, unpublished_at: null, updated_at: time });
const input = () => ({ object_id: 47, document_id: 11, is_published: true, client_title: "План озеленення", client_description: null, sort_order: 0 });

test("document DTO is an exact seven-field allowlist, with explicit client title and no internal fallback", () => {
  const row = { ...document(), internal_title: "SECRET", note: "SECRET", original_file_name: "SECRET", storage_path: "SECRET",
    access_level: "management", created_by: "SECRET", updated_by: "SECRET", created_at: time, updated_at: time, is_ready: true };
  const dto = mapper.clientObjectDocumentDto(row);
  assert.deepEqual(Object.keys(dto), ["id", "object_id", "title", "description", "mime_type", "file_size", "published_at"]);
  assert.doesNotMatch(JSON.stringify(dto), /SECRET|storage_path|original_file_name|total_count|is_ready/);
  for (const change of [{ title: null }, { title: "" }, { title: " " }, { title: "x".repeat(151) }, { description: " " },
    { description: "x".repeat(1001) }, { file_size: 0 }, { file_size: 26214401 }, { mime_type: "text/html" }, { published_at: null }]) {
    assert.throws(() => mapper.clientObjectDocumentDto({ ...row, ...change }));
  }
  assert.equal(mapper.clientObjectDocumentDto({ ...row, title: "🌿".repeat(150), description: "🌿".repeat(1000) }).title.length, 300);
});

test("publication input validates explicit title, optional description, canonical IDs and int32 order", () => {
  assert.deepEqual(mapper.clientDocumentPublicationInput({ ...input(), client_title: "  План озеленення  ", client_description: "   ", created_by: "fake" }), input());
  for (const change of [{ client_title: null }, { client_title: "" }, { document_id: "11" }, { object_id: 0 }, { sort_order: -1 },
    { sort_order: 0.5 }, { sort_order: 2147483648 }, { is_published: "true" }, { client_description: "x".repeat(1001) }]) {
    assert.throws(() => mapper.clientDocumentPublicationInput({ ...input(), ...change }));
  }
  const unpublished = { ...publication(), is_published: false, client_title: null, published_at: null, updated_at: null };
  assert.deepEqual(mapper.managementClientDocumentPublicationDto(unpublished), unpublished);
  assert.deepEqual(mapper.managementClientDocumentPublicationDto({ ...publication(), created_by: "SECRET" }), publication());
  assert.throws(() => mapper.managementClientDocumentPublicationDto({ ...publication(), client_title: null }));
});

const pairs = [
  ["pdf", "application/pdf"], ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["xls", "application/vnd.ms-excel"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ...["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].map((mime) => ["csv", mime]),
  ["txt", "text/plain"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"],
];
test("safe-file predicate has exact MIME/extension pairs matching the internal supported formats, fails closed", () => {
  const entries = [...body("client_document_is_safe_file").matchAll(/when '([^']+)' then pg_catalog.lower\(p_path\) ~ '([^']+)'/gu)];
  assert.equal(entries.length, 11);
  const sqlEligible = (path, mime) => typeof path === "string" && entries.some((m) => m[1] === mime && new RegExp(m[2], "u").test(path.toLowerCase()));
  const { getObjectDocumentFileValidationError } = loader()("constants/objectDocuments.ts");
  for (const [ext, mime] of pairs) {
    assert.equal(mapper.clientDocumentIsSafeFile(`47/FILE.${ext.toUpperCase()}`, mime), true);
    assert.equal(sqlEligible(`47/file.${ext}`, mime), true);
    assert.equal(getObjectDocumentFileValidationError({ name: `file.${ext}`, type: mime, size: 12 }), null);
  }
  for (const path of [null, "", "47/a.svg", "47/a.html", "47/a.exe", "47/a.gif", "47/a.avif", "47/a.pdf", "47/a.csv"]) {
    for (const mime of [null, "", "text/html", "image/svg+xml", "application/octet-stream", "APPLICATION/PDF", "application/pdf; charset=utf-8", ...new Set(pairs.map((p) => p[1]))]) {
      const ext = typeof path === "string" ? path.split(".").at(-1) : null;
      const expected = pairs.some(([e, m]) => e === ext && m === mime);
      assert.equal(mapper.clientDocumentIsSafeFile(path, mime), expected, `${path}:${mime}`);
      assert.equal(sqlEligible(path, mime), expected, `${path}:${mime}`);
    }
  }
  assert.doesNotMatch(body("client_document_is_safe_file"), /\b(?:from|join)\b|storage\./iu);
});

function clientFixture() {
  let identity = "client", response = { data: [document()], error: null }, created = 0;
  const calls = [];
  const service = loader({
    "next/navigation": { notFound: () => { throw new Error("not-found"); }, redirect: (p) => { throw new Error(`redirect:${p}`); } },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => { created++; return {
      rpc: async (name, args) => { calls.push([name, args]); return typeof response === "function" ? response() : response; },
      from: () => assert.fail("no direct table access"),
    }; } },
  })("services/clientDocumentService.ts");
  return { service, calls, created: () => created, identity: (v) => { identity = v; }, result: (v) => { response = v; } };
}
test("client read is scoped, deterministic 20/page with no N+1 or count/internal fields in items", async () => {
  const f = clientFixture();
  f.result({ data: Array.from({ length: 20 }, (_, i) => ({ ...document(i + 1), total_count: 42, storage_path: "SECRET" })), error: null });
  const result = await f.service.getClientObjectDocumentsPage(47, 2);
  assert.equal(result.pageSize, 20); assert.equal(result.totalCount, 42); assert.equal(result.hasNextPage, true);
  assert.doesNotMatch(JSON.stringify(result.items), /storage_path|SECRET|total_count/);
  assert.deepEqual(f.calls, [["get_client_object_documents", { p_object_id: 47, p_page: 2 }]]);
  f.result({ data: [], error: null });
  assert.equal((await f.service.getClientObjectDocumentsPage(47, NaN)).page, 1);
  assert.equal((await f.service.getClientObjectDocumentsPage(47)).totalCount, 0);
  assert.equal((await f.service.getClientObjectDocumentsPage(47, 30)).totalCount, null);
  f.result({ data: Array.from({ length: 21 }, (_, i) => ({ ...document(i + 1), total_count: 30 })), error: null });
  await assert.rejects(() => f.service.getClientObjectDocumentsPage(47), /Не вдалося/);
});
test("inactive/internal/guest denied before client RPC; revoked/wrong-object denial is never an empty list", async () => {
  const f = clientFixture();
  for (const identity of ["denied", "internal", "guest"]) {
    f.identity(identity);
    await assert.rejects(() => f.service.getClientObjectDocumentsPage(47), /redirect:/);
  }
  assert.equal(f.created(), 0); f.identity("client");
  for (const result of [{ data: null, error: { code: "42501", message: "SECRET" } }, () => { throw { code: "42501", message: "SECRET" }; }]) {
    f.result(result);
    for (const id of [47, 48]) {
      await assert.rejects(() => f.service.getClientObjectDocumentsPage(id), /not-found/);
      await assert.rejects(() => f.service.getClientObjectDocumentFile(id, 11), /not-found/);
    }
  }
  f.result({ data: [{ ...document(), object_id: 48 }], error: null });
  await assert.rejects(() => f.service.getClientObjectDocumentsPage(47), /not-found/);
  for (const result of [{ data: null, error: { code: "XX000", message: "SECRET" } }, () => { throw new Error("SECRET"); }]) {
    f.result(result);
    await assert.rejects(() => f.service.getClientObjectDocumentsPage(47), (e) => e.name === "ClientDocumentLoadError" && !e.message.includes("SECRET"));
  }
});
test("file lookup is server-only, scoped and allowlisted, not a bearer URL or generic client DTO", async () => {
  const f = clientFixture();
  const reference = { storage_path: "47/uuid.pdf", mime_type: "application/pdf", client_title: "План" };
  f.result({ data: [{ ...reference, note: "SECRET", original_file_name: "SECRET" }], error: null });
  assert.deepEqual(await f.service.getClientObjectDocumentFile(47, 11), reference);
  assert.deepEqual(f.calls.at(-1), ["get_client_object_document_file", { p_object_id: 47, p_document_id: 11 }]);
  for (const path of ["../file.pdf", "/file.pdf", "47/../file.pdf", "47/file.html", "47/file.svg", "47/file.pdf\n"]) {
    f.result({ data: [{ ...reference, storage_path: path }], error: null });
    await assert.rejects(() => f.service.getClientObjectDocumentFile(47, 11), /Не вдалося/);
  }
  f.result({ data: [], error: null });
  await assert.rejects(() => f.service.getClientObjectDocumentFile(47, 11), /not-found/);
  for (const file of ["services/clientDocumentService.ts", "services/clientDocumentManagementService.ts"]) {
    const code = read(file); assert.match(code, /^import "server-only";/);
    assert.doesNotMatch(code, /createServiceRoleClient|createAdminClient|createSignedUrl|SUPABASE_SERVICE|supabase\.from\(/u);
  }
});
test("management admin/manager only BEFORE RPC, one scoped batch; safe validation/error handling", async () => {
  let identity = "internal", profile = null, response = { data: [publication()], error: null }, created = 0;
  const calls = [];
  const service = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => { created++; return { rpc: async (name, args) => { calls.push([name, args]); return response; } }; } },
  })("services/clientDocumentManagementService.ts");
  for (profile of [null, { role: "worker", is_active: true }, { role: "admin", is_active: false }]) {
    await assert.rejects(() => service.getManagementClientDocumentPublications(47, [11]));
    await assert.rejects(() => service.setClientObjectDocumentPublication(input()));
  }
  identity = "client"; profile = { role: "admin", is_active: true };
  await assert.rejects(() => service.getManagementClientDocumentPublications(47, [11]));
  await assert.rejects(() => service.setClientObjectDocumentPublication(input()));
  assert.equal(created, 0); identity = "internal";
  for (const role of ["admin", "object_manager"]) {
    profile = { role, is_active: true };
    assert.deepEqual(await service.getManagementClientDocumentPublications(47, [11, 11]), [publication()]);
    assert.deepEqual(calls.at(-1), ["get_management_client_document_publications", { p_object_id: 47, p_document_ids: [11] }]);
    assert.deepEqual(await service.setClientObjectDocumentPublication({ ...input(), created_by: "fake" }), publication());
    assert.deepEqual(calls.at(-1), ["set_client_object_document_publication", {
      p_object_id: 47, p_document_id: 11, p_is_published: true, p_client_title: input().client_title, p_client_description: null, p_sort_order: 0,
    }]);
  }
  const before = created;
  await service.getManagementClientDocumentPublications(47, []);
  await assert.rejects(() => service.getManagementClientDocumentPublications(47, Array(101).fill(11)));
  await assert.rejects(() => service.setClientObjectDocumentPublication({ ...input(), sort_order: -1 }));
  assert.equal(created, before);
  for (const code of ["42501", "22023", "P0002", "XX000"]) {
    response = { data: null, error: { code, message: "SECRET_DATABASE_ERROR" } };
    await assert.rejects(() => service.setClientObjectDocumentPublication(input()), (e) => !e.message.includes("SECRET"));
  }
});

test("publication model is separate, RPC-only, without backfill/binary/identity duplication", () => {
  const table = pre.match(/create table if not exists public.client_object_document_publications \(([\s\S]*?)\n\);/u)[1];
  assert.match(table, /document_id bigint primary key references public\.object_documents\(id\) on delete cascade/u);
  assert.doesNotMatch(table, /\b(?:object_id|storage_path|access_level|original_file_name|mime_type|file_size)\b/u);
  assert.match(table, /client_title text not null/u); assert.match(table, /sort_order>=0/u);
  assert.match(pre, /revoke all on table public\.client_object_document_publications from public, anon, authenticated/u);
  assert.match(pre, /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)/u);
  assert.match(pre, /enable row level security/u);
  assert.doesNotMatch(pre, /insert into public\.client_object_document_publications[^$]*select[\s\S]*from public\.object_documents/iu);
  assert.equal([...pre.matchAll(/create policy /gu)].length, 1);
  assert.doesNotMatch(pre, /(?:drop|alter) policy|update storage\.buckets|(?:insert into|update|delete from) public\.object_documents\b/iu);
});
test("client SQL independently requires active client/live grant and published ready safe source; deterministic 20/page", () => {
  for (const name of ["get_client_object_documents", "get_client_object_document_file"]) {
    const sql = body(name);
    for (const guard of ["auth.uid() is null", "private.is_active_client()", "private.client_has_object_access(p_object_id)", "d.is_ready=true", "pub.is_published", "d.object_id=p_object_id", "private.client_document_is_safe_file"]) assert.ok(sql.includes(guard), guard);
    assert.ok(sql.indexOf("errcode='42501'") < sql.indexOf("return query"));
    assert.doesNotMatch(sql, /d\.(?:title|note|access_level|original_file_name)|created_by|updated_by|select \*/u);
  }
  assert.match(body("get_client_object_documents"), /order by pub\.sort_order asc,pub\.published_at desc,d\.id desc\s+limit 20 offset \(\(p_page-1\)\*20\)/u);
  const auth = body("client_can_read_object_document");
  for (const value of ["auth.uid() is not null", "private.is_active_client()", "d.storage_path=p_storage_path", "d.is_ready=true", "pub.is_published", "private.client_has_object_access(d.object_id)"]) assert.ok(auth.includes(value));
  assert.doesNotMatch(auth, /storage\./u);
  assert.doesNotMatch(pre.replace(/--[^\n]*/gu, ""), /^grant\s[^;]+client_has_object_access/gimu);
});
test("management SQL locks source, preserves publication history and never modifies original document", () => {
  for (const name of ["get_management_client_document_publications", "set_client_object_document_publication"]) {
    const sql = body(name);
    for (const guard of ["auth.uid() is null", "private.is_active_user()", "private.has_role(array['admin','object_manager']::text[])"]) assert.ok(sql.includes(guard));
  }
  const sql = body("set_client_object_document_publication");
  assert.ok(sql.indexOf("for update;") < sql.indexOf("insert into public.client_object_document_publications"));
  assert.match(sql, /not coalesce\(v_document\.is_ready,false\)/u);
  assert.match(sql, /published_at=case when excluded\.is_published and not existing\.is_published then v_now else existing\.published_at end/u);
  assert.match(sql, /unpublished_at=case when excluded\.is_published then null when existing\.is_published then v_now else existing\.unpublished_at end/u);
  assert.doesNotMatch(sql, /delete from|update public\.object_documents|v_document\.(?:title|note|original_file_name|access_level)/u);
});
test("Storage policy requires exactly both authenticated read operations and all bucket/file/client guards", () => {
  const policy = pre.match(/create policy client_object_documents_authenticated_get[\s\S]*?\n    \);/u)[0];
  assert.match(policy, /as permissive for select to authenticated/u);
  assert.match(policy, /bucket_id='object-documents'/u);
  assert.match(policy, /private\.client_document_is_safe_file\(objects\.name,metadata->>'mimetype'\)/u);
  assert.match(policy, /private\.client_can_read_object_document\(objects\.name\)/u);
  assert.deepEqual([...policy.matchAll(/'object\.([^']+)'/gu)].map((m) => m[1]), ["get_authenticated_info", "get_authenticated"]);
  const expected = audit.match(/p\.normalized_qual=\$expr\$([^$]+)\$expr\$/u)[1];
  const normalize = (s) => s.replaceAll("::text[]", "").replaceAll("::text", "").replaceAll("objects.", "").replace(/[\s()]/gu, "");
  const expression = policy.match(/using \(([\s\S]*)\n    \);/u)[1].replace("array[", "ARRAY[").replace(/\band\b/gu, "AND");
  assert.equal(normalize(expression), expected);
  for (const bad of [expression.replace("'object.get_authenticated_info',", ""), expression.replace("'object.get_authenticated'", "'object.list'"),
    expression.replace("'object.get_authenticated'", "'object.get_authenticated','object.sign'"), expression.replace("bucket_id='object-documents'", "true"),
    expression.replace(/private\.client_document_is_safe_file\([^)]*\)/u, "true"), expression.replace(/private\.client_can_read_object_document\([^)]*\)/u, "true")]) assert.notEqual(normalize(bad), expected);
  assert.match(audit, /p\.roles=array\['authenticated'::name\]/u);
});
test("PRE requires reviewed discovery pins; preserved exact baseline is shared with read-only audit", () => {
  assert.match(pre, /if v_reviewed_policy_md5 is null or v_reviewed_allow_any_md5 is null then/u);
  assert.match(pre, /BLOCKED: exact reviewed production/u);
  assert.match(audit, /r\.policy_md5 is not null and r\.allow_any_md5 is not null/u);
  const baseline = (s) => s.match(/-- PRESERVATION BASELINE BEGIN[^\n]*\n([\s\S]*?)\n\s*-- PRESERVATION BASELINE END/u)[1]
    .replace(/^\s*with /u, "").replace(/[\s,]+$/u, "").replace(/\s+/gu, " ").trim();
  assert.equal(baseline(pre), baseline(audit));
  for (const value of ["object_documents", "object_photos", "client_object_photo_publications", "handle_new_user", "client_has_object_access", "get_client_object_progress", "get_client_object_photos", "allow_any_operation"]) assert.ok(baseline(pre).includes(value));
  assert.match(pre, /rolsuper or rolbypassrls/u);
  assert.match(pre, /has_table_privilege\(current_user,'storage.objects','SELECT'\)/u);
  assert.match(audit, /runtime_authorization_tested',false/u);
  assert.match(audit, /bool_and\(coalesce\(matches,false\)\)/u);
  assert.match(audit, /begin;\s*set transaction read only;\s*set local search_path = pg_catalog;/u);
  assert.doesNotMatch(audit.replace(/--[^\n]*/gu, ""), /^(?:create|alter|drop|grant|revoke|insert|update|delete|do|call)\s/gimu);
});
test("SQL signatures, hash pins and malformed-token regression scans agree without executing SQL", () => {
  assert.equal(functions.length, 6);
  for (const [, name, args, , sql] of functions) {
    const types = args.split(",").map((a) => {
      assert.match(a.trim(), /^p_\w+\s+(?:bigint(?:\[\])?|integer|text|boolean)(?:\s+default\s+1)?$/u);
      return a.trim().split(/\s+/u)[1];
    });
    const signature = `${name}(${types.join(",")})`;
    const hash = createHash("md5").update(sql).digest("hex");
    assert.ok(audit.includes(`('${signature}','${hash}'`), signature);
    assert.ok(pre.slice(pre.indexOf("revoke all on function")).includes(signature), signature);
  }
  for (const sql of [pre, audit]) assert.doesNotMatch(sql, /\b(?:andrelkind|endif|usingerrcode|with_checkis|thenraise|ifnot|endloop|returnquery|andp\.prokind)\b|'objects'and/iu);
});

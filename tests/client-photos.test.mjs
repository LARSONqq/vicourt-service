// Mocked services and static SQL contracts only; no SQL/Storage calls executed.
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
const mapper = loader()("lib/clientPhoto.ts");
const photo = (id = 11) => ({ id, object_id: 47, caption: "Квітник", published_at: "2026-09-22T09:00:00Z", total_count: 1 });
const publication = () => ({ photo_id: 11, object_id: 47, is_published: true, client_caption: "Квітник", sort_order: 0,
  published_at: "2026-09-22T09:00:00Z", unpublished_at: null, updated_at: "2026-09-22T09:00:00Z" });
const input = () => ({ object_id: 47, photo_id: 11, is_published: true, client_caption: "Квітник", sort_order: 0 });
const pre = read("database/client-portal-1.0c1-pre-deploy.sql");
const audit = read("database/client-portal-1.0c1-production-audit.sql");
const hotfix = read("database/client-portal-1.0c1-storage-read-hotfix.sql");
const functions = [...pre.matchAll(/create or replace function\s+([\w.]+)\(([^)]*)\)([\s\S]*?)as \$function\$([\s\S]*?)\$function\$/gu)];
const body = (name) => functions.find((m) => m[1].endsWith(`.${name}`))[4];

test("photo gallery DTO has exactly four fields; never leaks internal caption/path/actors/management metadata", () => {
  const value = { ...photo(), caption: null, internal_caption: "SECRET", storage_path: "SECRET", created_by: "SECRET",
    updated_by: "SECRET", is_published: true, sort_order: 4, unpublished_at: "SECRET", created_at: "SECRET" };
  assert.deepEqual(mapper.clientObjectPhotoDto(value), { id: 11, object_id: 47, caption: null, published_at: photo().published_at });
  for (const changes of [{ caption: undefined }, { published_at: null }, { id: "11" }, { object_id: 0 }, { caption: " " }, { caption: "x".repeat(501) }]) {
    assert.throws(() => mapper.clientObjectPhotoDto({ ...photo(), ...changes }));
  }
  assert.equal(mapper.clientObjectPhotoDto({ ...photo(), caption: "🌿".repeat(500) }).caption.length, 1000);
});

test("publication input uses canonical IDs, trims bounded caption and strips caller audit metadata", () => {
  assert.deepEqual(mapper.clientPhotoPublicationInput({ ...input(), client_caption: "  Квітник ", created_by: "fake", published_at: "fake" }), input());
  assert.equal(mapper.clientPhotoPublicationInput({ ...input(), client_caption: "   " }).client_caption, null);
  for (const changes of [{ is_published: "true" }, { photo_id: 0 }, { object_id: "47" }, { sort_order: -1 }, { sort_order: 0.5 }, { sort_order: 2147483648 }]) {
    assert.throws(() => mapper.clientPhotoPublicationInput({ ...input(), ...changes }));
  }
  assert.throws(() => mapper.managementClientPhotoPublicationDto({ ...publication(), published_at: null }));
});

function clientFixture() {
  let identity = "client", response = { data: [photo()], error: null }, created = 0;
  const calls = [];
  const service = loader({
    "next/navigation": { notFound: () => { throw new Error("not-found"); }, redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => { created++; return {
      rpc: async (name, args) => { calls.push([name, args]); return typeof response === "function" ? response(name, args) : response; },
      from: () => assert.fail("no direct table access"),
    }; } },
  })("services/clientPhotoService.ts");
  return { service, calls, created: () => created, identity: (value) => { identity = value; }, result: (value) => { response = value; } };
}

test("client page calls only scoped client RPC, bounds pages to 12 and separates exact counts from DTOs", async () => {
  const f = clientFixture();
  f.result({ data: Array.from({ length: 12 }, (_, index) => ({ ...photo(index + 1), total_count: 25, storage_path: "SECRET" })), error: null });
  const page = await f.service.getClientObjectPhotosPage(47, 2);
  assert.equal(page.pageSize, 12); assert.equal(page.totalCount, 25); assert.equal(page.hasNextPage, true);
  assert.equal(page.items.length, 12); assert.doesNotMatch(JSON.stringify(page.items), /storage_path|total_count|SECRET/);
  assert.deepEqual(f.calls, [["get_client_object_photos", { p_object_id: 47, p_page: 2 }]]);
  await f.service.getClientObjectPhotosPage(47, NaN);
  assert.equal(f.calls.at(-1)[1].p_page, 1);
  f.result({ data: [], error: null });
  assert.deepEqual(await f.service.getClientObjectPhotosPage(47), { items: [], page: 1, pageSize: 12, totalCount: 0, hasNextPage: false });
  assert.equal((await f.service.getClientObjectPhotosPage(47, 20)).totalCount, null);
  f.result({ data: Array.from({ length: 13 }, (_, i) => ({ ...photo(i + 1), total_count: 20 })), error: null });
  await assert.rejects(() => f.service.getClientObjectPhotosPage(47), /Не вдалося/);
});

test("client read denies missing/revoked/unassigned/file access, never converts denial to an empty gallery", async () => {
  const f = clientFixture();
  for (const result of [
    { data: null, error: { code: "42501", message: "SECRET" } },
    () => { throw { code: "42501", message: "SECRET" }; },
  ]) {
    f.result(result);
    for (const objectId of [47, 48, 999]) {
      await assert.rejects(() => f.service.getClientObjectPhotosPage(objectId), /not-found/);
      await assert.rejects(() => f.service.getClientObjectPhotoFile(objectId, 11), /not-found/);
    }
  }
  f.result({ data: [{ ...photo(), object_id: 48 }], error: null });
  await assert.rejects(() => f.service.getClientObjectPhotosPage(47), /not-found/);
  const before = f.created();
  for (const identity of ["guest", "denied", "internal"]) {
    f.identity(identity);
    await assert.rejects(() => f.service.getClientObjectPhotosPage(47), /redirect:/);
    await assert.rejects(() => f.service.getClientObjectPhotoFile(47, 11), /redirect:/);
  }
  f.identity("client");
  await assert.rejects(() => f.service.getClientObjectPhotosPage(0), /not-found/);
  assert.equal(f.created(), before);
});

test("server-only file lookup has exact IDs and narrow result; generic failures expose no raw backend details", async () => {
  const f = clientFixture();
  f.result({ data: [{ storage_path: "47/uuid.jpg", metadata: "SECRET", created_by: "SECRET" }], error: null });
  assert.deepEqual(await f.service.getClientObjectPhotoFile(47, 11), { storage_path: "47/uuid.jpg" });
  assert.deepEqual(f.calls.at(-1), ["get_client_object_photo_file", { p_object_id: 47, p_photo_id: 11 }]);
  for (const storage_path of [null, "", "../secret.jpg", "/secret.jpg", "47/../secret.jpg"]) {
    f.result({ data: [{ storage_path }], error: null });
    await assert.rejects(() => f.service.getClientObjectPhotoFile(47, 11), /Не вдалося/);
  }
  for (const result of [{ data: null, error: { code: "XX000", message: "SECRET" } }, () => { throw new Error("SECRET_NETWORK"); }]) {
    f.result(result);
    await assert.rejects(() => f.service.getClientObjectPhotosPage(47), (error) => { assert.doesNotMatch(error.message, /SECRET/); return true; });
  }
});

test("active management only: worker/client denied before query; page IDs batched and mutation input allowlisted", async () => {
  let identity = "internal", profile = null, response = { data: [publication()], error: null }, created = 0;
  const calls = [];
  const service = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => { created++; return { rpc: async (name, args) => { calls.push([name, args]); return response; } }; } },
  })("services/clientPhotoManagementService.ts");
  for (profile of [null, { role: "worker", is_active: true }, { role: "admin", is_active: false }]) {
    await assert.rejects(() => service.getManagementClientPhotoPublications(47, [11]));
    await assert.rejects(() => service.setClientObjectPhotoPublication(input()));
  }
  identity = "client"; profile = { role: "admin", is_active: true };
  await assert.rejects(() => service.getManagementClientPhotoPublications(47, [11]));
  await assert.rejects(() => service.setClientObjectPhotoPublication(input()));
  assert.equal(created, 0);
  identity = "internal";
  for (const role of ["admin", "object_manager"]) {
    profile = { role, is_active: true };
    assert.deepEqual(await service.getManagementClientPhotoPublications(47, [11, 11]), [publication()]);
    assert.deepEqual(calls.at(-1), ["get_management_client_photo_publications", { p_object_id: 47, p_photo_ids: [11] }]);
    assert.deepEqual(await service.setClientObjectPhotoPublication({ ...input(), created_by: "fake", updated_at: "fake" }), publication());
    assert.deepEqual(calls.at(-1), ["set_client_object_photo_publication", {
      p_object_id: 47, p_photo_id: 11, p_is_published: true, p_client_caption: "Квітник", p_sort_order: 0,
    }]);
  }
  const before = created;
  await assert.rejects(() => service.getManagementClientPhotoPublications(47, Array.from({ length: 101 }, (_, i) => i + 1)));
  assert.equal(created, before);
  response = { data: [{ ...publication(), object_id: 48 }], error: null };
  await assert.rejects(() => service.getManagementClientPhotoPublications(47, [11]));
  response = { data: null, error: { code: "22023", message: "SECRET" } };
  await assert.rejects(() => service.setClientObjectPhotoPublication(input()), /JPEG, PNG, WebP, GIF або AVIF/);
});

test("SQL safe-raster predicate rejects unknown/SVG/HTML and mismatched extensions; every read/publish uses it", () => {
  const raster = body("client_photo_is_safe_raster");
  const entries = [...raster.matchAll(/when '([^']+)' then pg_catalog.lower\(p_path\) ~ '([^']+)'/gu)];
  assert.deepEqual(entries.map((m) => m[1]), ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
  // Evaluate the literal allowlist/regexes as data, never execute SQL.
  const eligible = (path, mime) => typeof path === "string" && entries.some((m) => m[1] === mime && new RegExp(m[2], "u").test(path.toLowerCase()));
  for (const [ext, mime] of [["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"], ["gif", "image/gif"], ["avif", "image/avif"]]) {
    assert.equal(eligible(`47/file.${ext}`, mime), true);
  }
  for (const [path, mime] of [["47/a.svg", "image/svg+xml"], ["47/a.html", "text/html"], ["47/a.jpg", "application/octet-stream"], ["47/a.jpg", null], ["47/a.svg", "image/jpeg"], ["47/a.jpg", "image/png"], [null, "image/jpeg"]]) {
    assert.equal(eligible(path, mime), false);
  }
  assert.match(raster, /else false end, false/u);
  for (const name of ["get_client_object_photo_file", "get_client_object_photos", "set_client_object_photo_publication"]) {
    assert.match(body(name), /private\.client_photo_is_safe_raster\(file\.name,file\.metadata->>'mimetype'\)/u);
    assert.match(body(name), /file\.bucket_id='object-photos'/u);
  }
  assert.match(body("get_client_object_photo_file"), /private\.client_can_read_object_photo\(ph\.storage_path\)/u);
  assert.doesNotMatch(body("client_can_read_object_photo"), /storage\s*\.|client_photo_is_safe_raster/iu);
  assert.doesNotMatch(raster, /\b(?:from|join)\b|auth\.|storage\./iu);
});

test("SQL client reads independently guard object grants and publication, never return internal caption or full rows", () => {
  for (const name of ["get_client_object_photos", "get_client_object_photo_file"]) {
    const sql = body(name);
    for (const guard of ["auth.uid() is null", "private.is_active_client()", "private.client_has_object_access(p_object_id)"]) assert.ok(sql.includes(guard));
    assert.ok(sql.indexOf("errcode='42501'") < sql.indexOf("return query"));
    assert.match(sql, /ph\.object_id=p_object_id/u);
    assert.doesNotMatch(sql, /ph\.caption|created_by|updated_by|select \*/u);
  }
  const list = body("get_client_object_photos");
  assert.match(list, /pub\.photo_id=ph\.id and pub\.is_published/u);
  assert.match(list, /order by pub\.sort_order asc, pub\.published_at desc, ph\.id desc\s+limit 12 offset \(\(p_page-1\)\*12\)/u);
  assert.match(list, /pub\.client_caption, pub\.published_at, count\(\*\) over \(\)/u);
  assert.match(body("client_can_read_object_photo"), /ph\.storage_path=p_storage_path/u);
  assert.match(body("client_can_read_object_photo"), /private\.client_has_object_access\(ph\.object_id\)/u);
  assert.match(body("get_client_object_photo_file"), /if not found then raise exception 'Photo access denied\.'/u);
});

test("historical PRE added only the original GET policy; old table/Storage policy bodies and helper ACL are untouched", () => {
  const policies = [...pre.matchAll(/create policy (\w+)[\s\S]*?\);/gu)];
  assert.equal(policies.length, 1);
  const policy = policies[0][0];
  assert.match(policy, /as permissive for select to authenticated/u);
  assert.match(policy, /bucket_id='object-photos'/u);
  assert.match(policy, /storage\.allow_only_operation\('object.get_authenticated'\)/u);
  assert.match(policy, /private\.client_can_read_object_photo\(objects.name\)/u);
  assert.match(policy, /private\.client_photo_is_safe_raster\(objects\.name,metadata->>'mimetype'\)/u);
  assert.doesNotMatch(policy, /object\.(?:list|sign)|for (?:insert|update|delete|all)/u);
  assert.doesNotMatch(pre, /drop policy|alter policy|update storage\.buckets|grant [^;]*client_has_object_access/iu);
  assert.equal(functions.length, 6);
  assert.deepEqual(functions.map((m) => m[1]), ["private.client_photo_is_safe_raster", "private.client_can_read_object_photo", "public.get_client_object_photos",
    "public.get_client_object_photo_file", "public.get_management_client_photo_publications", "public.set_client_object_photo_publication"]);
  assert.match(pre, /revoke all on function private\.client_photo_is_safe_raster\(text,text\) from public, anon, authenticated/u);
  assert.match(pre, /grant execute on function private\.client_photo_is_safe_raster\(text,text\),[\s\S]*? to authenticated;/u);
  assert.match(pre, /revoke all on table public\.client_object_photo_publications from public, anon, authenticated/u);
  assert.doesNotMatch(pre, /insert into public\.client_object_photo_publications[^$]*select[\s\S]*from public\.object_photos/iu);
});

test("PRE/audit reject known merged SQL tokens; declared parameters and ACL signatures stay well-formed", () => {
  const malformed = /\b(?:andrelkind|endif|usingerrcode|with_checkis|thenraise|ifnot|endloop|returnquery|andp\.prokind)\b|'objects'and/iu;
  for (const token of ["andrelkind", "endif", "usingerrcode", "with_checkis", "'objects'and", "thenraise", "ifnot", "endloop", "returnquery", "andp.prokind"]) {
    assert.match(token, malformed, `scanner must catch ${token}`);
  }
  for (const sql of [pre, audit, hotfix]) assert.doesNotMatch(sql, malformed);
  for (const [, name, args] of functions) {
    for (const arg of args.split(",")) assert.match(arg.trim(), /^p_\w+\s+(?:bigint(?:\[\])?|integer|text|boolean)(?:\s+default\s+1)?$/u, name);
  }
  assert.match(pre, /using errcode='42501'; end if;/u);
  assert.match(pre, /and relkind = 'r'/u);
  assert.match(pre, /p\.with_check is null/u);
  // Lexical regression checks, not a substitute for PostgreSQL compilation.
});

test("policy preflight and audit accept reviewed scalar SELECT guards but reject broader/different policies", () => {
  const contractBlock = (sql) => sql.match(/reviewed_policy_contracts\(schema_name,[\s\S]*?from reviewed_policy_contracts e\n  \)/u)?.[0];
  assert.ok(contractBlock(pre));
  assert.equal(contractBlock(pre), contractBlock(audit));
  const expected = new Map([...contractBlock(pre).matchAll(/\('(public|storage)','(object_photos|objects)','(SELECT|INSERT|DELETE)',array\[([\s\S]*?)\]\)/gu)]
    .map((m) => [`${m[1]}.${m[2]}:${m[3]}`, [...m[4].matchAll(/\$expr\$([\s\S]*?)\$expr\$|'(private\.is_active_user)'/gu)].map((v) => v[1] ?? v[2])]));
  assert.equal(expected.size, 6);
  // Model only the literal catalog normalization above, not SQL execution.
  const normalize = (value) => value?.replaceAll("::text[]", "").replaceAll("::text", "")
    .replaceAll("objects.bucket_id", "bucket_id").replace(/[\s()]/gu, "")
    .replaceAll("SELECTprivate.is_active_userASis_active_user", "private.is_active_user")
    .replaceAll("SELECTprivate.has_roleARRAY['admin','object_manager']AShas_role", "private.has_roleARRAY['admin','object_manager']");
  const active = "( SELECT private.is_active_user() AS is_active_user )";
  const manager = "( SELECT private.has_role(ARRAY['admin'::text, 'object_manager'::text]) AS has_role )";
  const accepts = (scope, command, expression, roles = ["authenticated"], mode = "PERMISSIVE") =>
    roles.length === 1 && roles[0] === "authenticated" && mode === "PERMISSIVE"
    && (expected.get(`${scope}:${command}`) ?? []).includes(normalize(expression));
  for (const scope of ["public.object_photos", "storage.objects"]) {
    for (const command of ["SELECT", "INSERT", "DELETE"]) {
      const guard = command === "SELECT" ? active : manager;
      const expression = scope.startsWith("storage") ? `((objects.bucket_id = 'object-photos'::text) AND ${guard})` : guard;
      assert.equal(accepts(scope, command, expression), true);
      assert.equal(accepts(scope, command, expression.replaceAll("SELECT ", "").replace(/ AS (is_active_user|has_role)/gu, "")), true);
      for (const bad of ["true", `${expression} OR true`, `NOT (${expression})`,
        expression.replace("private.", "public."), expression.replace("SELECT ", "SELECT true OR "),
        expression.replace(" AS ", " FROM public.objects AS ")]) assert.equal(accepts(scope, command, bad), false, bad);
      assert.equal(accepts(scope, command, expression, ["authenticated", "anon"]), false);
      assert.equal(accepts(scope, command, expression, ["public"]), false);
      assert.equal(accepts(scope, command, expression, ["authenticated"], "RESTRICTIVE"), false);
      assert.equal(accepts(scope, "UPDATE", expression), false);
      assert.equal(accepts(scope, "ALL", expression), false);
      if (scope.startsWith("storage")) {
        assert.equal(accepts(scope, command, guard), false);
        assert.equal(accepts(scope, command, expression.replace(" AND ", " OR ")), false);
        assert.equal(accepts(scope, command, expression.replace("object-photos", "other-bucket")), false);
      }
      if (command !== "SELECT") {
        assert.equal(accepts(scope, command, expression.replace("'object_manager'", "'worker'")), false);
        assert.equal(accepts(scope, command, expression.replace("'admin'", "'ADMIN'")), false);
      }
    }
  }
  assert.match(pre, /case when p.cmd='INSERT' then p.qual is null else p.with_check is null end/u);
  assert.match(pre, /into v_policy_issues from internal_policy_results where not matches/u);
  assert.match(audit, /from internal_policy_results p/u);
});

test("Storage hotfix is transactional/repeatable and replaces only the named SELECT policy with the exact read pair", () => {
  const sql = hotfix.replace(/--[^\n]*/gu, "").trim();
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
  assert.equal(statements.length, 5);
  assert.deepEqual(statements.slice(0, 3), [
    "begin", "set local search_path = pg_catalog",
    "drop policy if exists client_object_photos_authenticated_get on storage.objects",
  ]);
  assert.equal(statements[4], "commit");
  assert.match(statements[3], /^create policy client_object_photos_authenticated_get on storage\.objects\s+as permissive for select to authenticated\s+using \(/u);
  assert.deepEqual([...statements[3].matchAll(/'object\.([^']+)'/gu)].map((m) => m[1]), ["get_authenticated_info", "get_authenticated"]);
  assert.doesNotMatch(sql, /\b(?:grant|revoke|alter|insert|update|delete|function|table)\b/iu);
});

test("Storage audit requires both authenticated reads and rejects old policy, extra operations, missing guards and role/command drift", () => {
  const policy = hotfix.match(/create policy client_object_photos_authenticated_get[\s\S]*?using \(([\s\S]*?)\n\);/u)[1];
  const normalize = (value) => value.replaceAll("::text[]", "").replaceAll("::text", "").replaceAll("objects.", "").replace(/[\s()]/gu, "");
  // CREATE text uses lower-case SQL keywords; pg_policies deparses AND as upper-case.
  const deparsed = policy.replace(/\band\b/gu, "AND");
  const expected = audit.match(/\$expr\$(bucket_id='object-photos'ANDstorage\.allow_any_operation[^$]+)\$expr\$/u)[1];
  assert.equal(normalize(deparsed), expected);
  // Also model the actual pg_policies rendering with per-element text casts.
  assert.equal(normalize(deparsed.replace(/'(object\.[^']+)'/gu, "'$1'::text")), expected);
  const oldPolicy = pre.match(/create policy client_object_photos_authenticated_get[\s\S]*?using \(([\s\S]*?)\n    \);/u)[1];
  for (const bad of [
    oldPolicy.replace(/\band\b/gu, "AND"),
    deparsed.replace(/'object.get_authenticated_info',/u, ""),
    deparsed.replace(/,\s*'object.get_authenticated'/u, ""),
    ...["object.list", "object.sign", "object.upload", "object.delete", "object.info"].map((operation) =>
      deparsed.replace("'object.get_authenticated'", `'object.get_authenticated','${operation}'`)),
    deparsed.replace("object.get_authenticated_info", "OBJECT.GET_AUTHENTICATED_INFO"),
    deparsed.replace(/bucket_id = 'object-photos'\s+AND /u, ""),
    deparsed.replace(/AND private\.client_photo_is_safe_raster[^\n]+/u, ""),
    deparsed.replace(/AND private\.client_can_read_object_photo[^\n]+/u, ""),
    `${deparsed} OR true`, deparsed.replace("'object-photos'", "'other-bucket'"),
  ]) assert.notEqual(normalize(bad), expected);
  const policyCheck = audit.match(/select 'client_storage_get_policy',[\s\S]*?\n\s*union all/u)[0];
  assert.match(policyCheck, /p\.cmd='SELECT' and p\.permissive='PERMISSIVE' and p\.roles=array\['authenticated'::name\]/u);
  assert.match(policyCheck, /p\.with_check is null/u);
  assert.match(policyCheck, /p\.normalized_qual=\$expr\$/u);
  // Model these exact catalog predicates; this is not a live RLS simulation.
  const accepts = ({ cmd = "SELECT", mode = "PERMISSIVE", roles = ["authenticated"], withCheck = null, qual = deparsed } = {}) =>
    cmd === "SELECT" && mode === "PERMISSIVE" && roles.length === 1 && roles[0] === "authenticated"
    && withCheck === null && normalize(qual) === expected;
  assert.equal(accepts(), true);
  for (const drift of [{ cmd: "ALL" }, { cmd: "INSERT" }, { cmd: "UPDATE" }, { cmd: "DELETE" },
    { mode: "RESTRICTIVE" }, { roles: ["anon"] }, { roles: ["public"] },
    { roles: ["authenticated", "anon"] }, { withCheck: "true" }]) assert.equal(accepts(drift), false);
  assert.match(audit, /storage_policy_helpers_no_self_reference/u);
  assert.match(audit, /md5\(f.prosrc\)=f.source_md5/u);
  assert.match(audit, /\('storage.allow_any_operation\(text\[\]\)'\)/u);
  assert.match(audit, /'definition',pg_get_functiondef\(p.oid\),'acl',p.proacl::text/u);
});

test("verified production guards are pinned and metadata-reading DEFINER ownership/BYPASSRLS is asserted", () => {
  const fingerprints = [
    ["private.is_active_user()", "9bbc898ebc01d7371aae4e8c5de61da1"],
    ["private.has_role(text[])", "53ee6011008695bf5bba95283f571979"],
    ["private.is_active_client()", "b220a9950bb96f0f6bd817af5fa20e41"],
    ["private.client_has_object_access(bigint)", "a94f372e167d6a9d30ab7db3ff2c698f"],
    ["storage.allow_only_operation(text)", "8682c6d323bc2e01e70abf92f4ae85f6"],
    ["storage.operation()", "a9b2cc8c1b536867e48f86d3455d4704"],
  ];
  for (const sql of [pre, audit]) for (const [name, hash] of fingerprints) assert.ok(sql.includes(`('${name}','${hash}')`), name);
  assert.match(pre, /rolname=current_user and \(rolsuper or rolbypassrls\)/u);
  assert.match(pre, /has_table_privilege\(current_user,'storage.objects','SELECT'\)/u);
  assert.match(pre, /pg_get_userbyid\(p.proowner\)<>'postgres'/u);
  assert.match(audit, /r.rolname='postgres' and \(r.rolsuper or r.rolbypassrls\)/u);
  assert.match(audit, /has_table_privilege\(r.oid,to_regclass\('storage.objects'\),'SELECT'\)/u);
  assert.match(audit, /'definition',pg_get_functiondef\(p.oid\),'acl',p.proacl::text/u);
});

test("management SQL validates, locks original photo before upsert, timestamps transitions and retains audit history", () => {
  for (const name of ["get_management_client_photo_publications", "set_client_object_photo_publication"]) {
    const sql = body(name);
    assert.match(sql, /private\.is_active_user\(\)/u);
    assert.match(sql, /private\.has_role\(array\['admin','object_manager'\]::text\[\]\)/u);
    assert.ok(sql.indexOf("errcode='42501'") < sql.indexOf("from public.object_photos"));
  }
  const mutation = body("set_client_object_photo_publication");
  assert.ok(mutation.indexOf("for update") < mutation.indexOf("insert into"));
  assert.match(mutation, /ph\.id=p_photo_id and ph\.object_id=p_object_id for update/u);
  assert.match(mutation, /if p_is_published and not exists/u);
  assert.match(mutation, /when excluded\.is_published and not existing\.is_published then v_now else existing\.published_at end/u);
  assert.match(mutation, /unpublished_at=case when excluded\.is_published then null else v_now end/u);
  assert.match(mutation, /updated_at=v_now,updated_by=auth\.uid\(\)/u);
  assert.doesNotMatch(mutation, /delete from|created_at=|created_by=|version/u);
});

test("audit hashes match authored bodies; audit is read-only and preserves exact prior policy/guard baselines", () => {
  for (const [, name, args, , source] of functions) {
    const types = args.trim().split(",").map((arg) => arg.trim().split(/\s+/u)[1]).join(",");
    const signature = `${name}(${types})`;
    const hash = createHash("md5").update(source).digest("hex");
    assert.ok(audit.includes(`('${signature}','${hash}'`), signature);
    assert.ok(pre.includes(signature), `ACL signature ${signature}`);
  }
  assert.match(audit, /begin;\s*set transaction read only;\s*set local search_path = pg_catalog;/u);
  assert.doesNotMatch(audit.replace(/--[^\n]*/gu, ""), /\b(?:from|join) (?:public|auth)\.|\bselect (?:private|public)\.\w+\(/iu);
  assert.match(audit, /CLIENT_PORTAL_1_0C1A_STRUCTURAL_SUMMARY/u);
  for (const sql of [pre, audit]) {
    assert.match(sql, /client-portal-1\.0c1a:v1;policies=/u);
    assert.match(sql, /jsonb_agg\(to_jsonb\(p\)\s+order by p\.schemaname,p\.tablename,p\.policyname\)/u);
    assert.match(sql, /private\.client_has_object_access\(bigint\)/u);
    assert.match(sql, /public\.save_client_object_progress\(bigint,smallint,text,text,jsonb,bigint\)/u);
  }
  for (const file of ["services/clientPhotoService.ts", "services/clientPhotoManagementService.ts"]) {
    const source = read(file);
    assert.match(source, /import "server-only"/u);
    assert.doesNotMatch(source, /supabaseAdmin|SERVICE_ROLE|createSignedUrl|\.from\(/u);
  }
});

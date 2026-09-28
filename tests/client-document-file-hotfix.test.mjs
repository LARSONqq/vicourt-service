// SQL is inspected as source only. These assertions are NOT live DB/RLS proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

const read = (p) => readFileSync(p, "utf8");
const deploy = read("database/client-portal-1.0c2-file-resolver-hotfix-deploy.sql");
const audit = read("database/client-portal-1.0c2-file-resolver-hotfix-production-audit.sql");
const definition = deploy.match(/create or replace function public\.get_client_object_document_file_server\(([\s\S]*?)\)\s*returns([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/u);
const body = definition[3];
const md5 = (s) => createHash("md5").update(s).digest("hex");

test("hotfix denies the old API and grants only the new exact service-role resolver; owner remains postgres", () => {
  const acl = new Map([
    ["get_client_object_document_file(bigint,bigint)", new Set(["public", "anon", "authenticated", "service_role"])],
    ["get_client_object_document_file_server(uuid,bigint,bigint)", new Set(["public", "anon", "authenticated", "service_role"])],
  ]);
  const statements = [...deploy.matchAll(/^(revoke all|grant execute) on function public\.([^ ]+) (?:from|to) ([^;]+);/gmu)];
  assert.equal(statements.length, 3);
  for (const [, command, signature, roles] of statements) {
    assert.ok(acl.has(signature));
    for (const role of roles.split(/,\s*/u)) {
      if (command === "revoke all") acl.get(signature).delete(role);
      else acl.get(signature).add(role);
    }
  }
  assert.deepEqual([...acl.values()].map((v) => [...v]), [[], ["service_role"]]);
  assert.match(deploy, /alter function public\.get_client_object_document_file_server\(uuid,bigint,bigint\) owner to postgres;/u);
  assert.doesNotMatch(deploy, /with grant option|(?:drop|alter|create) policy|update storage\.|create table|grant .* on table/iu);
  assert.equal((deploy.match(/create or replace function/gu) ?? []).length, 1);
  assert.match(audit, /not has_function_privilege\('service_role',p\.oid,'EXECUTE'\)/u);
  assert.match(audit, /a\.grantee not in \(p\.proowner,to_regrole\('service_role'\)::oid\) or a\.is_grantable/u);
});

test("explicit supplied-client contract covers canonical identity, live grant, exact document, readiness and current Storage", () => {
  assert.match(definition[1], /p_client_user_id uuid, p_object_id bigint, p_document_id bigint/u);
  assert.match(definition[2], /table\(storage_path text, mime_type text, client_title text\)/u);
  assert.match(definition[2], /language plpgsql stable security definer set search_path = ''/u);
  for (const fragment of [
    "p_client_user_id is null", "p_object_id <= 0", "p_document_id <= 0",
    "private.legacy_internal_signup_enabled() is distinct from false",
    "join auth.users u on u.id = c.user_id", "c.user_id = p_client_user_id and c.is_active = true",
    "u.raw_app_meta_data ->> 'account_type' = 'client'",
    "or exists (select 1 from public.profiles p where p.id = p_client_user_id)",
    "a.client_user_id = p_client_user_id and a.object_id = p_object_id", "a.revoked_at is null",
    "pub.document_id = d.id and pub.is_published = true", "d.id = p_document_id and d.object_id = p_object_id and d.is_ready = true",
    "d.file_size between 1 and 26214400", "file.bucket_id = 'object-documents' and file.name = d.storage_path",
    "private.client_document_is_safe_file(d.storage_path, d.mime_type)", "file.metadata ->> 'mimetype' = d.mime_type",
    "private.client_document_is_safe_file(file.name, file.metadata ->> 'mimetype')",
    "if not found then", "using errcode = '42501'",
  ]) assert.ok(body.includes(fragment), fragment);
  assert.doesNotMatch(body.replace(/--[^\n]*/gu, ""), /auth\.uid|private\.is_active_client\(|private\.client_has_object_access\(|private\.client_can_read_object_document\(|select \*|d\.(?:title|note|access_level|original_file_name)|\b(?:insert|update|delete)\b/iu);
  assert.ok(body.indexOf("raise exception") < body.indexOf("return query"));
  assert.ok(deploy.includes(`md5(p.prosrc)<>'${md5(body)}'`));
  assert.ok(audit.includes(`md5(p.prosrc)='${md5(body)}'`), "Exact body pin protects ALL explicit guards, not keyword presence alone");
});

test("hotfix audit preserves exact list/helper/policy contracts with sequential fail-closed catalog checks", () => {
  const baseline = (s) => [...s.matchAll(/-- HOTFIX PRESERVATION BEGIN[^\n]*\n([\s\S]*?)\n-- HOTFIX PRESERVATION END/gu)].map((m) => m[1]);
  assert.equal(baseline(deploy).length, 2);
  assert.deepEqual(baseline(deploy), [baseline(audit)[0], baseline(audit)[0]]);
  assert.match(deploy, /v_existing is distinct from v_baseline::text/u);
  assert.match(audit, /'foundation_baseline',obj_description/u);
  for (const hash of ["19d78281b49a8e3e347b0536840c88d2", "407da87238d42a76d764c6f273ce99a8", "577b3085d41abb9c20c363d76b797bb6"])
    for (const sql of [deploy, audit]) assert.ok(sql.includes(hash));
  const expectation = (s) => s.match(/=\$expr\$([^$]+)\$expr\$/u)[1];
  assert.equal(expectation(deploy), expectation(audit));
  assert.equal(expectation(audit), read("database/client-portal-1.0c2-production-audit.sql").match(/=\$expr\$([^$]+)\$expr\$/u)[1]);
  assert.deepEqual([...expectation(audit).matchAll(/'object\.([^']+)'/gu)].map((m) => m[1]), ["get_authenticated_info", "get_authenticated"]);
  assert.match(audit, /p\.roles=array\['authenticated'::name\]/u);
  assert.match(audit, /rolsuper or rolbypassrls/u);
  assert.match(audit, /not has_function_privilege\('authenticated','private.client_has_object_access\(bigint\)'/u);
  assert.match(audit, /begin;\s*set transaction read only;\s*set local search_path = pg_catalog;/u);
  assert.match(audit, /exception when others then[\s\S]*?'status','FAIL'/u);
  assert.match(audit, /'runtime_authorization_tested',false,'requires_storage_session_smoke',true/u);
  assert.equal([...audit.matchAll(/^    \(\d+, '[^']+', \$check\$/gmu)].length, 12);
  assert.match(audit, /count\(\*\)=12 and bool_and\(status='PASS'\)/u);
  assert.doesNotMatch(audit.replace(/--[^\n]*/gu, ""), /^(?:create|alter|drop|grant|revoke|insert|update|delete|call)\s/gimu);
  for (const sql of [deploy, audit]) assert.doesNotMatch(sql, /RESOLVER_BODY_HASH|\b(?:andrelkind|endif|usingerrcode|with_checkis|thenraise|ifnot|endloop|returnquery|andp\.prokind)\b|'objects'and/iu);
});

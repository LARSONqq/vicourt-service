-- Client Portal 1.0C1: record the manually verified production Storage read fix.
-- New environments: original 1.0C1 PRE -> this hotfix -> production audit.
-- Already-hotfixed production needs only the updated read-only audit.
-- Do not rerun the historical PRE after this file: it expects the old policy.
-- Transactional and repeatable; replaces ONLY the named client SELECT policy.
-- Existing helper definitions/ACLs, other policies and private bucket stay intact.
begin;
set local search_path = pg_catalog;

drop policy if exists client_object_photos_authenticated_get on storage.objects;

create policy client_object_photos_authenticated_get on storage.objects
as permissive for select to authenticated
using (
  bucket_id = 'object-photos'
  and storage.allow_any_operation(ARRAY[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ]::text[])
  and private.client_photo_is_safe_raster(name, metadata ->> 'mimetype')
  and private.client_can_read_object_photo(name)
);

commit;

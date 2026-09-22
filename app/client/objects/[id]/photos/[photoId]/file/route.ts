import { createClient } from "@/lib/supabase/server";
import { positivePhotoId } from "@/lib/clientPhoto";
import { getClientObjectPhotoFile } from "@/services/clientPhotoService";

export const dynamic = "force-dynamic";

const safeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => new Response(null, { status: 404, headers: privateHeaders });

function safeStorageErrorFields(error: unknown) {
  const fields: Record<string, string | number> = {};
  if (!error || typeof error !== "object") return fields;
  for (const key of ["name", "code", "status", "statusCode"] as const) {
    const value = (error as Record<string, unknown>)[key];
    // Only short identifiers/statuses, never messages or arbitrary nested data.
    if (typeof value === "string" && /^[A-Za-z0-9_]{1,64}$/u.test(value)) fields[key] = value;
    else if (typeof value === "number" && Number.isSafeInteger(value)) fields[key] = value;
  }
  return fields;
}

export async function GET(_request: Request, { params }: {
  params: Promise<{ id: string; photoId: string }>;
}) {
  const { id, photoId } = await params;
  if (!/^\d+$/u.test(id) || !/^\d+$/u.test(photoId)
    || !positivePhotoId(Number(id)) || !positivePhotoId(Number(photoId))) return unavailable();
  const diagnosticIds = { objectId: Number(id), photoId: Number(photoId) };
  let lookupComplete = false;
  let storageAuthState: "authenticated" | "unauthenticated" = "unauthenticated";
  try {
    // Rechecks identity + current object grant + publication on every request.
    // The delivery reference never leaves this server-only handler.
    const { storage_path } = await getClientObjectPhotoFile(Number(id), Number(photoId));
    lookupComplete = true;
    const supabase = await createClient(); // Same requesting session cookies, never an admin client.
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (!authError && authData.user) storageAuthState = "authenticated";
    // Storage independently authorizes object.get_authenticated; lookup is not a bearer grant.
    const { data, error } = await supabase.storage.from("object-photos").download(storage_path);
    if (error) {
      console.warn("[client-photo-file] storage_download_failed", {
        ...diagnosticIds, authState: storageAuthState, ...safeStorageErrorFields(error),
      });
      return unavailable();
    }
    if (!(data instanceof Blob)) {
      console.warn("[client-photo-file] invalid_blob", diagnosticIds);
      return unavailable();
    }
    if (!safeTypes.has(data.type)) {
      console.warn("[client-photo-file] rejected_mime", { ...diagnosticIds, type: data.type });
      return unavailable();
    }
    return new Response(data, { headers: { ...privateHeaders, "Content-Type": data.type } });
  } catch (error) {
    // Includes identity redirects and notFound from the lookup. File denials
    // are indistinguishable and must never redirect to login or a Storage URL.
    if (lookupComplete) {
      console.warn("[client-photo-file] storage_download_failed", {
        ...diagnosticIds, authState: storageAuthState, ...safeStorageErrorFields(error),
      });
    } else {
      console.warn("[client-photo-file] lookup_failed", diagnosticIds);
    }
    return unavailable();
  }
}

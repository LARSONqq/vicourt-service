import { createClient } from "@/lib/supabase/server";
import { positivePhotoId } from "@/lib/clientPhoto";
import { getClientObjectPhotoFile } from "@/services/clientPhotoService";

export const dynamic = "force-dynamic";

const safeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => new Response(null, { status: 404, headers: privateHeaders });

export async function GET(_request: Request, { params }: {
  params: Promise<{ id: string; photoId: string }>;
}) {
  const { id, photoId } = await params;
  if (!/^\d+$/u.test(id) || !/^\d+$/u.test(photoId)
    || !positivePhotoId(Number(id)) || !positivePhotoId(Number(photoId))) return unavailable();
  try {
    // Rechecks identity + current object grant + publication on every request.
    // The delivery reference never leaves this server-only handler.
    const { storage_path } = await getClientObjectPhotoFile(Number(id), Number(photoId));
    const supabase = await createClient(); // Same requesting session cookies, never an admin client.
    // Storage independently authorizes authenticated info + download; lookup is not a bearer grant.
    const { data, error } = await supabase.storage.from("object-photos").download(storage_path);
    if (error || !(data instanceof Blob) || !safeTypes.has(data.type)) return unavailable();
    return new Response(data, { headers: { ...privateHeaders, "Content-Type": data.type } });
  } catch {
    // Includes identity redirects and notFound from the lookup. File denials
    // are indistinguishable and must never redirect to login or a Storage URL.
    return unavailable();
  }
}

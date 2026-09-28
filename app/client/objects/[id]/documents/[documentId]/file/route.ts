import { createClient } from "@/lib/supabase/server";
import { CLIENT_DOCUMENT_MAX_SIZE, clientDocumentFileType, clientDocumentTransportMimeMatches, positiveDocumentId } from "@/lib/clientDocument";
import { resolveClientObjectDocumentFile } from "@/services/clientDocumentFileService";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => new Response(null, { status: 404, headers: privateHeaders });

function attachment(title: string, extension: string) {
  // Strip separators, controls, bidi formatting and header syntax. Keep Unicode
  // letters for the RFC 5987 name; the quoted fallback is always ASCII.
  const base = Array.from(title.normalize("NFC").replace(/[^\p{L}\p{M}\p{N} _-]/gu, " ")
    .replace(/ +/gu, " ").trim()).slice(0, 100).join("").trim() || "Документ";
  const encoded = encodeURIComponent(`${base}.${extension}`);
  return `attachment; filename="document.${extension}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, { params }: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params;
  if (!/^\d+$/u.test(id) || !/^\d+$/u.test(documentId)
    || !positiveDocumentId(Number(id)) || !positiveDocumentId(Number(documentId))) return unavailable();
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return unavailable();
    // Only the verified session ID is supplied to the service-role metadata
    // resolver. No request body/query parameter can select the client identity.
    const { storage_path, mime_type, client_title } = await resolveClientObjectDocumentFile(authData.user.id, Number(id), Number(documentId));
    const fileType = clientDocumentFileType(mime_type);
    if (!fileType) return unavailable();
    // Use the very same user-scoped client; Storage independently reauthorizes
    // authenticated info + download against the current grant/publication.
    const { data, error } = await supabase.storage.from("object-documents").download(storage_path);
    if (error || !(data instanceof Blob) || !clientDocumentTransportMimeMatches(data.type, mime_type)
      || data.size < 1 || data.size > CLIENT_DOCUMENT_MAX_SIZE) return unavailable();
    return new Response(data, { headers: {
      ...privateHeaders, "Content-Type": mime_type,
      "Content-Disposition": attachment(client_title, fileType.extension),
    } });
  } catch {
    // Identity redirects, denials, missing records and technical failures are
    // indistinguishable. Never redirect to login or disclose a Storage error.
    return unavailable();
  }
}

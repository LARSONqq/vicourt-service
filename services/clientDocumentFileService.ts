import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { clientDocumentIsSafeFile, positiveDocumentId } from "@/lib/clientDocument";

const unavailable = () => new Error("Документ недоступний.");

// Only the download handler calls this with the ID returned by auth.getUser().
// The service credential is metadata-only. The RPC rechecks this supplied user
// explicitly; auth.uid()/service-role RLS bypass must never authorize a client.
// Never return this reference from a page, Server Action or Client Component.
export async function resolveClientObjectDocumentFile(verifiedUserId: string, objectId: number, documentId: number): Promise<{
  storage_path: string; mime_type: string; client_title: string;
}> {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(verifiedUserId)
      || !positiveDocumentId(objectId) || !positiveDocumentId(documentId)) throw unavailable();
    const metadataClient = createServiceRoleClient();
    const { data, error } = await metadataClient.rpc("get_client_object_document_file_server", {
      p_client_user_id: verifiedUserId, p_object_id: objectId, p_document_id: documentId,
    });
    if (error || !Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object") throw unavailable();
    const row = data[0] as Record<string, unknown>;
    const path = row.storage_path;
    if (typeof path !== "string" || !path || /[\\\u0000-\u001f\u007f]/u.test(path)
      || path.split("/").some((part) => !part || part === "." || part === "..")
      || !clientDocumentIsSafeFile(path, row.mime_type)
      || typeof row.client_title !== "string" || !row.client_title
      || row.client_title !== row.client_title.replace(/^ +| +$/gu, "")
      || Array.from(row.client_title).length > 150) throw unavailable();
    return { storage_path: path, mime_type: row.mime_type as string, client_title: row.client_title };
  } catch {
    // Includes missing server configuration and network/DB errors; no secrets,
    // reference or raw provider errors escape the server-only resolver.
    throw unavailable();
  }
}

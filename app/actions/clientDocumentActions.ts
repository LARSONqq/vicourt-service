"use server";

import { revalidatePath } from "next/cache";
import { ClientPortalInputError } from "@/lib/clientPortal";
import { clientDocumentPublicationEditorDto } from "@/lib/clientDocument";
import { setClientObjectDocumentPublication } from "@/services/clientDocumentManagementService";

export async function saveClientDocumentPublication(input: unknown) {
  try {
    // The canonical service checks internal identity + active management role
    // before validation/RPC. Browser-supplied roles/actor IDs are never trusted.
    const publication = await setClientObjectDocumentPublication(input);
    revalidatePath(`/objects/${publication.object_id}`);
    revalidatePath(`/client/objects/${publication.object_id}`);
    return { ok: true as const, publication: clientDocumentPublicationEditorDto(publication) };
  } catch (error) {
    return { ok: false as const, message: error instanceof ClientPortalInputError
      ? error.message : "Не вдалося зберегти публікацію документа. Спробуйте ще раз." };
  }
}

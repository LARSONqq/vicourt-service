"use server";

import { revalidatePath } from "next/cache";
import { ClientPortalInputError } from "@/lib/clientPortal";
import { clientPhotoPublicationEditorDto } from "@/lib/clientPhoto";
import { setClientObjectPhotoPublication } from "@/services/clientPhotoManagementService";

export async function saveClientPhotoPublication(input: unknown) {
  try {
    // Canonical service checks internal identity + active management role BEFORE
    // validation/RPC. Never trust role flags or actor metadata from the browser.
    const publication = await setClientObjectPhotoPublication(input);
    revalidatePath(`/objects/${publication.object_id}`);
    revalidatePath(`/client/objects/${publication.object_id}`);
    return { ok: true as const, publication: clientPhotoPublicationEditorDto(publication) };
  } catch (error) {
    return { ok: false as const, message: error instanceof ClientPortalInputError
      ? error.message : "Не вдалося зберегти публікацію фото. Спробуйте ще раз." };
  }
}

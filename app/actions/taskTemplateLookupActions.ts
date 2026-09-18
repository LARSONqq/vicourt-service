"use server";

import { requireTemplateManagement } from "@/services/taskTemplateService";
import { createClient } from "@/lib/supabase/server";
import { taskSearchOperand } from "@/lib/taskWorkspace";
import type { TemplateLookupKind, TemplateOption } from "@/types/taskTemplateWorkspace";

export async function searchTemplateOptions(kind: TemplateLookupKind, search: string, page = 1): Promise<
  { ok: true; options: TemplateOption[]; page: number; hasMore: boolean } | { ok: false; error: string }
> {
  try {
    await requireTemplateManagement();
    if (!["employee", "object", "equipment"].includes(kind)) throw new Error("Invalid lookup kind");
    const supabase = await createClient();
    const safePage = Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
    const term = String(search).trim().slice(0, 100);
    const pattern = taskSearchOperand(term);
    if (kind === "employee") {
      let query = supabase.from("employees").select("id, first_name, last_name");
      if (term) query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`);
      const { data, error } = await query.order("last_name").order("first_name").order("id").range((safePage - 1) * 20, safePage * 20);
      if (error) throw error;
      const rows = data ?? [];
      return { ok: true, options: rows.slice(0, 20).map((row) => ({ id: row.id, label: `${row.last_name} ${row.first_name}` })), page: safePage, hasMore: rows.length > 20 };
    }
    let query = supabase.from(kind === "object" ? "objects" : "equipment").select("id, name");
    if (term) query = query.or(`name.ilike.${pattern}`);
    const { data, error } = await query.order("name").order("id").range((safePage - 1) * 20, safePage * 20);
    if (error) throw error;
    const rows = data ?? [];
    return { ok: true, options: rows.slice(0, 20).map((row) => ({ id: row.id, label: row.name })), page: safePage, hasMore: rows.length > 20 };
  } catch (error) {
    console.error("[Task templates] Lookup failed", error);
    return { ok: false, error: "Не вдалося завантажити варіанти. Перевірте права доступу та спробуйте ще раз." };
  }
}

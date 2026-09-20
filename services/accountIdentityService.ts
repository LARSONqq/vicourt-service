import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccountIdentity } from "@/lib/auth/accountRouting";

export const getAccountIdentity = cache(async (): Promise<AccountIdentity> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return "guest";
  const result = await supabase.rpc("get_application_identity");
  if (result.error) return "denied";
  return result.data === "internal" || result.data === "client" ? result.data : "denied";
});

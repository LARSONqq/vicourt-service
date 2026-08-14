import { createClient } from "@/lib/supabase/server";
import type {
  UserProfile,
} from "@/types/userProfile";

export async function getCurrentUserProfile(): Promise<
  UserProfile | null
> {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      role,
      employee_id,
      created_at,
      updated_at
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити профіль користувача: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return data as UserProfile;
}

export async function getUserProfiles(): Promise<
  UserProfile[]
> {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    throw new Error(
      "Користувач не авторизований."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      role,
      employee_id,
      created_at,
      updated_at
    `)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити користувачів: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? (data as UserProfile[])
    : [];
}
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/userProfile";

function isUserRole(
  value: string
): value is UserRole {
  return (
    value === "admin" ||
    value === "object_manager" ||
    value === "worker"
  );
}

function validateProfileId(
  value: string
) {
  if (!value.trim()) {
    throw new Error(
      "Не вдалося визначити користувача."
    );
  }
}

export async function updateUserProfile(
  formData: FormData
) {
  const profileId = String(
    formData.get("profile_id") ?? ""
  ).trim();

  const roleValue = String(
    formData.get("role") ?? ""
  ).trim();

  const employeeValue = String(
    formData.get("employee_id") ?? ""
  ).trim();

  validateProfileId(profileId);

  if (!isUserRole(roleValue)) {
    throw new Error(
      "Некоректна роль користувача."
    );
  }

  let employeeId: number | null = null;

  if (employeeValue) {
    const parsedEmployeeId =
      Number(employeeValue);

    if (
      !Number.isInteger(
        parsedEmployeeId
      ) ||
      parsedEmployeeId <= 0
    ) {
      throw new Error(
        "Не вдалося визначити працівника."
      );
    }

    employeeId =
      parsedEmployeeId;
  }

  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const currentUserId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !currentUserId
  ) {
    throw new Error(
      "Користувач не авторизований."
    );
  }

  const {
    data: currentProfile,
    error: currentProfileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq(
      "id",
      currentUserId
    )
    .maybeSingle();

  if (currentProfileError) {
    throw new Error(
      `Не вдалося перевірити права користувача: ${currentProfileError.message}`
    );
  }

  if (
    !currentProfile ||
    currentProfile.role !==
      "admin"
  ) {
    throw new Error(
      "Тільки адміністратор може змінювати користувачів."
    );
  }

  // Щоб випадково не забрати
  // права адміністратора у самого себе.
  if (
    profileId ===
      currentUserId &&
    roleValue !== "admin"
  ) {
    throw new Error(
      "Не можна забрати роль адміністратора у власного акаунта."
    );
  }

  if (employeeId !== null) {
    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select("id")
      .eq(
        "id",
        employeeId
      )
      .maybeSingle();

    if (employeeError) {
      throw new Error(
        `Не вдалося перевірити працівника: ${employeeError.message}`
      );
    }

    if (!employee) {
      throw new Error(
        "Працівника не знайдено."
      );
    }
  }

  const {
    error: updateError,
  } = await supabase
    .from("profiles")
    .update({
      role: roleValue,
      employee_id:
        employeeId,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      profileId
    );

  if (updateError) {
    if (
      updateError.code ===
      "23505"
    ) {
      throw new Error(
        "Цей працівник уже прив’язаний до іншого акаунта."
      );
    }

    throw new Error(
      `Не вдалося оновити користувача: ${updateError.message}`
    );
  }

  revalidatePath(
    "/users"
  );

  revalidatePath(
    "/",
    "layout"
  );
}
"use server";

import { revalidatePath } from "next/cache";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import type {
  UserRole,
} from "@/types/userProfile";

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

function getAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Не налаштовано серверний ключ Supabase для керування користувачами."
    );
  }

  return createAdminClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,
      },
    }
  );
}

async function requireAdmin() {
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
    .select(`
      id,
      role,
      is_active
    `)
    .eq(
      "id",
      currentUserId
    )
    .maybeSingle();

  if (
    currentProfileError
  ) {
    throw new Error(
      `Не вдалося перевірити права користувача: ${currentProfileError.message}`
    );
  }

  if (
    !currentProfile ||
    currentProfile.role !==
      "admin" ||
    currentProfile.is_active !==
      true
  ) {
    throw new Error(
      "Тільки активний адміністратор може змінювати користувачів."
    );
  }

  return {
    supabase,
    currentUserId,
  };
}

async function getActiveAdminCount(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const {
    count,
    error,
  } = await supabase
    .from("profiles")
    .select(
      "id",
      {
        count: "exact",
        head: true,
      }
    )
    .eq(
      "role",
      "admin"
    )
    .eq(
      "is_active",
      true
    );

  if (error) {
    throw new Error(
      `Не вдалося перевірити адміністраторів: ${error.message}`
    );
  }

  return count ?? 0;
}

function refreshUserPages() {
  revalidatePath(
    "/users"
  );

  revalidatePath(
    "/",
    "layout"
  );
}

export async function updateUserProfile(
  formData: FormData
) {
  const profileId =
    String(
      formData.get(
        "profile_id"
      ) ?? ""
    ).trim();

  const roleValue =
    String(
      formData.get(
        "role"
      ) ?? ""
    ).trim();

  const employeeValue =
    String(
      formData.get(
        "employee_id"
      ) ?? ""
    ).trim();

  validateProfileId(
    profileId
  );

  if (
    !isUserRole(
      roleValue
    )
  ) {
    throw new Error(
      "Некоректна роль користувача."
    );
  }

  let employeeId:
    | number
    | null = null;

  if (employeeValue) {
    const parsedEmployeeId =
      Number(
        employeeValue
      );

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

  const {
    supabase,
    currentUserId,
  } =
    await requireAdmin();

  if (
    profileId ===
      currentUserId &&
    roleValue !==
      "admin"
  ) {
    throw new Error(
      "Не можна забрати роль адміністратора у власного акаунта."
    );
  }

  const {
    data: targetProfile,
    error:
      targetProfileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      role,
      is_active
    `)
    .eq(
      "id",
      profileId
    )
    .maybeSingle();

  if (
    targetProfileError
  ) {
    throw new Error(
      `Не вдалося перевірити користувача: ${targetProfileError.message}`
    );
  }

  if (!targetProfile) {
    throw new Error(
      "Користувача не знайдено."
    );
  }

  if (
    targetProfile.role ===
      "admin" &&
    roleValue !==
      "admin" &&
    targetProfile.is_active
  ) {
    const adminCount =
      await getActiveAdminCount(
        supabase
      );

    if (
      adminCount <= 1
    ) {
      throw new Error(
        "Не можна забрати роль у останнього активного адміністратора."
      );
    }
  }

  if (
    employeeId !== null
  ) {
    const {
      data: employee,
      error:
        employeeError,
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
      role:
        roleValue,

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

  refreshUserPages();
}

export async function setUserActiveStatus(
  profileId: string,
  isActive: boolean
) {
  const normalizedProfileId =
    String(
      profileId ?? ""
    ).trim();

  validateProfileId(
    normalizedProfileId
  );

  const {
    supabase,
    currentUserId,
  } =
    await requireAdmin();

  if (
    normalizedProfileId ===
      currentUserId &&
    !isActive
  ) {
    throw new Error(
      "Не можна заблокувати власний акаунт."
    );
  }

  const {
    data: targetProfile,
    error:
      targetProfileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      role,
      is_active
    `)
    .eq(
      "id",
      normalizedProfileId
    )
    .maybeSingle();

  if (
    targetProfileError
  ) {
    throw new Error(
      `Не вдалося перевірити користувача: ${targetProfileError.message}`
    );
  }

  if (!targetProfile) {
    throw new Error(
      "Користувача не знайдено."
    );
  }

  if (
    !isActive &&
    targetProfile.role ===
      "admin" &&
    targetProfile.is_active
  ) {
    const adminCount =
      await getActiveAdminCount(
        supabase
      );

    if (
      adminCount <= 1
    ) {
      throw new Error(
        "Не можна заблокувати останнього активного адміністратора."
      );
    }
  }

  const {
    error: updateError,
  } = await supabase
    .from("profiles")
    .update({
      is_active:
        Boolean(
          isActive
        ),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      normalizedProfileId
    );

  if (updateError) {
    throw new Error(
      `Не вдалося змінити статус користувача: ${updateError.message}`
    );
  }

  refreshUserPages();

  return {
    id:
      normalizedProfileId,

    is_active:
      Boolean(
        isActive
      ),
  };
}

export async function deleteUserAccount(
  profileId: string
) {
  const normalizedProfileId =
    String(
      profileId ?? ""
    ).trim();

  validateProfileId(
    normalizedProfileId
  );

  const {
    supabase,
    currentUserId,
  } =
    await requireAdmin();

  if (
    normalizedProfileId ===
    currentUserId
  ) {
    throw new Error(
      "Не можна видалити власний акаунт."
    );
  }

  const {
    data: targetProfile,
    error:
      targetProfileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      role,
      is_active
    `)
    .eq(
      "id",
      normalizedProfileId
    )
    .maybeSingle();

  if (
    targetProfileError
  ) {
    throw new Error(
      `Не вдалося перевірити користувача: ${targetProfileError.message}`
    );
  }

  if (!targetProfile) {
    throw new Error(
      "Користувача не знайдено."
    );
  }

  if (
    targetProfile.role ===
      "admin" &&
    targetProfile.is_active
  ) {
    const adminCount =
      await getActiveAdminCount(
        supabase
      );

    if (
      adminCount <= 1
    ) {
      throw new Error(
        "Не можна видалити останнього активного адміністратора."
      );
    }
  }

  const adminClient =
    getAdminClient();

  const {
    error:
      deleteAuthError,
  } =
    await adminClient.auth.admin.deleteUser(
      normalizedProfileId
    );

  if (
    deleteAuthError
  ) {
    throw new Error(
      `Не вдалося видалити акаунт із Supabase Authentication: ${deleteAuthError.message}`
    );
  }

  const {
    error:
      deleteProfileError,
  } = await adminClient
    .from("profiles")
    .delete()
    .eq(
      "id",
      normalizedProfileId
    );

  if (
    deleteProfileError
  ) {
    throw new Error(
      `Акаунт видалено, але не вдалося очистити профіль: ${deleteProfileError.message}`
    );
  }

  refreshUserPages();

  return {
    id:
      normalizedProfileId,
  };
}
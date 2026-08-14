"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManageSettings,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

const availableCurrencies = [
  "UAH",
  "USD",
  "EUR",
] as const;

async function requireSettingsManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (
    !canManageSettings(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для зміни налаштувань."
    );
  }

  return profile;
}

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

export async function updateAppSettings(
  formData: FormData
) {
  await requireSettingsManagement();

  const supabase =
    await createClient();

  const companyName =
    getText(
      formData,
      "company_name"
    );

  const phone =
    getText(
      formData,
      "phone"
    );

  const email =
    getText(
      formData,
      "email"
    );

  const address =
    getText(
      formData,
      "address"
    );

  const currency =
    getText(
      formData,
      "currency"
    );

  if (!companyName) {
    throw new Error(
      "Вкажи назву компанії."
    );
  }

  if (
    email &&
    !email.includes("@")
  ) {
    throw new Error(
      "Вкажи правильну електронну адресу."
    );
  }

  if (
    !availableCurrencies.includes(
      currency as (typeof availableCurrencies)[number]
    )
  ) {
    throw new Error(
      "Обери правильну валюту."
    );
  }

  const { error } =
    await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,

          company_name:
            companyName,

          phone:
            phone || null,

          email:
            email || null,

          address:
            address || null,

          currency,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

  if (error) {
    throw new Error(
      `Не вдалося зберегти налаштування: ${error.message}`
    );
  }

  revalidatePath(
    "/settings"
  );

  revalidatePath("/");

  revalidatePath(
    "/reports"
  );

  revalidatePath(
    "/warehouse"
  );

  revalidatePath(
    "/equipment"
  );

  revalidatePath(
    "/purchases"
  );
}
import {
  cache,
} from "react";

import { createClient } from "@/lib/supabase/server";

import type {
  AppSettings,
} from "@/types/appSettings";

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  company_name: "ViCourt Service",
  phone: null,
  email: null,
  address: null,
  currency: "UAH",
  updated_at:
    "1970-01-01T00:00:00.000Z",
};

async function loadAppSettings(): Promise<AppSettings> {
  try {
    const supabase =
      await createClient();

    const {
      data,
      error,
    } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (
      error ||
      !data
    ) {
      return DEFAULT_SETTINGS;
    }

    return data as AppSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const getAppSettings =
  cache(loadAppSettings);

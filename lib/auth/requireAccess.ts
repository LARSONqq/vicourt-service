import { redirect } from "next/navigation";

import {
  canAccessSection,
  type AppSection,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  UserProfile,
} from "@/types/userProfile";

export async function requireSectionAccess(
  section: AppSection
): Promise<UserProfile> {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    !canAccessSection(
      profile.role,
      section
    )
  ) {
    redirect("/");
  }

  return profile;
}
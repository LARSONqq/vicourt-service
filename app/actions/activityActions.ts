"use server";

import {
  canViewActivityLog,
} from "@/lib/auth/permissions";
import {
  getObjectActivityLogs,
} from "@/services/activityLogService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  ActivityLogCursor,
} from "@/types/activityLog";

export async function loadMoreObjectActivity(
  objectId: number,
  cursor: ActivityLogCursor
) {
  const profile =
    await getCurrentUserProfile();

  if (
    !profile ||
    !canViewActivityLog(
      profile.role
    )
  ) {
    throw new Error(
      "Недостатньо прав для перегляду історії об’єкта."
    );
  }

  return getObjectActivityLogs(
    objectId,
    cursor
  );
}

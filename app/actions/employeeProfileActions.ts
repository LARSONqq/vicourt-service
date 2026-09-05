"use server";

import {
  canManageEmployees,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  prepareEmployeeActivityPage,
} from "@/lib/employeeActivityPrivacy";
import {
  getEmployeeActorHistoryPage,
  getEmployeeChangesPage,
  getEmployeeEquipmentPage,
  getEmployeeObjectsPage,
  getEmployeeTasksPage,
  getEmployeeWorkLogsPage,
} from "@/services/employeeDetailService";

async function requireEmployeeProfileAccess() {
  return requireSectionAccess(
    "employees"
  );
}

export async function loadEmployeeTasksPage(
  employeeId: number,
  page: number
) {
  await requireEmployeeProfileAccess();
  return getEmployeeTasksPage(
    employeeId,
    page
  );
}

export async function loadEmployeeWorkLogsPage(
  employeeId: number,
  page: number
) {
  await requireEmployeeProfileAccess();
  return getEmployeeWorkLogsPage(
    employeeId,
    page
  );
}

export async function loadEmployeeObjectsPage(
  employeeId: number,
  page: number
) {
  await requireEmployeeProfileAccess();
  return getEmployeeObjectsPage(
    employeeId,
    page
  );
}

export async function loadEmployeeEquipmentPage(
  employeeId: number,
  page: number
) {
  await requireEmployeeProfileAccess();
  return getEmployeeEquipmentPage(
    employeeId,
    page
  );
}

export async function loadEmployeeChangesPage(
  employeeId: number,
  page: number
) {
  const profile =
    await requireEmployeeProfileAccess();
  const activityPage =
    await getEmployeeChangesPage(
      employeeId,
      page
    );

  return prepareEmployeeActivityPage(
    activityPage,
    canManageEmployees(
      profile.role
    )
  );
}

export async function loadEmployeeActorHistoryPage(
  employeeId: number,
  page: number
) {
  const profile =
    await requireEmployeeProfileAccess();
  const activityPage =
    await getEmployeeActorHistoryPage(
      employeeId,
      page
    );

  return prepareEmployeeActivityPage(
    activityPage,
    canManageEmployees(
      profile.role
    )
  );
}

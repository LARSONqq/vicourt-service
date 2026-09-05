import {
  notFound,
} from "next/navigation";

import EmployeePassport from "@/components/employees/EmployeePassport";
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
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  getEmployeeActorHistoryPage,
  getEmployeeActors,
  getEmployeeChangesPage,
  getEmployeeEquipmentPage,
  getEmployeeObjectsPage,
  getEmployeeProfile,
  getEmployeeProfileKpis,
  getEmployeeRecentTasksPreview,
  getEmployeeSupervisionPreview,
  getEmployeeTasksPage,
  getEmployeeWorkLogsPage,
} from "@/services/employeeDetailService";

import type {
  EmployeeDetails,
} from "@/types/employee";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeePage({
  params,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "employees"
    );
  const { id } = await params;
  const employeeId = Number(id);

  if (
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    notFound();
  }

  const isAdmin =
    canManageEmployees(
      currentProfile.role
    );
  const [
    employee,
    kpis,
    taskPreview,
    tasksPage,
    workLogsPage,
    objectsPage,
    equipmentPage,
    supervisionPreview,
    changesPage,
    actorHistoryPage,
    linkedActors,
  ] = await Promise.all([
    getEmployeeProfile(employeeId),
    getEmployeeProfileKpis(
      employeeId
    ),
    getEmployeeRecentTasksPreview(
      employeeId
    ),
    getEmployeeTasksPage(employeeId),
    getEmployeeWorkLogsPage(
      employeeId
    ),
    getEmployeeObjectsPage(employeeId),
    getEmployeeEquipmentPage(
      employeeId
    ),
    getEmployeeSupervisionPreview(
      employeeId
    ),
    getEmployeeChangesPage(employeeId),
    getEmployeeActorHistoryPage(
      employeeId
    ),
    getEmployeeActors(employeeId),
  ]);

  if (!employee || !kpis) {
    notFound();
  }

  const {
    hourly_rate: hourlyRate,
    ...employeeDetails
  } = employee;
  const safeChangesPage =
    prepareEmployeeActivityPage(
      changesPage,
      isAdmin
    );
  const safeActorHistoryPage =
    prepareEmployeeActivityPage(
      actorHistoryPage,
      isAdmin
    );

  return (
    <EmployeePassport
      employee={
        employeeDetails as EmployeeDetails
      }
      hourlyRate={
        isAdmin
          ? Number(hourlyRate) || 0
          : null
      }
      isAdmin={isAdmin}
      today={getKyivDateValue()}
      kpis={kpis}
      taskPreview={taskPreview}
      workLogPreview={
        workLogsPage.items.slice(
          0,
          3
        )
      }
      supervisionPreview={
        supervisionPreview
      }
      initialTasksPage={tasksPage}
      initialWorkLogsPage={
        workLogsPage
      }
      initialObjectsPage={
        objectsPage
      }
      initialEquipmentPage={
        equipmentPage
      }
      initialChangesPage={
        safeChangesPage
      }
      initialActorHistoryPage={
        safeActorHistoryPage
      }
      linkedActors={linkedActors}
    />
  );
}

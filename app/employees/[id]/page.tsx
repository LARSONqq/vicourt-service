import {
  Suspense,
} from "react";
import {
  notFound,
} from "next/navigation";

import {
  EmployeeEquipmentTab,
  EmployeeHistoryTab,
  EmployeeObjectsTab,
  EmployeeOverview,
  EmployeeTasksTab,
  EmployeeWorkLogsTab,
} from "@/components/employees/EmployeePassport";
import {
  EMPLOYEE_TAB_IDS,
  type EmployeeTabId,
} from "@/components/employees/EmployeePassportNavigation";
import EmployeePassportShell from "@/components/employees/EmployeePassportShell";
import EmployeeTabErrorBoundary from "@/components/employees/EmployeeTabErrorBoundary";
import {
  canManageEmployees,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  hideEmployeeRatesFromActivityLog,
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
  getEmployeeRecentActivityPreview,
  getEmployeeRecentTasksPreview,
  getEmployeeRecentWorkLogsPreview,
  getEmployeeSupervisionPreview,
  getEmployeeTasksPage,
  getEmployeeWorkLogsPage,
} from "@/services/employeeDetailService";

import type {
  EmployeeDetails,
} from "@/types/employee";

type SearchParams = {
  tab?: string | string[];
  page?: string | string[];
  changesPage?: string | string[];
  actionsPage?: string | string[];
};

type Props = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

type TabContentProps = {
  employee: EmployeeDetails;
  hourlyRate: number | null;
  isAdmin: boolean;
  activeTab: EmployeeTabId;
  page: number;
  changesPage: number;
  actionsPage: number;
};

function getSingleSearchValue(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function resolveEmployeeTab(
  value: string | undefined
): EmployeeTabId {
  return value &&
    EMPLOYEE_TAB_IDS.includes(
      value as EmployeeTabId
    )
    ? (value as EmployeeTabId)
    : "overview";
}

function resolvePage(
  value: string | undefined
) {
  if (!value || !/^\d+$/u.test(value)) {
    return 1;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

function EmployeeTabLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-w-0 animate-pulse space-y-4"
    >
      <span className="sr-only">
        Завантаження розділу…
      </span>
      <div className="h-28 rounded-xl border bg-gray-50" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl border bg-gray-50" />
        <div className="h-36 rounded-xl border bg-gray-50" />
      </div>
    </div>
  );
}

async function EmployeeTabContent({
  employee,
  hourlyRate,
  isAdmin,
  activeTab,
  page,
  changesPage,
  actionsPage,
}: TabContentProps) {
  const employeeId = employee.id;
  const today = getKyivDateValue();

  if (activeTab === "overview") {
    const [
      kpis,
      taskPreview,
      workLogPreview,
      supervisionPreview,
      recentActivity,
    ] = await Promise.all([
      getEmployeeProfileKpis(
        employeeId
      ),
      getEmployeeRecentTasksPreview(
        employeeId
      ),
      getEmployeeRecentWorkLogsPreview(
        employeeId
      ),
      getEmployeeSupervisionPreview(
        employeeId
      ),
      getEmployeeRecentActivityPreview(
        employeeId
      ),
    ]);

    if (!kpis) {
      throw new Error(
        "Не вдалося завантажити показники працівника."
      );
    }

    return (
      <EmployeeOverview
        employee={employee}
        hourlyRate={hourlyRate}
        isAdmin={isAdmin}
        today={today}
        kpis={kpis}
        taskPreview={taskPreview}
        workLogPreview={
          workLogPreview
        }
        supervisionPreview={
          supervisionPreview
        }
        recentActivity={
          isAdmin
            ? recentActivity
            : recentActivity.map(
                hideEmployeeRatesFromActivityLog
              )
        }
      />
    );
  }

  if (activeTab === "tasks") {
    const tasksPage =
      await getEmployeeTasksPage(
        employeeId,
        page
      );

    return (
      <EmployeeTasksTab
        employeeId={employeeId}
        page={tasksPage}
      />
    );
  }

  if (activeTab === "work") {
    const workLogsPage =
      await getEmployeeWorkLogsPage(
        employeeId,
        page
      );

    return (
      <EmployeeWorkLogsTab
        employeeId={employeeId}
        page={workLogsPage}
      />
    );
  }

  if (activeTab === "objects") {
    const objectsPage =
      await getEmployeeObjectsPage(
        employeeId,
        page
      );

    return (
      <EmployeeObjectsTab
        employeeId={employeeId}
        page={objectsPage}
        today={today}
      />
    );
  }

  if (activeTab === "equipment") {
    const equipmentPage =
      await getEmployeeEquipmentPage(
        employeeId,
        page
      );

    return (
      <EmployeeEquipmentTab
        employeeId={employeeId}
        page={equipmentPage}
        today={today}
      />
    );
  }

  const linkedActors =
    await getEmployeeActors(employeeId);
  const [changes, actions] =
    await Promise.all([
      getEmployeeChangesPage(
        employeeId,
        changesPage
      ),
      getEmployeeActorHistoryPage(
        employeeId,
        actionsPage,
        linkedActors
      ),
    ]);

  return (
    <EmployeeHistoryTab
      employeeId={employeeId}
      changesPage={
        prepareEmployeeActivityPage(
          changes,
          isAdmin
        )
      }
      actorHistoryPage={
        prepareEmployeeActivityPage(
          actions,
          isAdmin
        )
      }
      linkedActors={linkedActors}
    />
  );
}

export default async function EmployeePage({
  params,
  searchParams,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "employees"
    );
  const [{ id }, query] =
    await Promise.all([
      params,
      searchParams,
    ]);
  const employeeId = Number(id);

  if (
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    notFound();
  }

  const isAdmin = canManageEmployees(
    currentProfile.role
  );
  const activeTab = resolveEmployeeTab(
    getSingleSearchValue(query.tab)
  );
  const page = resolvePage(
    getSingleSearchValue(query.page)
  );
  const changesPage = resolvePage(
    getSingleSearchValue(
      query.changesPage
    )
  );
  const actionsPage = resolvePage(
    getSingleSearchValue(
      query.actionsPage
    )
  );
  const employee =
    await getEmployeeProfile(employeeId);

  if (!employee) {
    notFound();
  }

  const {
    hourly_rate: rawHourlyRate,
    ...employeeDetails
  } = employee;
  const safeEmployee =
    employeeDetails as EmployeeDetails;
  const hourlyRate = isAdmin
    ? Number(rawHourlyRate) || 0
    : null;

  return (
    <EmployeePassportShell
      employee={safeEmployee}
      hourlyRate={hourlyRate}
      isAdmin={isAdmin}
      activeTab={activeTab}
    >
      <EmployeeTabErrorBoundary
        key={`${activeTab}:${page}:${changesPage}:${actionsPage}`}
      >
        <Suspense
          fallback={
            <EmployeeTabLoading />
          }
        >
          <EmployeeTabContent
            employee={safeEmployee}
            hourlyRate={hourlyRate}
            isAdmin={isAdmin}
            activeTab={activeTab}
            page={page}
            changesPage={
              changesPage
            }
            actionsPage={actionsPage}
          />
        </Suspense>
      </EmployeeTabErrorBoundary>
    </EmployeePassportShell>
  );
}

import {
  Suspense,
} from "react";
import {
  notFound,
} from "next/navigation";

import EquipmentActivitySection from "@/components/equipment/EquipmentActivitySection";
import EquipmentOverview from "@/components/equipment/EquipmentOverview";
import EquipmentPassportHeader from "@/components/equipment/EquipmentPassportHeader";
import EquipmentPassportSections, {
  EQUIPMENT_TAB_IDS,
  type EquipmentTabId,
} from "@/components/equipment/EquipmentPassportSections";
import EquipmentPassportServiceSection from "@/components/equipment/EquipmentPassportServiceSection";
import EquipmentTabErrorBoundary from "@/components/equipment/EquipmentTabErrorBoundary";
import EquipmentTasksSection from "@/components/equipment/EquipmentTasksSection";
import EquipmentUsagePanel from "@/components/equipment/EquipmentUsagePanel";
import {
  canManageEquipment,
  canViewActivityLog,
  canViewReports,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
} from "@/lib/equipmentMaintenance";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  getEmployees,
} from "@/services/employeeService";
import {
  getEquipmentActivityHistoryPage,
  getEquipmentMaintenanceOverview,
  getEquipmentOverviewPreview,
  getEquipmentProfile,
  getEquipmentServiceCostKpis,
  getEquipmentServiceHistoryPage,
  getEquipmentTasksPage,
  getEquipmentUsageHistoryPage,
} from "@/services/equipmentDetailService";
import {
  getAppSettings,
} from "@/services/settingsService";

import type {
  Equipment,
} from "@/types/equipment";

type SearchParams = {
  tab?: string | string[];
};

type Props = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

type TabContentProps = {
  equipment: Equipment;
  activeTab: EquipmentTabId;
  canManage: boolean;
  canViewHistory: boolean;
  canViewServiceCost: boolean;
};

function getSingleSearchValue(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function resolveEquipmentTab(
  value: string | undefined,
  canViewHistory: boolean
): EquipmentTabId {
  if (
    !value ||
    !EQUIPMENT_TAB_IDS.includes(
      value as EquipmentTabId
    )
  ) {
    return "overview";
  }

  if (
    value === "history" &&
    !canViewHistory
  ) {
    return "overview";
  }

  return value as EquipmentTabId;
}

function parseEquipmentId(
  value: string
) {
  if (!/^\d+$/u.test(value)) {
    return null;
  }

  const equipmentId = Number(value);

  return Number.isSafeInteger(
    equipmentId
  ) && equipmentId > 0
    ? equipmentId
    : null;
}

function EquipmentTabLoading() {
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

async function EquipmentTabContent({
  equipment,
  activeTab,
  canManage,
  canViewHistory,
  canViewServiceCost,
}: TabContentProps) {
  const equipmentId =
    equipment.id;
  const today =
    getKyivDateValue();

  if (activeTab === "overview") {
    const [overview, settings] =
      await Promise.all([
        getEquipmentOverviewPreview(
          equipmentId
        ),
        getAppSettings(),
      ]);

    if (!overview) {
      throw new Error(
        "Не вдалося завантажити показники техніки."
      );
    }

    return (
      <EquipmentOverview
        overview={overview}
        currency={
          settings.currency
        }
      />
    );
  }

  if (activeTab === "service") {
    const [
      serviceHistory,
      serviceCosts,
      settings,
    ] = await Promise.all([
      getEquipmentServiceHistoryPage(
        equipmentId
      ),
      canViewServiceCost
        ? getEquipmentServiceCostKpis(
            equipmentId
          )
        : Promise.resolve(null),
      getAppSettings(),
    ]);

    return (
      <EquipmentPassportServiceSection
        equipment={equipment}
        records={
          serviceHistory.items
        }
        currency={
          settings.currency
        }
        today={today}
        canManage={canManage}
        showCost={
          serviceHistory.includesCost
        }
        totalCost={
          serviceCosts?.total
        }
      />
    );
  }

  if (activeTab === "usage") {
    const usageHistory =
      await getEquipmentUsageHistoryPage(
        equipmentId
      );

    return (
      <EquipmentUsagePanel
        equipment={[equipment]}
        logs={usageHistory.items}
        canManage={canManage}
        today={today}
        singleEquipment
      />
    );
  }

  if (activeTab === "tasks") {
    const tasks =
      await getEquipmentTasksPage(
        equipmentId
      );

    return (
      <EquipmentTasksSection
        page={tasks}
        today={today}
      />
    );
  }

  if (
    activeTab === "history" &&
    canViewHistory
  ) {
    const activity =
      await getEquipmentActivityHistoryPage(
        equipmentId
      );

    return (
      <EquipmentActivitySection
        page={activity}
      />
    );
  }

  return null;
}

export default async function EquipmentPassportPage({
  params,
  searchParams,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "equipment"
    );
  const [{ id }, query] =
    await Promise.all([
      params,
      searchParams,
    ]);
  const equipmentId =
    parseEquipmentId(id);

  if (equipmentId === null) {
    notFound();
  }

  const canManage =
    canManageEquipment(
      currentProfile.role
    );
  const canViewHistory =
    canViewActivityLog(
      currentProfile.role
    );
  const canViewServiceCost =
    canViewReports(
      currentProfile.role
    );
  const activeTab =
    resolveEquipmentTab(
      getSingleSearchValue(
        query.tab
      ),
      canViewHistory
    );
  const equipment =
    await getEquipmentProfile(
      equipmentId
    );

  if (!equipment) {
    notFound();
  }

  const [maintenance, employees] =
    await Promise.all([
      getEquipmentMaintenanceOverview(
        equipmentId,
        equipment
      ),
      canManage
        ? getEmployees()
        : Promise.resolve([]),
    ]);

  if (!maintenance) {
    notFound();
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <EquipmentPassportHeader
        equipment={equipment}
        employees={employees}
        canManage={canManage}
        maintenanceKind={getEquipmentMaintenanceOverallKind(
          maintenance.evaluation
        )}
        maintenanceLabel={getEquipmentMaintenanceOverallLabel(
          maintenance.evaluation
        )}
      />

      <EquipmentPassportSections
        equipmentId={equipmentId}
        activeTab={activeTab}
        canViewHistory={
          canViewHistory
        }
      >
        <EquipmentTabErrorBoundary
          key={activeTab}
        >
          <Suspense
            fallback={
              <EquipmentTabLoading />
            }
          >
            <EquipmentTabContent
              equipment={equipment}
              activeTab={activeTab}
              canManage={canManage}
              canViewHistory={
                canViewHistory
              }
              canViewServiceCost={
                canViewServiceCost
              }
            />
          </Suspense>
        </EquipmentTabErrorBoundary>
      </EquipmentPassportSections>
    </div>
  );
}

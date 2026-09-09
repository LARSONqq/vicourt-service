import {
  Suspense,
} from "react";
import {
  notFound,
  redirect,
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
import EquipmentTabPagination from "@/components/equipment/EquipmentTabPagination";
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
  page?: string | string[];
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
  page: number;
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

function redirectEmptyPage(
  equipmentId: number,
  tab: Exclude<
    EquipmentTabId,
    "overview"
  >,
  requestedPage: number,
  itemsCount: number,
  total: number,
  pageSize: number
) {
  if (
    requestedPage <= 1 ||
    itemsCount > 0
  ) {
    return;
  }

  const lastPage = Math.max(
    1,
    Math.ceil(total / pageSize)
  );
  const params =
    new URLSearchParams({ tab });

  if (lastPage > 1) {
    params.set(
      "page",
      String(lastPage)
    );
  }

  redirect(
    `/equipment/${equipmentId}?${params.toString()}`
  );
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
  page,
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
        equipmentId,
        page
      ),
      canViewServiceCost
        ? getEquipmentServiceCostKpis(
            equipmentId
          )
        : Promise.resolve(null),
      getAppSettings(),
    ]);

    redirectEmptyPage(
      equipmentId,
      "service",
      page,
      serviceHistory.items.length,
      serviceHistory.total,
      serviceHistory.pageSize
    );

    return (
      <>
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
        <EquipmentTabPagination
          equipmentId={equipmentId}
          tab="service"
          page={serviceHistory.page}
          pageSize={
            serviceHistory.pageSize
          }
          total={serviceHistory.total}
          hasPreviousPage={
            serviceHistory.hasPreviousPage
          }
          hasNextPage={
            serviceHistory.hasNextPage
          }
        />
      </>
    );
  }

  if (activeTab === "usage") {
    const usageHistory =
      await getEquipmentUsageHistoryPage(
        equipmentId,
        page
      );

    redirectEmptyPage(
      equipmentId,
      "usage",
      page,
      usageHistory.items.length,
      usageHistory.total,
      usageHistory.pageSize
    );

    return (
      <>
        <EquipmentUsagePanel
          equipment={[equipment]}
          logs={usageHistory.items}
          canManage={canManage}
          today={today}
          singleEquipment
        />
        <EquipmentTabPagination
          equipmentId={equipmentId}
          tab="usage"
          page={usageHistory.page}
          pageSize={
            usageHistory.pageSize
          }
          total={usageHistory.total}
          hasPreviousPage={
            usageHistory.hasPreviousPage
          }
          hasNextPage={
            usageHistory.hasNextPage
          }
        />
      </>
    );
  }

  if (activeTab === "tasks") {
    const tasks =
      await getEquipmentTasksPage(
        equipmentId,
        page
      );

    redirectEmptyPage(
      equipmentId,
      "tasks",
      page,
      tasks.items.length,
      tasks.total,
      tasks.pageSize
    );

    return (
      <>
        <EquipmentTasksSection
          page={tasks}
          today={today}
        />
        <EquipmentTabPagination
          equipmentId={equipmentId}
          tab="tasks"
          page={tasks.page}
          pageSize={tasks.pageSize}
          total={tasks.total}
          hasPreviousPage={
            tasks.hasPreviousPage
          }
          hasNextPage={
            tasks.hasNextPage
          }
        />
      </>
    );
  }

  if (
    activeTab === "history" &&
    canViewHistory
  ) {
    const activity =
      await getEquipmentActivityHistoryPage(
        equipmentId,
        page
      );

    redirectEmptyPage(
      equipmentId,
      "history",
      page,
      activity.items.length,
      activity.total,
      activity.pageSize
    );

    return (
      <>
        <EquipmentActivitySection
          page={activity}
        />
        <EquipmentTabPagination
          equipmentId={equipmentId}
          tab="history"
          page={activity.page}
          pageSize={activity.pageSize}
          total={activity.total}
          hasPreviousPage={
            activity.hasPreviousPage
          }
          hasNextPage={
            activity.hasNextPage
          }
        />
      </>
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
  const page = resolvePage(
    getSingleSearchValue(
      query.page
    )
  );
  const equipment =
    await getEquipmentProfile(
      equipmentId
    );

  if (!equipment) {
    notFound();
  }

  const maintenance =
    await getEquipmentMaintenanceOverview(
      equipmentId,
      equipment
    );

  if (!maintenance) {
    notFound();
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <EquipmentPassportHeader
        equipment={equipment}
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
          key={`${activeTab}:${page}`}
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
              page={page}
            />
          </Suspense>
        </EquipmentTabErrorBoundary>
      </EquipmentPassportSections>
    </div>
  );
}

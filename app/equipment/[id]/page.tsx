import {
  notFound,
} from "next/navigation";

import EquipmentActivitySection from "@/components/equipment/EquipmentActivitySection";
import EquipmentOverview from "@/components/equipment/EquipmentOverview";
import EquipmentPassportHeader from "@/components/equipment/EquipmentPassportHeader";
import EquipmentPassportSections from "@/components/equipment/EquipmentPassportSections";
import EquipmentPassportServiceSection from "@/components/equipment/EquipmentPassportServiceSection";
import EquipmentTasksSection from "@/components/equipment/EquipmentTasksSection";
import EquipmentUsagePanel from "@/components/equipment/EquipmentUsagePanel";
import {
  canManageEquipment,
  canViewActivityLog,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
} from "@/lib/equipmentMaintenance";
import {
  getEmployees,
} from "@/services/employeeService";
import {
  getEquipmentOverviewPreview,
  getEquipmentProfile,
  getEquipmentActivityHistoryPage,
  getEquipmentServiceHistoryPage,
  getEquipmentTasksPage,
  getEquipmentUsageHistoryPage,
} from "@/services/equipmentDetailService";
import {
  getAppSettings,
} from "@/services/settingsService";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

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

export default async function EquipmentPassportPage({
  params,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "equipment"
    );
  const { id } = await params;
  const equipmentId =
    parseEquipmentId(id);

  if (equipmentId === null) {
    notFound();
  }

  const equipment =
    await getEquipmentProfile(
      equipmentId
    );

  if (!equipment) {
    notFound();
  }

  const canManage =
    canManageEquipment(
      currentProfile.role
    );
  const canViewActivity =
    canViewActivityLog(
      currentProfile.role
    );
  const [
    overview,
    employees,
    serviceHistory,
    usageHistory,
    tasks,
    activity,
    settings,
  ] =
    await Promise.all([
      getEquipmentOverviewPreview(
        equipmentId
      ),
      canManage
        ? getEmployees()
        : Promise.resolve([]),
      getEquipmentServiceHistoryPage(
        equipmentId
      ),
      getEquipmentUsageHistoryPage(
        equipmentId
      ),
      getEquipmentTasksPage(
        equipmentId
      ),
      canViewActivity
        ? getEquipmentActivityHistoryPage(
            equipmentId
          )
        : Promise.resolve(null),
      getAppSettings(),
    ]);

  if (!overview) {
    notFound();
  }

  const maintenanceKind =
    getEquipmentMaintenanceOverallKind(
      overview.maintenance.evaluation
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <EquipmentPassportHeader
        equipment={equipment}
        employees={employees}
        canManage={canManage}
        maintenanceKind={maintenanceKind}
        maintenanceLabel={getEquipmentMaintenanceOverallLabel(
          overview.maintenance.evaluation
        )}
      />

      <EquipmentPassportSections
        overview={
          <EquipmentOverview
            overview={overview}
            currency={
              settings.currency
            }
          />
        }
        service={
          <EquipmentPassportServiceSection
            equipment={equipment}
            records={
              serviceHistory.items
            }
            currency={
              settings.currency
            }
            today={
              overview.maintenance.today
            }
            canManage={canManage}
            showCost={
              serviceHistory.includesCost
            }
            totalCost={
              overview.kpis
                .serviceCosts?.total
            }
          />
        }
        usage={
          <EquipmentUsagePanel
            equipment={[
              equipment,
            ]}
            logs={
              usageHistory.items
            }
            canManage={canManage}
            today={
              overview.maintenance.today
            }
            singleEquipment
          />
        }
        tasks={
          <EquipmentTasksSection
            page={tasks}
            today={
              overview.maintenance.today
            }
          />
        }
        activity={
          activity ? (
            <EquipmentActivitySection
              page={activity}
            />
          ) : undefined
        }
      />
    </div>
  );
}

import {
  notFound,
} from "next/navigation";

import EquipmentOverview from "@/components/equipment/EquipmentOverview";
import EquipmentPassportHeader from "@/components/equipment/EquipmentPassportHeader";
import {
  canManageEquipment,
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
} from "@/services/equipmentDetailService";

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
  const [overview, employees] =
    await Promise.all([
      getEquipmentOverviewPreview(
        equipmentId
      ),
      canManage
        ? getEmployees()
        : Promise.resolve([]),
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

      <EquipmentOverview
        overview={overview}
      />
    </div>
  );
}

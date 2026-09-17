import {
  notFound,
} from "next/navigation";

import WarehouseItemPassport from "@/components/warehouse/WarehouseItemPassport";
import {
  canManagePurchases,
  canManageWarehouse,
  canViewWarehouseLedger,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getWarehouseItemPurchasePreview,
} from "@/services/purchaseService";
import {
  getAppSettings,
} from "@/services/settingsService";
import {
  getWarehouseItem,
  getWarehouseItemObjectUsage,
  getWarehouseItemRecentMovements,
} from "@/services/warehouseService";

import type {
  WarehouseItemMovementPreview,
} from "@/types/warehouseMovement";
import type {
  WarehouseItemPurchasePreview,
} from "@/types/warehousePurchase";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function parseWarehouseItemId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const itemId = Number(value);

  return Number.isSafeInteger(itemId) &&
    itemId > 0
    ? itemId
    : null;
}

function getSettledValue<T>(
  result: PromiseSettledResult<T[]>
): T[] | null {
  return result.status === "fulfilled"
    ? result.value
    : null;
}

export default async function WarehouseItemPage({
  params,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "warehouse"
    );
  const { id } = await params;
  const itemId = parseWarehouseItemId(id);

  if (itemId === null) {
    notFound();
  }

  const [item, settings] =
    await Promise.all([
      getWarehouseItem(itemId),
      getAppSettings(),
    ]);

  if (!item) {
    notFound();
  }

  const canViewManagementHistory =
    canViewWarehouseLedger(
      currentProfile.role
    ) &&
    canManagePurchases(
      currentProfile.role
    );

  let movements:
    | WarehouseItemMovementPreview[]
    | null = null;
  let purchases:
    | WarehouseItemPurchasePreview[]
    | null = null;
  let objectUsage:
    | WarehouseItemMovementPreview[]
    | null = null;

  if (canViewManagementHistory) {
    const [
      movementResult,
      purchaseResult,
      objectUsageResult,
    ] = await Promise.allSettled([
      getWarehouseItemRecentMovements(
        itemId
      ),
      getWarehouseItemPurchasePreview(
        itemId
      ),
      getWarehouseItemObjectUsage(
        itemId
      ),
    ]);

    movements = getSettledValue(
      movementResult
    );
    purchases = getSettledValue(
      purchaseResult
    );
    objectUsage = getSettledValue(
      objectUsageResult
    );
  }

  return (
    <WarehouseItemPassport
      item={item}
      currency={settings.currency}
      canAdjustStock={canManageWarehouse(currentProfile.role)}
      canViewManagementHistory={
        canViewManagementHistory
      }
      movements={movements}
      purchases={purchases}
      objectUsage={objectUsage}
    />
  );
}

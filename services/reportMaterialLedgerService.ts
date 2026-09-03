import "server-only";

import {
  warehouseMovementLabels,
} from "@/constants/warehouseLedger";
import {
  fromMoneyInCents,
  toMoneyInCents,
} from "@/lib/objectPayments";
import { createClient } from "@/lib/supabase/server";

import type {
  ReportMaterialAccountingMethod,
  ReportMaterialPeriodMode,
  ReportMovementType,
  ReportWarehouseMovement,
} from "@/types/report";
import type {
  WarehouseMovementCode,
  WarehouseMovementSourceType,
} from "@/types/warehouseMovement";

const OBJECT_COST_MOVEMENT_CODES = [
  "issue_to_object",
  "return_from_object",
  "direct_to_object",
  "direct_object_reversal",
] as const satisfies readonly WarehouseMovementCode[];

const OPENING_MOVEMENT_CODES = [
  "opening_balance",
  "object_opening_balance",
] as const satisfies readonly WarehouseMovementCode[];

const REPORT_QUERY_PAGE_SIZE = 1000;

const sourceLabels: Record<
  WarehouseMovementSourceType,
  string
> = {
  legacy: "Legacy-операція",
  purchase: "Закупівля",
  object_material: "Матеріали об’єкта",
  manual_adjustment: "Корекція залишку",
  item_creation: "Створення позиції",
  ledger_cutover: "Початковий знімок",
};

type MaterialLedgerCutoverRow = {
  ledger_version: number;
  boundary_movement_id: number;
  cutover_at: string;
};

type MaterialLedgerAggregateRow = {
  object_id: number;
  period_exact_cost: number | string;
  lifetime_exact_cost: number | string;
  period_movement_count: number | string;
};

type MaterialLedgerMovementRow = {
  id: number;
  item_id: number | null;
  object_id: number | null;
  movement_type: ReportMovementType;
  movement_code: WarehouseMovementCode;
  ledger_version: number;
  quantity: number | string;
  note: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  unit_price: number | string;
  total_cost: number | string;
  item_name_snapshot: string;
  unit_snapshot: string;
  object_name_snapshot: string | null;
  source_type: WarehouseMovementSourceType;
  source_id: number | null;
  created_at: string;
};

export type MaterialLedgerCutover = {
  ledgerVersion: 3;
  boundaryMovementId: number;
  cutoverAt: string;
};

export type MaterialLedgerCost = {
  objectId: number;
  periodExactCost: number;
  lifetimeExactCost: number;
  periodMovementCount: number;
};

export type MaterialLedgerReport = {
  cutover: MaterialLedgerCutover | null;
  periodMode: ReportMaterialPeriodMode;
  costs: MaterialLedgerCost[];
  movements: ReportWarehouseMovement[];
};

type MaterialLedgerReportInput = {
  timestampFrom: string;
  timestampToExclusive: string;
  objectId: number | null;
  movementType: ReportMovementType | null;
};

function toFiniteNumber(
  value: number | string
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      "Ledger повернув некоректне числове значення."
    );
  }

  return parsed;
}

function toMoney(value: number | string) {
  return fromMoneyInCents(
    toMoneyInCents(
      toFiniteNumber(value)
    )
  );
}

function includesMovementCode<
  T extends WarehouseMovementCode,
>(
  values: readonly T[],
  value: WarehouseMovementCode
): value is T {
  return values.some(
    (candidate) =>
      candidate === value
  );
}

export function getReportMaterialPeriodMode(
  timestampFrom: string,
  timestampToExclusive: string,
  cutover: MaterialLedgerCutover | null
): ReportMaterialPeriodMode {
  if (!cutover) {
    return "legacy";
  }

  const periodFrom =
    Date.parse(timestampFrom);
  const periodTo =
    Date.parse(timestampToExclusive);
  const cutoverAt =
    Date.parse(cutover.cutoverAt);

  if (
    !Number.isFinite(periodFrom) ||
    !Number.isFinite(periodTo) ||
    !Number.isFinite(cutoverAt)
  ) {
    throw new Error(
      "Не вдалося визначити межі ledger-звіту."
    );
  }

  if (periodFrom >= cutoverAt) {
    return "exact";
  }

  if (periodTo <= cutoverAt) {
    return "legacy";
  }

  return "mixed";
}

function getAccountingMethod(
  movement: MaterialLedgerMovementRow,
  cutover: MaterialLedgerCutover | null
): ReportMaterialAccountingMethod {
  if (
    includesMovementCode(
      OPENING_MOVEMENT_CODES,
      movement.movement_code
    )
  ) {
    return "opening_snapshot";
  }

  if (
    cutover &&
    Number(movement.ledger_version) ===
      cutover.ledgerVersion &&
    Number(movement.id) >
      cutover.boundaryMovementId
  ) {
    return "exact_ledger";
  }

  return "legacy_approximation";
}

function getObjectCostImpact(
  movement: MaterialLedgerMovementRow,
  method: ReportMaterialAccountingMethod
) {
  if (
    method !== "exact_ledger" ||
    !includesMovementCode(
      OBJECT_COST_MOVEMENT_CODES,
      movement.movement_code
    )
  ) {
    return null;
  }

  const total = toMoney(
    movement.total_cost
  );

  return movement.movement_code ===
      "return_from_object" ||
    movement.movement_code ===
      "direct_object_reversal"
    ? -total
    : total;
}

export async function getMaterialLedgerCutover(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >
) {
  const { data, error } =
    await supabase
      .rpc(
        "get_report_material_ledger_cutover"
      )
      .overrideTypes<
        MaterialLedgerCutoverRow[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити межу точного обліку матеріалів: ${error.message}`
    );
  }

  const row = Array.isArray(data)
    ? data[0]
    : null;

  if (!row) {
    return null;
  }

  const boundaryMovementId =
    Number(row.boundary_movement_id);

  if (
    Number(row.ledger_version) !== 3 ||
    !Number.isSafeInteger(
      boundaryMovementId
    ) ||
    boundaryMovementId < 0 ||
    Number.isNaN(
      Date.parse(row.cutover_at)
    )
  ) {
    throw new Error(
      "Межа Warehouse 3.0 має некоректний формат."
    );
  }

  return {
    ledgerVersion: 3,
    boundaryMovementId,
    cutoverAt: row.cutover_at,
  } satisfies MaterialLedgerCutover;
}

async function getMaterialLedgerCosts(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  input: MaterialLedgerReportInput
) {
  const { data, error } =
    await supabase
      .rpc(
        "get_report_object_material_costs",
        {
          p_period_from:
            input.timestampFrom,
          p_period_to:
            input.timestampToExclusive,
          p_object_id:
            input.objectId,
        }
      )
      .overrideTypes<
        MaterialLedgerAggregateRow[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося розрахувати точну вартість матеріалів: ${error.message}`
    );
  }

  return (Array.isArray(data)
    ? data
    : []
  ).map((row) => {
    const objectId = Number(
      row.object_id
    );
    const periodMovementCount =
      Number(
        row.period_movement_count
      );

    if (
      !Number.isSafeInteger(objectId) ||
      objectId <= 0 ||
      !Number.isSafeInteger(
        periodMovementCount
      ) ||
      periodMovementCount < 0
    ) {
      throw new Error(
        "Ledger повернув некоректний підсумок по об’єкту."
      );
    }

    return {
      objectId,
      periodExactCost: toMoney(
        row.period_exact_cost
      ),
      lifetimeExactCost: toMoney(
        row.lifetime_exact_cost
      ),
      periodMovementCount,
    };
  });
}

async function getMaterialLedgerMovements(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  input: MaterialLedgerReportInput,
  cutover: MaterialLedgerCutover | null
) {
  const rows:
    MaterialLedgerMovementRow[] = [];

  for (
    let from = 0;
    ;
    from += REPORT_QUERY_PAGE_SIZE
  ) {
    let query = supabase
      .from("warehouse_movements")
      .select(`
        id,
        item_id,
        object_id,
        movement_type,
        movement_code,
        ledger_version,
        quantity,
        note,
        performed_by,
        performed_by_name,
        unit_price,
        total_cost,
        item_name_snapshot,
        unit_snapshot,
        object_name_snapshot,
        source_type,
        source_id,
        created_at
      `)
      .gte(
        "created_at",
        input.timestampFrom
      )
      .lt(
        "created_at",
        input.timestampToExclusive
      );

    if (input.objectId) {
      query = query.eq(
        "object_id",
        input.objectId
      );
    }

    if (input.movementType) {
      query = query.eq(
        "movement_type",
        input.movementType
      );
    }

    const { data, error } =
      await query
        .order("created_at", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(
          from,
          from +
            REPORT_QUERY_PAGE_SIZE -
            1
        )
        .overrideTypes<
          MaterialLedgerMovementRow[]
        >();

    if (error) {
      throw new Error(
        `Не вдалося завантажити рух матеріалів за період: ${error.message}`
      );
    }

    const pageRows = Array.isArray(data)
      ? data
      : [];
    rows.push(...pageRows);

    if (
      pageRows.length <
      REPORT_QUERY_PAGE_SIZE
    ) {
      break;
    }
  }

  return rows.map((movement) => {
    const accountingMethod =
      getAccountingMethod(
        movement,
        cutover
      );

    return {
      id: Number(movement.id),
      itemName:
        movement.item_name_snapshot ||
        (movement.item_id
          ? `Матеріал #${movement.item_id}`
          : "Матеріал"),
      objectName:
        movement.object_name_snapshot,
      movementType:
        movement.movement_type,
      movementCode:
        movement.movement_code,
      movementLabel:
        warehouseMovementLabels[
          movement.movement_code
        ],
      accountingMethod,
      objectCostImpact:
        getObjectCostImpact(
          movement,
          accountingMethod
        ),
      quantity: toFiniteNumber(
        movement.quantity
      ),
      unit:
        movement.unit_snapshot,
      unitPrice: toMoney(
        movement.unit_price
      ),
      totalValue: toMoney(
        movement.total_cost
      ),
      createdAt:
        movement.created_at,
      performedBy:
        movement.performed_by_name ||
        (movement.performed_by
          ? "Користувач"
          : null),
      source:
        sourceLabels[
          movement.source_type
        ],
      note: movement.note,
    } satisfies ReportWarehouseMovement;
  });
}

export async function getMaterialLedgerReport(
  input: MaterialLedgerReportInput,
  knownCutover?: MaterialLedgerCutover | null
): Promise<MaterialLedgerReport> {
  const supabase = await createClient();
  const cutover =
    knownCutover === undefined
      ? await getMaterialLedgerCutover(
          supabase
        )
      : knownCutover;

  const [costs, movements] =
    await Promise.all([
      cutover
        ? getMaterialLedgerCosts(
            supabase,
            input
          )
        : Promise.resolve(
            [] as MaterialLedgerCost[]
          ),
      getMaterialLedgerMovements(
        supabase,
        input,
        cutover
      ),
    ]);

  return {
    cutover,
    periodMode:
      getReportMaterialPeriodMode(
        input.timestampFrom,
        input.timestampToExclusive,
        cutover
      ),
    costs,
    movements,
  };
}

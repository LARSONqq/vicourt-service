import type {
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehousePurchaseInsight,
  WarehousePurchaseInsights,
  WarehousePurchasePlanningRow,
} from "@/types/warehousePurchase";

const QUANTITY_PRECISION =
  1_000_000;

function toFiniteNumber(
  value: number | null | undefined
) {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : 0;
}

function normalizeQuantity(
  value: number
) {
  return (
    Math.round(
      value *
        QUANTITY_PRECISION
    ) / QUANTITY_PRECISION
  );
}

function emptyPurchaseInsight(): WarehousePurchaseInsight {
  return {
    plannedQuantity: 0,
    lastPurchasePrice: null,
    previousPurchasePrice: null,
    priceChangePercent: null,
  };
}

export function buildWarehousePurchaseInsights(
  purchases: WarehousePurchasePlanningRow[]
): WarehousePurchaseInsights {
  const insights: WarehousePurchaseInsights =
    {};
  const completedByItem =
    new Map<
      number,
      WarehousePurchasePlanningRow[]
    >();

  for (const purchase of purchases) {
    const itemId =
      Number(purchase.item_id);

    if (
      !Number.isInteger(
        itemId
      ) ||
      itemId <= 0
    ) {
      continue;
    }

    const insight =
      insights[itemId] ||
      emptyPurchaseInsight();

    if (
      purchase.status ===
      "Заплановано"
    ) {
      insight.plannedQuantity =
        normalizeQuantity(
          insight.plannedQuantity +
            Math.max(
              toFiniteNumber(
                purchase.quantity
              ),
              0
            )
        );

    }

    if (
      purchase.status ===
      "Закуплено" &&
      purchase.purchased_at
    ) {
      const completed =
        completedByItem.get(
          itemId
        ) || [];

      completed.push(
        purchase
      );
      completedByItem.set(
        itemId,
        completed
      );
    }

    insights[itemId] =
      insight;
  }

  for (const [
    itemId,
    completed,
  ] of completedByItem) {
    completed.sort(
      (first, second) =>
        (second.purchased_at ||
          second.created_at
        ).localeCompare(
          first.purchased_at ||
            first.created_at
        ) ||
        Number(second.id) -
          Number(first.id)
    );

    const latest =
      completed[0];
    const previous =
      completed[1];
    const insight =
      insights[itemId] ||
      emptyPurchaseInsight();

    insight.lastPurchasePrice =
      latest
        ? toFiniteNumber(
            latest.purchase_price
          )
        : null;
    insight.previousPurchasePrice =
      previous
        ? toFiniteNumber(
            previous.purchase_price
          )
        : null;
    insight.priceChangePercent =
      getPurchasePriceChangePercent(
        insight.lastPurchasePrice,
        insight.previousPurchasePrice
      );
    insights[itemId] =
      insight;
  }

  return insights;
}

export function getWarehousePurchaseInsight(
  insights: WarehousePurchaseInsights,
  itemId: number
) {
  return (
    insights[itemId] ||
    emptyPurchaseInsight()
  );
}

export function getWarehouseStockPlan(
  item: Pick<
    WarehouseItem,
    | "quantity"
    | "min_quantity"
    | "target_quantity"
  >,
  plannedQuantity = 0
) {
  const currentQuantity =
    Math.max(
      toFiniteNumber(
        item.quantity
      ),
      0
    );
  const minimumQuantity =
    Math.max(
      toFiniteNumber(
        item.min_quantity
      ),
      0
    );
  const parsedTarget =
    item.target_quantity ===
      null ||
    item.target_quantity ===
      undefined
      ? null
      : Number(
          item.target_quantity
        );
  const targetQuantity =
    parsedTarget !== null &&
    Number.isFinite(
      parsedTarget
    )
      ? Math.max(
          parsedTarget,
          0
        )
      : null;
  const plannedIncoming =
    Math.max(
      toFiniteNumber(
        plannedQuantity
      ),
      0
    );
  const expectedQuantity =
    normalizeQuantity(
      currentQuantity +
        plannedIncoming
    );
  const rawShortage =
    targetQuantity === null
      ? null
      : normalizeQuantity(
          Math.max(
            targetQuantity -
              currentQuantity,
            0
          )
        );
  const remainingRecommended =
    targetQuantity === null
      ? null
      : normalizeQuantity(
          Math.max(
            targetQuantity -
              expectedQuantity,
            0
          )
        );
  const minimumShortage =
    normalizeQuantity(
      Math.max(
        minimumQuantity -
          expectedQuantity,
        0
      )
    );
  const suggestedPurchaseQuantity =
    remainingRecommended ??
    minimumShortage;

  return {
    currentQuantity,
    minimumQuantity,
    targetQuantity,
    plannedIncoming,
    expectedQuantity,
    isLowStock:
      currentQuantity <=
      minimumQuantity,
    rawShortage,
    remainingRecommended,
    minimumShortage,
    suggestedPurchaseQuantity,
    recommendationBasis:
      targetQuantity === null
        ? (minimumShortage > 0
            ? "minimum"
            : null)
        : "target",
  } as const;
}

export function getPurchasePriceChangePercent(
  latest: number | null,
  previous: number | null
) {
  if (
    latest === null ||
    previous === null ||
    !Number.isFinite(latest) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }

  return (
    ((latest - previous) /
      previous) *
    100
  );
}

export function formatWarehouseQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }
  ).format(value);
}

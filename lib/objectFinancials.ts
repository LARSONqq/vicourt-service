export type ObjectFinancials = {
  actualCost: number;
  costBudget: number | null;
  clientPrice: number | null;
  budgetDifference:
    | number
    | null;
  budgetRemaining:
    | number
    | null;
  budgetOverrun:
    | number
    | null;
  financialResult:
    | number
    | null;
  marginPercent:
    | number
    | null;
};

type CalculateObjectFinancialsInput = {
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  costBudget: number | null;
  clientPrice: number | null;
};

function toSafeCost(
  value: number
) {
  return Number.isFinite(value)
    ? value
    : 0;
}

function toOptionalAmount(
  value: number | null
) {
  if (value === null) {
    return null;
  }

  return Number.isFinite(value)
    ? value
    : null;
}

export function calculateObjectFinancials({
  materialsCost,
  laborCost,
  otherExpensesCost,
  costBudget,
  clientPrice,
}: CalculateObjectFinancialsInput): ObjectFinancials {
  const actualCost =
    toSafeCost(materialsCost) +
    toSafeCost(laborCost) +
    toSafeCost(
      otherExpensesCost
    );
  const normalizedBudget =
    toOptionalAmount(
      costBudget
    );
  const normalizedClientPrice =
    toOptionalAmount(
      clientPrice
    );
  const budgetDifference =
    normalizedBudget === null
      ? null
      : normalizedBudget -
        actualCost;
  const financialResult =
    normalizedClientPrice ===
    null
      ? null
      : normalizedClientPrice -
        actualCost;

  return {
    actualCost,
    costBudget:
      normalizedBudget,
    clientPrice:
      normalizedClientPrice,
    budgetDifference,
    budgetRemaining:
      budgetDifference !== null &&
      budgetDifference >= 0
        ? budgetDifference
        : null,
    budgetOverrun:
      budgetDifference !== null &&
      budgetDifference < 0
        ? Math.abs(
            budgetDifference
          )
        : null,
    financialResult,
    marginPercent:
      financialResult !== null &&
      normalizedClientPrice !==
        null &&
      normalizedClientPrice > 0
        ? (financialResult /
            normalizedClientPrice) *
          100
        : null,
  };
}

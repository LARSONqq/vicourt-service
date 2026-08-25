import type {
  ReportsFilterInput,
  ReportsFilters,
} from "@/types/report";

type SearchParamsReader = Pick<
  URLSearchParams,
  "get"
>;

export function getReportFilterInput(
  searchParams: SearchParamsReader
): ReportsFilterInput {
  return {
    from:
      searchParams.get("from") ||
      undefined,
    to:
      searchParams.get("to") ||
      undefined,
    object:
      searchParams.get(
        "object"
      ) || undefined,
    employee:
      searchParams.get(
        "employee"
      ) || undefined,
    expenseCategory:
      searchParams.get(
        "expense_category"
      ) || undefined,
    movementType:
      searchParams.get(
        "movement_type"
      ) || undefined,
  };
}

export function createReportExportSearchParams(
  filters: ReportsFilters
) {
  const params =
    new URLSearchParams({
      from: filters.dateFrom,
      to: filters.dateTo,
    });

  if (filters.objectId) {
    params.set(
      "object",
      String(filters.objectId)
    );
  }

  if (filters.employeeId) {
    params.set(
      "employee",
      String(filters.employeeId)
    );
  }

  if (
    filters.expenseCategory
  ) {
    params.set(
      "expense_category",
      filters.expenseCategory
    );
  }

  if (filters.movementType) {
    params.set(
      "movement_type",
      filters.movementType
    );
  }

  return params;
}

export type GlobalSearchCategory =
  | "objects"
  | "tasks"
  | "equipment"
  | "employees"
  | "warehouse"
  | "purchases"
  | "finance";

export type GlobalSearchResultType =
  | "object"
  | "task"
  | "equipment"
  | "employee"
  | "warehouse_item"
  | "purchase"
  | "payment_schedule";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  badge: string | null;
};

export type GlobalSearchGroup = {
  category: GlobalSearchCategory;
  label: string;
  results: GlobalSearchResult[];
};

export type GlobalSearchResponse = {
  query: string;
  groups: GlobalSearchGroup[];
  total: number;
};

const SEARCH_CATEGORIES =
  new Set<GlobalSearchCategory>([
    "objects",
    "tasks",
    "equipment",
    "employees",
    "warehouse",
    "purchases",
    "finance",
  ]);

const SEARCH_RESULT_TYPES =
  new Set<GlobalSearchResultType>([
    "object",
    "task",
    "equipment",
    "employee",
    "warehouse_item",
    "purchase",
    "payment_schedule",
  ]);

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null
  );
}

function isSearchResult(
  value: unknown
): value is GlobalSearchResult {
  return (
    isRecord(value) &&
    typeof value.id ===
      "string" &&
    typeof value.type ===
      "string" &&
    SEARCH_RESULT_TYPES.has(
      value.type as GlobalSearchResultType
    ) &&
    typeof value.title ===
      "string" &&
    (typeof value.subtitle ===
      "string" ||
      value.subtitle === null) &&
    typeof value.href ===
      "string" &&
    (typeof value.badge ===
      "string" ||
      value.badge === null)
  );
}

export function isGlobalSearchResponse(
  value: unknown
): value is GlobalSearchResponse {
  return (
    isRecord(value) &&
    typeof value.query ===
      "string" &&
    typeof value.total ===
      "number" &&
    Array.isArray(value.groups) &&
    value.groups.every(
      (group) =>
        isRecord(group) &&
        typeof group.category ===
          "string" &&
        SEARCH_CATEGORIES.has(
          group.category as GlobalSearchCategory
        ) &&
        typeof group.label ===
          "string" &&
        Array.isArray(
          group.results
        ) &&
        group.results.every(
          isSearchResult
        )
    )
  );
}

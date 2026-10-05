import {
  reportsSections,
} from "@/types/report";

import type {
  ReportsSection,
} from "@/types/report";

export function normalizeReportsSection(
  value: string | undefined
): ReportsSection {
  return reportsSections.includes(
    value as ReportsSection
  )
    ? (value as ReportsSection)
    : "overview";
}

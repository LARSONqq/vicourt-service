import {
  Axe,
  Bike,
  Drill,
  Fan,
  Hammer,
  Leaf,
  Package,
  Scissors,
  Sprout,
  SprayCan,
  Tractor,
  Wrench,
} from "lucide-react";
import { createElement } from "react";

import {
  formatEquipmentUsage,
  getEquipmentUsageMaintenanceLabel,
} from "@/lib/equipmentMaintenance";

import type { Equipment } from "@/types/equipment";
import type { LucideIcon } from "lucide-react";

function getCategoryIcon(category: string | null): LucideIcon {
  switch (category) {
    case "Газонокосарки":
      return Tractor;
    case "Тримери та мотокоси":
      return Scissors;
    case "Кущорізи":
      return Leaf;
    case "Бензопили":
      return Axe;
    case "Повітродуви":
      return Fan;
    case "Культиватор":
      return Sprout;
    case "Щепоріз":
      return Wrench;
    case "Обприскувачі":
      return SprayCan;
    case "Електроінструменти":
      return Drill;
    case "Ручний інструмент":
      return Hammer;
    case "Причеп":
      return Bike;
    default:
      return Package;
  }
}

export function EquipmentCategoryIcon({
  category,
  className = "h-11 w-11",
}: {
  category: string | null;
  className?: string;
}) {
  const Icon = getCategoryIcon(category);

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground ${className}`}
    >
      {createElement(Icon, {
        className: "h-5 w-5",
        strokeWidth: 1.8,
      })}
    </span>
  );
}

export function EquipmentUsageProgress({
  equipment,
  compact = false,
}: {
  equipment: Pick<
    Equipment,
    | "usage_type"
    | "current_usage"
    | "last_maintenance_usage"
    | "maintenance_interval_usage"
    | "next_maintenance_usage"
  >;
  compact?: boolean;
}) {
  const {
    usage_type: usageType,
    current_usage: currentUsage,
    last_maintenance_usage: lastMaintenanceUsage,
    maintenance_interval_usage: interval,
    next_maintenance_usage: nextUsage,
  } = equipment;
  const hasThreshold =
    usageType !== "none" &&
    currentUsage !== null &&
    interval !== null &&
    interval > 0 &&
    nextUsage !== null;

  if (!hasThreshold) {
    return null;
  }

  const cycleStart =
    lastMaintenanceUsage !== null
      ? lastMaintenanceUsage
      : nextUsage - interval;
  const progress = Math.max(
    0,
    Math.min(100, ((currentUsage - cycleStart) / interval) * 100)
  );
  const isDue = currentUsage >= nextUsage;

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground">
          {getEquipmentUsageMaintenanceLabel(equipment)}
        </span>
        {!compact && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatEquipmentUsage(currentUsage, usageType)} / {formatEquipmentUsage(nextUsage, usageType)}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Прогрес до наступного ТО за напрацюванням"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full ${isDue ? "bg-destructive" : "bg-primary/70"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

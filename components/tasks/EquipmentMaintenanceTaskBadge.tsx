type Props = {
  compact?: boolean;
};

export default function EquipmentMaintenanceTaskBadge({
  compact = false,
}: Props) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-amber-100 font-medium text-amber-800 ${
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      🔧 Автоматичне ТО
    </span>
  );
}

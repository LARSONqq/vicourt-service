export default function SupervisionTaskBadge({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-rose-100 font-medium text-rose-700 ${
        compact
          ? "px-2 py-1 text-[10px]"
          : "px-2.5 py-1 text-xs"
      }`}
    >
      Автоматичний огляд
    </span>
  );
}

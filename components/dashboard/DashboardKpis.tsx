import Link from "next/link";

import type {
  DashboardData,
} from "@/types/dashboard";

type Props = {
  kpis: DashboardData["kpis"];
};

type KpiTone =
  | "neutral"
  | "green"
  | "orange"
  | "red";

function getToneClasses(
  tone: KpiTone
) {
  switch (tone) {
    case "green":
      return "border-green-200 text-green-700";
    case "orange":
      return "border-orange-200 text-orange-700";
    case "red":
      return "border-red-200 text-red-700";
    default:
      return "text-gray-900";
  }
}

export default function DashboardKpis({
  kpis,
}: Props) {
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    href: string;
    tone: KpiTone;
  }> = [
    {
      label: "Активні об’єкти",
      value: kpis.activeObjects,
      detail: "У роботі та обслуговуванні",
      href: "/objects",
      tone: "green",
    },
    {
      label: "Завдання сьогодні",
      value: kpis.todayTasks,
      detail: "За київською датою",
      href: "/calendar",
      tone:
        kpis.todayTasks > 0
          ? "orange"
          : "neutral",
    },
    {
      label: "Прострочені завдання",
      value: kpis.overdueTasks,
      detail: "Усі видимі типи завдань",
      href: "/task",
      tone:
        kpis.overdueTasks > 0
          ? "red"
          : "neutral",
    },
    {
      label: "Потребує уваги",
      value: kpis.attentionItems,
      detail: "Актуальні сповіщення",
      href: "/notifications",
      tone:
        kpis.attentionItems > 0
          ? "red"
          : "neutral",
    },
    {
      label: "Низькі залишки",
      value: kpis.lowStockItems,
      detail: "Позиції на рівні мінімуму",
      href: "/warehouse",
      tone:
        kpis.lowStockItems > 0
          ? "orange"
          : "neutral",
    },
  ];

  if (
    kpis.overduePayments !==
    null
  ) {
    cards.push({
      label: "Прострочені платежі",
      value:
        kpis.overduePayments,
      detail: "Непокриті етапи графіка",
      href: "/notifications?type=finance",
      tone:
        kpis.overduePayments > 0
          ? "red"
          : "neutral",
    });
  }

  return (
    <section
      aria-label="Оперативні показники"
      className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`min-w-0 rounded-xl border bg-white p-4 transition hover:bg-gray-50 sm:p-5 ${getToneClasses(
            card.tone
          )}`}
        >
          <p className="break-words text-xs font-medium text-gray-500 sm:text-sm">
            {card.label}
          </p>

          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {card.value}
          </p>

          <p className="mt-1 break-words text-xs leading-4 text-gray-400">
            {card.detail}
          </p>
        </Link>
      ))}
    </section>
  );
}

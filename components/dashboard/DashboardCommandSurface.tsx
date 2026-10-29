import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { taskDashboardLinks } from "@/lib/taskWorkspace";
import { getDashboardCommandData } from "@/services/dashboardService";
import type { AppCurrency } from "@/types/appSettings";
import type { DashboardCommandData } from "@/types/dashboard";

type Kpi = {
  label: string;
  value: string;
  context: string;
  href: string;
  tone: "default" | "warning" | "positive";
};

function formatMoney(value: number, currency: AppCurrency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getKpis(data: DashboardCommandData): Kpi[] {
  if (data.kind === "worker") return [
    { label: "Мої сьогодні", value: String(data.kpis.myTodayTasks), context: "Відкриті завдання", href: data.taskLinks.today, tone: "positive" },
    { label: "Мої прострочені", value: String(data.kpis.myOverdueTasks), context: "Потребують уваги", href: data.taskLinks.overdue, tone: "warning" },
    { label: "Мої відкриті", value: String(data.kpis.myOpenTasks), context: "Усі призначені", href: data.taskLinks.open, tone: "default" },
    { label: "Призначені об’єкти", value: String(data.kpis.assignedActiveObjects), context: "Активні об’єкти", href: "/objects", tone: "default" },
  ];
  return [
    { label: "Дебіторська заборгованість", value: formatMoney(data.kpis.outstandingReceivables, data.currency), context: "Поточний залишок", href: "/reports?section=overview", tone: "default" },
    { label: "Прострочено за графіком", value: formatMoney(data.kpis.overdueScheduleAmount, data.currency), context: "На поточну дату", href: "/reports?section=overview", tone: "warning" },
    { label: "Прострочені завдання", value: String(data.kpis.overdueTasks), context: "Відкриті завдання", href: taskDashboardLinks.overdue, tone: "warning" },
    { label: "Активні об’єкти", value: String(data.kpis.activeObjects), context: "У поточній роботі", href: "/objects", tone: "positive" },
  ];
}

const toneClass = {
  default: "border-gray-200 bg-white",
  warning: "border-orange-200 bg-orange-50/60",
  positive: "border-green-200 bg-green-50/50",
} as const;

function KpiStrip({ data }: { data: DashboardCommandData }) {
  return <section aria-label="Ключові показники" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
    {getKpis(data).map((kpi) => <Link key={kpi.label} href={kpi.href}
      className={`flex min-h-32 min-w-0 flex-col rounded-xl border p-3 transition hover:border-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 sm:p-4 ${toneClass[kpi.tone]}`}>
      <span className="break-words text-xs font-medium leading-5 text-gray-600 sm:text-sm">{kpi.label}</span>
      <strong className="mt-auto break-words pt-3 text-xl font-semibold leading-tight tabular-nums text-gray-950 sm:text-2xl">{kpi.value}</strong>
      <span className="mt-1 break-words text-xs text-gray-500">{kpi.context}</span>
    </Link>)}
  </section>;
}

export function DashboardCommandSkeleton() {
  return <section aria-busy="true" aria-label="Ключові показники" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-32 animate-pulse rounded-xl border bg-white p-4 motion-reduce:animate-none">
      <div className="h-4 w-3/4 rounded bg-gray-100" /><div className="mt-10 h-7 w-1/2 rounded bg-gray-100" />
    </div>)}
  </section>;
}

export async function DashboardCommandSurface() {
  let data: DashboardCommandData;
  try {
    data = await getDashboardCommandData();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Dashboard] command surface load failed", error);
    return <section className="rounded-xl border bg-white p-4 sm:p-5">
      <p role="status" className="text-sm text-gray-600">Не вдалося завантажити ключові показники. Спробуйте оновити сторінку.</p>
    </section>;
  }
  return <div className="min-w-0">
    <KpiStrip data={data} />
    {data.kind === "worker" && !data.employeeLinked && <p role="status" className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
      Профіль не пов’язаний із працівником. Персональні показники залишаються порожніми до прив’язки адміністратором.
    </p>}
  </div>;
}

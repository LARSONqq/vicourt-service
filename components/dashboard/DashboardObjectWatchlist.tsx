import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { getDashboardObjectWatchlist } from "@/services/dashboardObjectWatchlistService";
import type { AppCurrency } from "@/types/appSettings";
import type {
  DashboardObjectWatchlistData,
  ManagementObjectWatchlistItem,
  WorkerObjectWatchlistItem,
} from "@/types/dashboardObjectWatchlist";

const warningBadge = "rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800";
const criticalBadge = "rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-800";

function taskLabel(count: number) {
  return `${count} ${count === 1 ? "прострочене завдання" : "прострочені завдання"}`;
}

function formatMoney(value: number, currency: AppCurrency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}

function operationalBadges(item: WorkerObjectWatchlistItem) {
  const badges: { label: string; className: string }[] = [];
  if (item.supervisionOverdue) badges.push({ label: "Огляд прострочено", className: criticalBadge });
  if (item.overdueTaskCount > 0) badges.push({ label: taskLabel(item.overdueTaskCount), className: warningBadge });
  return badges;
}

function managementBadges(item: ManagementObjectWatchlistItem, currency: AppCurrency) {
  const badges: { label: string; className: string }[] = [];
  if (item.hasOverduePayment) badges.push({
    label: `Платіж прострочено · ${formatMoney(item.overduePaymentAmount, currency)}`,
    className: criticalBadge,
  });
  badges.push(...operationalBadges(item));
  if (item.missingClientPrice) badges.push({ label: "Не вказана ціна", className: warningBadge });
  return badges.slice(0, 2);
}

function WatchlistRow({
  item,
  badges,
}: {
  item: WorkerObjectWatchlistItem;
  badges: { label: string; className: string }[];
}) {
  return <li>
    <Link href={item.href} className="block min-h-20 min-w-0 px-4 py-3 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:px-5">
      <span className="flex min-w-0 items-start justify-between gap-3">
        <strong className="min-w-0 break-words text-sm font-semibold text-gray-900 sm:text-base">{item.name}</strong>
        <span aria-hidden="true" className="shrink-0 text-gray-400">→</span>
      </span>
      <span className="mt-1 block break-words text-sm text-gray-500">
        {item.status}{item.responsibleEmployeeName ? ` · ${item.responsibleEmployeeName}` : ""}
      </span>
      {badges.length > 0 && <span className="mt-2 flex min-w-0 flex-wrap gap-1.5">
        {badges.map((badge) => <span key={badge.label} className={`${badge.className} max-w-full break-words`}>{badge.label}</span>)}
      </span>}
    </Link>
  </li>;
}

export function DashboardObjectWatchlistSkeleton() {
  return <section aria-busy="true" aria-label="Об’єкти під контролем" className="min-w-0 overflow-hidden rounded-xl border bg-white">
    <div className="border-b px-4 py-4 sm:px-5"><div className="h-5 w-52 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" /></div>
    <div className="space-y-3 p-4 sm:p-5">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}</div>
  </section>;
}

export async function DashboardObjectWatchlist() {
  let data: DashboardObjectWatchlistData;
  try {
    data = await getDashboardObjectWatchlist();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Dashboard] object watchlist load failed", error);
    return <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Об’єкти під контролем</h2>
      <p role="status" className="mt-3 text-sm text-gray-600">Не вдалося завантажити дані. Оновіть сторінку та спробуйте ще раз.</p>
    </section>;
  }
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
    <div className="flex min-h-20 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">Об’єкти під контролем</h2><p className="mt-1 break-words text-sm text-gray-500">До 5 активних об’єктів за пріоритетом</p></div>
      <Link href="/objects" className="inline-flex min-h-11 shrink-0 items-center rounded-md text-sm font-medium text-green-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Усі об’єкти →</Link>
    </div>
    {data.items.length === 0
      ? <p className="px-4 py-8 text-center text-sm text-gray-500 sm:px-5">Наразі немає активних об’єктів, що потребують уваги.</p>
      : <ul className="min-w-0 divide-y">{data.kind === "management"
        ? data.items.map((item) => <WatchlistRow key={item.objectId} item={item} badges={managementBadges(item, data.currency)} />)
        : data.items.map((item) => <WatchlistRow key={item.objectId} item={item} badges={operationalBadges(item).slice(0, 2)} />)}
      </ul>}
  </section>;
}

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { formatDateValue } from "@/lib/kyivDate";
import { getDashboardAttention } from "@/services/dashboardAttentionService";
import type { AppCurrency } from "@/types/appSettings";
import type { DashboardAttentionData, DashboardAttentionItem } from "@/types/dashboardAttention";

const severityClass = {
  critical: "bg-red-500",
  warning: "bg-orange-500",
  info: "bg-gray-400",
} as const;

function formatMoney(value: number, currency: AppCurrency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}

function AttentionRow({ item, currency }: { item: DashboardAttentionItem; currency: AppCurrency | null }) {
  const date = item.relevantDate ? formatDateValue(item.relevantDate) : null;
  return <li>
    <Link href={item.href} className="flex min-h-16 min-w-0 items-start gap-3 px-4 py-3 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:px-5">
      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityClass[item.severity]}`} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <strong className="break-words text-sm font-semibold text-gray-900">{item.title}</strong>
          {date && <span className="shrink-0 text-xs text-gray-500">{date}</span>}
        </span>
        <span className="mt-1 block break-words text-sm text-gray-600">{item.description}</span>
        {item.source === "finance" && currency && <span className="mt-1 block text-sm font-medium tabular-nums text-gray-800">{formatMoney(item.amount, currency)}</span>}
      </span>
      <span aria-hidden="true" className="mt-1 shrink-0 text-gray-400">→</span>
    </Link>
  </li>;
}

export function DashboardAttentionSkeleton() {
  return <section aria-busy="true" aria-label="Потребує уваги" className="min-w-0 overflow-hidden rounded-xl border bg-white">
    <div className="border-b px-4 py-4 sm:px-5"><div className="h-5 w-44 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" /></div>
    <div className="space-y-3 p-4 sm:p-5">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}</div>
  </section>;
}

export async function DashboardAttention() {
  let data: DashboardAttentionData;
  try {
    data = await getDashboardAttention();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Dashboard] attention load failed", error);
    return <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Потребує уваги</h2>
      <p role="status" className="mt-3 text-sm text-gray-600">Не вдалося завантажити цей розділ. Спробуйте оновити сторінку.</p>
    </section>;
  }
  const currency = data.kind === "management" ? data.currency : null;
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
    <div className="flex min-h-20 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
      <div><h2 className="text-lg font-semibold">Потребує уваги</h2><p className="mt-1 text-sm text-gray-500">До 8 пріоритетних дій</p></div>
      <Link href="/notifications" className="inline-flex min-h-11 items-center text-sm font-medium text-green-700 hover:underline">Усі сповіщення →</Link>
    </div>
    {data.items.length === 0
      ? <p className="px-4 py-8 text-center text-sm text-gray-500 sm:px-5">Зараз немає термінових дій.</p>
      : <ul className="min-w-0 divide-y">{data.items.map((item) => <AttentionRow key={item.id} item={item} currency={currency} />)}</ul>}
    {data.partialFailure && <p role="status" className="border-t bg-orange-50 px-4 py-3 text-sm text-orange-800 sm:px-5">Частина показників тимчасово недоступна.</p>}
  </section>;
}

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import TodayTasksSection from "@/components/dashboard/TodayTasksSection";
import { activityEventRegistry, isActivityEventName } from "@/constants/activityLog";
import { formatDateValue, formatKyivTimestamp } from "@/lib/kyivDate";
import { getTaskPriorityStyle } from "@/lib/taskPresentation";
import { getTaskTarget } from "@/lib/taskTarget";
import { taskDashboardLinks } from "@/lib/taskWorkspace";
import { warehouseStockPresentation } from "@/lib/warehouseStock";
import {
  getDashboardContext, getDashboardTasksSummary, getDashboardTasksPreview,
  getDashboardWarehouse, getDashboardEquipment, getDashboardObjects, getDashboardActivity,
} from "@/services/dashboardService";

const linkClass = "inline-flex min-h-10 shrink-0 items-center py-2 text-sm font-medium text-green-700 hover:underline";
const compactListClass = "min-w-0 divide-y overflow-hidden rounded-lg border";
const compactLinkClass = "block min-h-16 min-w-0 px-3 py-3 transition hover:bg-gray-50 sm:px-4";
const mutedClass = "text-sm text-gray-500";

export function DashboardSkeleton({ title }: { title: string }) {
  return <section aria-busy="true" aria-label={title} className="flex min-h-56 min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
    <div className="flex min-h-20 items-center border-b px-4 py-3 sm:px-5">
      <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-gray-500">Завантаження…</p></div>
    </div>
    <div className="flex-1 p-4 sm:p-5"><div className="h-24 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" /></div>
  </section>;
}

// Server-only composition. Auth/Next control-flow errors must never become empty widgets.
async function DashboardSection<T>({ title, subtitle, href, load, children, standalone = false }: {
  title: string; subtitle?: string; href: string; load: () => Promise<T>; children: (data: T) => ReactNode; standalone?: boolean;
}) {
  await getDashboardContext();
  let data: T;
  try {
    data = await load();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[Dashboard] ${title}: section load failed`, error);
    return <section className="flex h-full min-h-56 min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
      <div className="flex min-h-20 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={href} className={linkClass}>Переглянути всі →</Link>
      </div>
      <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
        <p role="status" className="text-sm text-gray-600">Не вдалося завантажити цей розділ. Спробуйте оновити сторінку.</p>
      </div>
    </section>;
  }
  if (standalone) return children(data);
  return <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
    <div className="flex min-h-20 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 break-words text-sm text-gray-500">{subtitle}</p>}
      </div>
      <Link href={href} className={linkClass}>Переглянути всі →</Link>
    </div>
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{children(data)}</div>
  </section>;
}

export function DashboardTaskSummary() {
  return <DashboardSection title="Завдання" subtitle="Що потребує уваги зараз" href="/tasks" load={getDashboardTasksSummary}>{(data) => <>
    <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
      {([
        ["today", "Сьогодні"], ["overdue", "Прострочені"], ["myOpen", "Мої відкриті"], ["open", "Відкриті"],
      ] as const).map(([key, label]) => <Link key={key} href={taskDashboardLinks[key]} className={`flex min-h-28 min-w-0 flex-col rounded-lg border p-3 transition hover:border-green-300 hover:bg-gray-50 sm:p-4 ${key === "overdue" && data.overdue > 0 ? "border-orange-200 bg-orange-50" : ""}`}>
        <span className="block min-h-10 break-words text-sm leading-5 text-gray-600">{label}</span>
        <span className="mt-auto block pt-2 text-2xl font-semibold tabular-nums">{data[key]}</span>
      </Link>)}
    </div>
    {!data.hasEmployeeLink && <p className={mutedClass}>Ваш профіль не пов’язаний із працівником. «Мої відкриті» стане доступним після прив’язки адміністратором.</p>}
  </>}</DashboardSection>;
}

export function DashboardTodayTasks() {
  return <DashboardSection standalone title="Сьогодні" href={taskDashboardLinks.today} load={async () => {
    const context = await getDashboardContext();
    return { ...await getDashboardTasksPreview("today"), permissions: context.permissions };
  }}>{({ tasks, today, permissions }) => <TodayTasksSection tasks={tasks} today={today}
    canManageSupervision={permissions.canManageSupervision} canManageEquipment={permissions.canManageEquipment} />}</DashboardSection>;
}

export function DashboardOverdueTasks() {
  return <DashboardSection title="Прострочені завдання" subtitle="До 5 найдавніших відкритих" href={taskDashboardLinks.overdue} load={() => getDashboardTasksPreview("overdue")}>{({ tasks }) => <>
    {tasks.length === 0 ? <p className={`${mutedClass} my-auto text-center`}>Прострочених завдань немає.</p> : <ul className={compactListClass}>
      {tasks.map((task) => {
        const target = getTaskTarget(task);
        return <li key={task.id}><Link href={`/tasks/${task.id}`} className={compactLinkClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 flex-1 break-words font-medium sm:line-clamp-2">{task.title}</span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${getTaskPriorityStyle(task.priority)}`}>{task.priority}</span>
          </div>
          <p className="mt-1 break-words text-sm text-gray-500"><span className="font-medium text-orange-700">{formatDateValue(task.due_date)}</span> · {task.assignee || "Не призначено"}{target ? ` · ${target.name}` : ""}</p>
        </Link></li>;
      })}
    </ul>}
  </>}</DashboardSection>;
}

export function DashboardWarehouseAttention() {
  return <DashboardSection title="Склад" subtitle="Увага до залишків" href="/warehouse" load={getDashboardWarehouse}>{(data) => <>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <Link href="/warehouse?stock=out" className={`flex min-h-16 min-w-0 flex-col rounded-lg p-2 transition hover:ring-1 hover:ring-red-200 sm:px-3 ${data.out > 0 ? "bg-red-50" : "bg-gray-50"}`}>
        <span className="break-words text-xs leading-4 text-gray-600 sm:text-sm">Закінчилось</span><strong className="mt-auto pt-1 text-xl font-semibold tabular-nums">{data.out}</strong>
      </Link>
      <Link href="/warehouse?stock=low" className={`flex min-h-16 min-w-0 flex-col rounded-lg p-2 transition hover:ring-1 hover:ring-orange-200 sm:px-3 ${data.low > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
        <span className="break-words text-xs leading-4 text-gray-600 sm:text-sm">Мало</span><strong className="mt-auto pt-1 text-xl font-semibold tabular-nums">{data.low}</strong>
      </Link>
    </div>
    {data.items.length === 0 ? <p className={`${mutedClass} my-auto text-center`}>{data.attention === 0 ? "Запаси не потребують уваги." : "Є низькі залишки. Відкрийте Склад для повного списку."}</p> : <ul className={compactListClass}>
      {data.items.map((item) => <li key={item.id}><Link href={`/warehouse/${item.id}`} className={`${compactLinkClass} flex items-center justify-between gap-3`}>
        <span className="min-w-0"><span className="block break-words font-medium sm:line-clamp-2">{item.name}</span><span className="mt-1 block text-sm text-gray-500">{Number(item.quantity).toLocaleString("uk-UA")} {item.unit}</span></span>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${warehouseStockPresentation[item.stockStatus].badgeClass}`}>{warehouseStockPresentation[item.stockStatus].label}</span>
      </Link></li>)}
    </ul>}
    <p className={`${mutedClass} mt-auto border-t pt-3`}>Точні показники по всьому складу. У списку — до 5 позицій без запасу.</p>
  </>}</DashboardSection>;
}

export function DashboardEquipmentAttention() {
  return <DashboardSection title="Техніка" subtitle="ТО за датою та напрацюванням" href="/equipment" load={getDashboardEquipment}>{(data) => <>
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {[["Прострочено", data.overdue], ["Потрібне зараз", data.dueNow], ["За 7 днів", data.upcoming]].map(([label, count]) => <div key={label} className="flex min-h-16 min-w-0 flex-col rounded-lg bg-gray-50 p-2 sm:px-3">
        <dt className="break-words text-xs leading-4 text-gray-600 sm:text-sm">{label}</dt><dd className="mt-auto pt-1 text-xl font-semibold tabular-nums">{count}</dd>
      </div>)}
    </dl>
    {data.items.length === 0 ? <p className={`${mutedClass} my-auto text-center`}>{data.attention === 0 ? "Планового ТО, що потребує уваги, немає." : "Є техніка, що потребує ТО за напрацюванням. Відкрийте розділ Техніка для деталей."}</p> : <ul className={compactListClass}>
      {data.items.map((item) => <li key={item.id}><Link href={`/equipment/${item.id}`} className={`${compactLinkClass} flex items-center justify-between gap-3`}>
        <span className="min-w-0"><span className="block break-words font-medium sm:line-clamp-2">{item.name}</span><span className="mt-1 block text-sm text-gray-500">{formatDateValue(item.date)}</span></span>
        <span className={`shrink-0 rounded-full px-2 py-1 text-right text-xs ${item.usageDue ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>{item.usageDue ? "Поріг напрацювання" : item.label}</span>
      </Link></li>)}
    </ul>}
    <div className="mt-auto border-t pt-3"><p className={mutedClass}>Точні показники враховують дату й поріг напрацювання. У списку — до 5 записів за датою.</p><Link href="/tasks?view=all&status=open&source=equipment_maintenance" className={linkClass}>Усі відкриті завдання ТО →</Link></div>
  </>}</DashboardSection>;
}

export function DashboardObjectsOverview() {
  return <DashboardSection title="Активні об’єкти" subtitle="Поточні об’єкти в роботі" href="/objects" load={getDashboardObjects}>{(data) => <>
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 sm:px-4">
      <span className="text-sm text-gray-600">Всього активних</span><strong className="text-xl tabular-nums">{data.total}</strong>
    </div>
    <dl className="space-y-1.5 text-sm">{data.statuses.map(({ status, count }) => <div key={status} className="flex justify-between gap-3">
      <dt className="break-words text-gray-600">{status}</dt><dd className="font-semibold tabular-nums">{count}</dd>
    </div>)}</dl>
    {data.items.length === 0 ? <p className={`${mutedClass} my-auto text-center`}>Активних об’єктів поки немає.</p> : <ul className={compactListClass}>
      {data.items.map((item) => <li key={item.id}><Link href={`/objects/${item.id}`} className={compactLinkClass}>
        <span className="block break-words font-medium sm:line-clamp-2">{item.name}</span><span className="mt-1 block text-sm text-gray-500">{item.status}</span>
      </Link></li>)}
    </ul>}
    <p className={`${mutedClass} mt-auto border-t pt-3`}>До 5 останніх створених активних об’єктів.</p>
  </>}</DashboardSection>;
}

export function DashboardRecentActivity() {
  return <DashboardSection title="Останні дії" subtitle="Останні 5 подій у системі" href="/activity" load={getDashboardActivity}>{(logs) => !logs?.length
    ? <p className={`${mutedClass} py-4 text-center`}>Записів у журналі дій поки немає.</p>
    : <ul className={compactListClass}>{logs.map((log) => <li key={log.id} className="min-w-0 px-3 py-3 sm:px-4">
      <p className="break-words text-sm font-medium">{isActivityEventName(log.action) ? activityEventRegistry[log.action].label : "Дія в системі"}</p>
      {log.entity_name && <p className="mt-1 break-words text-sm text-gray-600">{log.entity_name}</p>}
      <p className="mt-1 break-words text-xs text-gray-500">{log.actor_name || "Система"} · {formatKyivTimestamp(log.created_at)}</p>
    </li>)}</ul>
  }</DashboardSection>;
}

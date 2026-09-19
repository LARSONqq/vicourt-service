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

const linkClass = "inline-flex min-h-11 items-center py-2 text-sm font-medium text-green-700 hover:underline";
const rowClass = "block min-h-11 min-w-0 rounded-lg border p-3 transition hover:border-green-300 hover:bg-green-50";
const mutedClass = "text-sm text-gray-500";

export function DashboardSkeleton({ title }: { title: string }) {
  return <section aria-busy="true" aria-label={title} className="min-w-0 space-y-3 rounded-xl border bg-white p-4 sm:p-5">
    <h2 className="font-semibold">{title}</h2>
    <p className="text-sm text-gray-500">Завантаження…</p>
    <div className="h-20 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />
  </section>;
}

// Server-only composition. Auth/Next control-flow errors must never become empty widgets.
async function DashboardSection<T>({ title, href, load, children, standalone = false }: {
  title: string; href: string; load: () => Promise<T>; children: (data: T) => ReactNode; standalone?: boolean;
}) {
  await getDashboardContext();
  let data: T;
  try {
    data = await load();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[Dashboard] ${title}: section load failed`, error);
    return <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      <p role="status" className="mt-2 text-sm text-gray-600">Не вдалося завантажити цей розділ. Спробуйте оновити сторінку.</p>
      <Link href={href} className={linkClass}>Відкрити розділ →</Link>
    </section>;
  }
  if (standalone) return children(data);
  return <section className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-x-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link href={href} className={linkClass}>Відкрити →</Link>
    </div>
    {children(data)}
  </section>;
}

export function DashboardTaskSummary() {
  return <DashboardSection title="Завдання" href="/tasks" load={getDashboardTasksSummary}>{(data) => <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([
        ["today", "Сьогодні"], ["overdue", "Прострочені"], ["myOpen", "Мої відкриті"], ["open", "Відкриті"],
      ] as const).map(([key, label]) => <Link key={key} href={taskDashboardLinks[key]} className={`${rowClass} ${key === "overdue" && data.overdue > 0 ? "border-orange-200 bg-orange-50" : ""}`}>
        <span className="block text-sm text-gray-600">{label}</span>
        <span className="mt-1 block text-2xl font-semibold tabular-nums">{data[key]}</span>
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
  return <DashboardSection title="Прострочені завдання" href={taskDashboardLinks.overdue} load={() => getDashboardTasksPreview("overdue")}>{({ tasks }) => <>
    <p className={mutedClass}>До 5 найдавніших відкритих завдань.</p>
    {tasks.length === 0 ? <p className={mutedClass}>Прострочених завдань немає.</p> : <ul className="space-y-2">
      {tasks.map((task) => {
        const target = getTaskTarget(task);
        return <li key={task.id}><Link href={`/tasks/${task.id}`} className={rowClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 break-words font-medium">{task.title}</span>
            <span className={`rounded-full px-2 py-1 text-xs ${getTaskPriorityStyle(task.priority)}`}>{task.priority}</span>
          </div>
          <p className="mt-1 text-sm text-orange-700">{formatDateValue(task.due_date)}</p>
          <p className="mt-1 break-words text-sm text-gray-500">{task.assignee || "Не призначено"}{target ? ` · ${target.name}` : ""}</p>
        </Link></li>;
      })}
    </ul>}
  </>}</DashboardSection>;
}

export function DashboardWarehouseAttention() {
  return <DashboardSection title="Склад · увага до залишків" href="/warehouse" load={getDashboardWarehouse}>{(data) => <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/warehouse?stock=out" className={rowClass}>Закінчилось <strong className="ml-2 text-xl tabular-nums">{data.out}</strong></Link>
      <Link href="/warehouse?stock=low" className={linkClass}>Перевірити низькі залишки →</Link>
    </div>
    {data.items.length === 0 ? <p className={mutedClass}>Матеріалів із нульовим або від’ємним залишком немає.</p> : <ul className="space-y-2">
      {data.items.map((item) => <li key={item.id}><Link href={`/warehouse/${item.id}`} className={rowClass}>
        <span className="block break-words font-medium">{item.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span>{Number(item.quantity).toLocaleString("uk-UA")} {item.unit}</span>
          <span className={`rounded-full px-2 py-1 text-xs ${warehouseStockPresentation[item.stockStatus].badgeClass}`}>{warehouseStockPresentation[item.stockStatus].label}</span>
        </span>
      </Link></li>)}
    </ul>}
    <p className={mutedClass}>До 5 позицій без запасу. Повний огляд низьких залишків — у Складі.</p>
  </>}</DashboardSection>;
}

export function DashboardEquipmentAttention() {
  return <DashboardSection title="Техніка · план ТО за датою" href="/equipment" load={getDashboardEquipment}>{(data) => <>
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {[["Прострочено", data.overdue], ["Сьогодні", data.today], ["За 7 днів", data.upcoming]].map(([label, count]) => <div key={label} className="min-w-0 rounded-lg bg-gray-50 p-2">
        <dt className="break-words text-gray-600">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count}</dd>
      </div>)}
    </dl>
    {data.items.length === 0 ? <p className={mutedClass}>ТО за датою до кінця найближчих 7 днів не заплановано; прострочених дат немає.</p> : <ul className="space-y-2">
      {data.items.map((item) => <li key={item.id}><Link href={`/equipment/${item.id}`} className={rowClass}>
        <span className="block break-words font-medium">{item.name}</span>
        <span className="mt-1 block text-sm text-gray-600">{formatDateValue(item.date)} · {item.label}</span>
        {item.usageDue && <span className="mt-1 block text-sm text-orange-700">Досягнуто поріг напрацювання</span>}
      </Link></li>)}
    </ul>}
    <p className={mutedClass}>До 5 найближчих або прострочених дат. Лічильники лише за датою, без окремого ТО за напрацюванням.</p>
    <Link href="/tasks?view=all&status=open&source=equipment_maintenance" className={linkClass}>Усі відкриті завдання ТО →</Link>
  </>}</DashboardSection>;
}

export function DashboardObjectsOverview() {
  return <DashboardSection title="Активні об’єкти" href="/objects" load={getDashboardObjects}>{(data) => <>
    <p className="text-sm text-gray-600">Всього активних: <strong className="text-lg text-gray-900">{data.total}</strong></p>
    <dl className="space-y-2 text-sm">{data.statuses.map(({ status, count }) => <div key={status} className="flex justify-between gap-3">
      <dt className="break-words text-gray-600">{status}</dt><dd className="font-semibold tabular-nums">{count}</dd>
    </div>)}</dl>
    {data.items.length === 0 ? <p className={mutedClass}>Активних об’єктів поки немає.</p> : <ul className="space-y-2">
      {data.items.map((item) => <li key={item.id}><Link href={`/objects/${item.id}`} className={rowClass}>
        <span className="block break-words font-medium">{item.name}</span><span className="mt-1 block text-sm text-gray-500">{item.status}</span>
      </Link></li>)}
    </ul>}
    <p className={mutedClass}>До 5 останніх створених активних об’єктів.</p>
  </>}</DashboardSection>;
}

export function DashboardRecentActivity() {
  return <DashboardSection title="Останні дії" href="/activity" load={getDashboardActivity}>{(logs) => !logs?.length
    ? <p className={mutedClass}>Записів у журналі дій поки немає.</p>
    : <ul className="space-y-3">{logs.map((log) => <li key={log.id} className="min-w-0 border-b pb-3 last:border-0">
      <p className="break-words text-sm font-medium">{isActivityEventName(log.action) ? activityEventRegistry[log.action].label : "Дія в системі"}</p>
      {log.entity_name && <p className="mt-1 break-words text-sm text-gray-600">{log.entity_name}</p>}
      <p className="mt-1 break-words text-xs text-gray-500">{log.actor_name || "Система"} · {formatKyivTimestamp(log.created_at)}</p>
    </li>)}</ul>
  }</DashboardSection>;
}

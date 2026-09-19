import Link from "next/link";
import { Suspense } from "react";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import {
  DashboardSkeleton, DashboardTaskSummary, DashboardTodayTasks, DashboardOverdueTasks,
  DashboardWarehouseAttention, DashboardEquipmentAttention, DashboardObjectsOverview, DashboardRecentActivity,
} from "@/components/dashboard/OperationalDashboard";
import { getDashboardContext } from "@/services/dashboardService";
import { formatLongDateValue } from "@/lib/kyivDate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Only auth blocks the header. Independent widgets stream under their own boundaries.
  const { permissions, today, activityVisible } = await getDashboardContext();
  return <div className="min-w-0 space-y-6">
    <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">Оперативний огляд</h1>
        <p className="mt-1 text-sm text-gray-500">{formatLongDateValue(today)}</p>
      </div>
      <DashboardQuickActions permissions={permissions} />
    </header>
    <nav aria-label="Оперативні розділи" className="flex flex-wrap gap-x-5 text-sm font-medium text-green-700">
      <Link href="/notifications" className="inline-flex min-h-11 items-center hover:underline">Сповіщення →</Link>
      <Link href="/calendar" className="inline-flex min-h-11 items-center hover:underline">Календар →</Link>
    </nav>
    <Suspense fallback={<DashboardSkeleton title="Завдання" />}><DashboardTaskSummary /></Suspense>
    <div className="grid min-w-0 items-stretch gap-4 sm:gap-5 xl:grid-cols-2">
      <Suspense fallback={<DashboardSkeleton title="Сьогодні" />}><DashboardTodayTasks /></Suspense>
      <Suspense fallback={<DashboardSkeleton title="Прострочені завдання" />}><DashboardOverdueTasks /></Suspense>
    </div>
    <div className="grid min-w-0 items-stretch gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Suspense fallback={<DashboardSkeleton title="Склад" />}><DashboardWarehouseAttention /></Suspense>
      <Suspense fallback={<DashboardSkeleton title="Техніка" />}><DashboardEquipmentAttention /></Suspense>
      <div className="h-full md:col-span-2 xl:col-span-1">
        <Suspense fallback={<DashboardSkeleton title="Активні об’єкти" />}><DashboardObjectsOverview /></Suspense>
      </div>
    </div>
    {activityVisible && <Suspense fallback={<DashboardSkeleton title="Останні дії" />}><DashboardRecentActivity /></Suspense>}
  </div>;
}

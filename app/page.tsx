import { Suspense } from "react";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import { DashboardCommandSkeleton, DashboardCommandSurface } from "@/components/dashboard/DashboardCommandSurface";
import { DashboardAttention, DashboardAttentionSkeleton } from "@/components/dashboard/DashboardAttention";
import { DashboardObjectWatchlist, DashboardObjectWatchlistSkeleton } from "@/components/dashboard/DashboardObjectWatchlist";
import {
  DashboardSkeleton, DashboardTodayTasks,
  DashboardWarehouseAttention, DashboardEquipmentAttention, DashboardRecentActivity,
} from "@/components/dashboard/OperationalDashboard";
import { getDashboardContext } from "@/services/dashboardService";
import { formatLongDateValue } from "@/lib/kyivDate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Only auth blocks the header. Independent widgets stream under their own boundaries.
  const { permissions, today, activityVisible } = await getDashboardContext();
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <header className="min-w-0 pb-1 text-foreground">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="vc-page-title break-words">Оперативний огляд</h1>
          <p className="mt-1.5 break-words text-sm text-muted-foreground">{formatLongDateValue(today)}</p>
        </div>
        <DashboardQuickActions permissions={permissions} />
      </div>
    </header>
    <Suspense fallback={<DashboardCommandSkeleton />}><DashboardCommandSurface /></Suspense>
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <Suspense fallback={<DashboardAttentionSkeleton />}><DashboardAttention /></Suspense>
      <Suspense fallback={<DashboardSkeleton title="Сьогодні" />}><DashboardTodayTasks /></Suspense>
    </div>
    <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Suspense fallback={<DashboardSkeleton title="Склад" />}><DashboardWarehouseAttention /></Suspense>
      <Suspense fallback={<DashboardSkeleton title="Техніка" />}><DashboardEquipmentAttention /></Suspense>
      <div className="md:col-span-2 xl:col-span-1">
        <Suspense fallback={<DashboardObjectWatchlistSkeleton />}><DashboardObjectWatchlist /></Suspense>
      </div>
    </div>
    {activityVisible && <Suspense fallback={<DashboardSkeleton title="Останні дії" />}><DashboardRecentActivity /></Suspense>}
  </div>;
}

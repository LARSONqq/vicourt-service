import Link from "next/link";
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
import { getUserRoleLabel } from "@/types/userProfile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Only auth blocks the header. Independent widgets stream under their own boundaries.
  const { profile, permissions, today, activityVisible } = await getDashboardContext();
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <header className="vc-surface min-w-0 vc-dashboard-hero p-5 sm:p-6 lg:p-7">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{getUserRoleLabel(profile.role)}</p>
          <h1 className="vc-page-title mt-2 break-words text-3xl sm:text-4xl">Оперативний огляд</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{profile.full_name ?? "Користувач"} · {formatLongDateValue(today)}</p>
        </div>
        <DashboardQuickActions permissions={permissions} />
      </div>
      <nav aria-label="Оперативні розділи" className="mt-6 flex flex-wrap gap-x-6 border-t border-border pt-3 text-sm font-semibold text-primary">
        <Link href="/notifications" className="inline-flex min-h-11 items-center rounded-md hover:text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Сповіщення <span aria-hidden="true" className="ml-1">↗</span></Link>
        <Link href="/calendar" className="inline-flex min-h-11 items-center rounded-md hover:text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Календар <span aria-hidden="true" className="ml-1">↗</span></Link>
      </nav>
    </header>
    <Suspense fallback={<DashboardCommandSkeleton />}><DashboardCommandSurface /></Suspense>
    <Suspense fallback={<DashboardAttentionSkeleton />}><DashboardAttention /></Suspense>
    <Suspense fallback={<DashboardSkeleton title="Сьогодні" />}><DashboardTodayTasks /></Suspense>
    <div className="grid min-w-0 items-stretch gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Suspense fallback={<DashboardSkeleton title="Склад" />}><DashboardWarehouseAttention /></Suspense>
      <Suspense fallback={<DashboardSkeleton title="Техніка" />}><DashboardEquipmentAttention /></Suspense>
      <div className="h-full md:col-span-2 xl:col-span-1">
        <Suspense fallback={<DashboardObjectWatchlistSkeleton />}><DashboardObjectWatchlist /></Suspense>
      </div>
    </div>
    {activityVisible && <Suspense fallback={<DashboardSkeleton title="Останні дії" />}><DashboardRecentActivity /></Suspense>}
  </div>;
}

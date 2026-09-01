import DashboardAttention from "@/components/dashboard/DashboardAttention";
import DashboardKpis from "@/components/dashboard/DashboardKpis";
import DashboardOperationalOverview from "@/components/dashboard/DashboardOperationalOverview";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardRecent from "@/components/dashboard/DashboardRecent";
import TodayTasksSection from "@/components/dashboard/TodayTasksSection";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getDashboardData,
} from "@/services/dashboardService";

export const dynamic =
  "force-dynamic";

export default async function HomePage() {
  const profile =
    await requireSectionAccess(
      "home"
    );
  const dashboard =
    await getDashboardData(
      profile
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Головна
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Оперативний огляд ViCourt
          </p>
        </div>

        <DashboardQuickActions
          permissions={
            dashboard.permissions
          }
        />
      </header>

      <DashboardKpis
        kpis={dashboard.kpis}
      />

      <DashboardAttention
        attention={
          dashboard.attention
        }
      />

      <TodayTasksSection
        tasks={
          dashboard.todayTasks
        }
        today={dashboard.today}
        canManageSupervision={
          dashboard.permissions
            .canManageSupervision
        }
        canManageEquipment={
          dashboard.permissions
            .canManageEquipment
        }
      />

      <DashboardOperationalOverview
        data={dashboard}
      />

      <DashboardRecent
        nearestTasks={
          dashboard.nearestTasks
        }
        recentObjects={
          dashboard.objects.recent
        }
      />
    </div>
  );
}

import {
  Suspense,
} from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import ObjectTabs, {
  OBJECT_TAB_IDS,
  type ObjectTabId,
} from "@/components/ObjectTabs";
import ObjectActivityTimeline from "@/components/activity/ObjectActivityTimeline";

import ObjectDocuments from "@/components/objects/ObjectDocuments";
import ObjectExpenses from "@/components/objects/ObjectExpenses";
import ObjectPassportHeader from "@/components/objects/ObjectInfo";
import ObjectMaterials from "@/components/objects/ObjectMaterials";
import ObjectOverview from "@/components/objects/ObjectOverview";
import ObjectPayments from "@/components/objects/ObjectPayments";
import ObjectPaymentSchedule from "@/components/objects/ObjectPaymentSchedule";
import ObjectPhotos from "@/components/objects/ObjectPhotos";
import ObjectSummary from "@/components/objects/ObjectSummary";
import ObjectSupervisionCard from "@/components/objects/ObjectSupervisionCard";
import ObjectTabErrorBoundary from "@/components/objects/ObjectTabErrorBoundary";
import ObjectTabPagination from "@/components/objects/ObjectTabPagination";
import ObjectTasks from "@/components/objects/ObjectTasks";
import ObjectWorkLogs from "@/components/objects/ObjectWorkLogs";

import {
  getEmployees,
} from "@/services/employeeService";
import {
  getManagementObject,
  getObject,
  getObjectTasks,
} from "@/services/objectService";
import {
  getManagementObjectCostSummary,
  getManagementObjectMaterialsPage,
  getManagementObjectWorkLogsPage,
  getObjectMaterialsPage,
  getObjectOverviewPreview,
  getObjectPhotosPage,
  getObjectWorkLogsPage,
  type ObjectCostSummary,
} from "@/services/objectDetailService";
import {
  getObjectExpenseTotal,
  getObjectExpenses,
} from "@/services/objectExpenseService";
import {
  getObjectPayments,
} from "@/services/objectPaymentService";
import {
  getObjectPaymentSchedule,
  getObjectPaymentTotals,
} from "@/services/objectPaymentScheduleService";
import {
  getObjectDocumentsPage,
} from "@/services/objectDocumentService";
import {
  getObjectMaterialMovements,
  getManagementWarehouseItems,
} from "@/services/warehouseService";
import { getAppSettings } from "@/services/settingsService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  canManageObjects,
  canManageTasks,
  canViewActivityLog,
  canViewWarehouseLedger,
} from "@/lib/auth/permissions";
import {
  getObjectActivityLogs,
} from "@/services/activityLogService";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  calculateObjectPaymentSummary,
} from "@/lib/objectPayments";
import {
  calculateObjectPaymentSchedule,
} from "@/lib/objectPaymentSchedule";

import type {
  ObjectItem,
} from "@/types/object";
import type {
  ObjectPaymentScheduleItem,
} from "@/types/objectPaymentSchedule";

type SearchParams = {
  tab?: string | string[];
  page?: string | string[];
};

type Props = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

type TabContentProps = {
  activeTab: ObjectTabId;
  page: number;
  object: ObjectItem;
  canManageObject: boolean;
  canManageRecurrence: boolean;
  canViewActivity: boolean;
  canViewLedger: boolean;
};

function getSingleSearchValue(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function resolveObjectTab(
  value: string | undefined,
  canViewFinance: boolean,
  canViewHistory: boolean
): ObjectTabId {
  if (
    !value ||
    !OBJECT_TAB_IDS.includes(
      value as ObjectTabId
    )
  ) {
    return "overview";
  }

  if (
    (value === "finance" &&
      !canViewFinance) ||
    (value === "history" &&
      !canViewHistory)
  ) {
    return "overview";
  }

  return value as ObjectTabId;
}

function resolvePage(
  value: string | undefined
) {
  if (!value || !/^\d+$/u.test(value)) {
    return 1;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

function sumFiniteValues(
  values: unknown[]
) {
  return values.reduce<number>(
    (sum, value) => {
      const numberValue =
        Number(value);

      return (
        sum +
        (Number.isFinite(
          numberValue
        )
          ? numberValue
          : 0)
      );
    },
    0
  );
}

function buildFinanceData(
  object: ObjectItem,
  costs: ObjectCostSummary,
  otherExpensesCost: number,
  paymentAmounts: number[],
  paymentSchedule: ObjectPaymentScheduleItem[],
  today: string
) {
  const paymentSummary =
    calculateObjectPaymentSummary(
      object.client_price ?? null,
      paymentAmounts
    );
  const paymentScheduleSummary =
    calculateObjectPaymentSchedule(
      paymentSchedule,
      paymentSummary.totalPaid,
      object.client_price ?? null,
      today
    );

  return {
    materialsCost:
      costs.materialsCost,
    laborCost: costs.laborCost,
    otherExpensesCost,
    costBudget:
      object.cost_budget ?? null,
    clientPrice:
      object.client_price ?? null,
    paymentSummary,
    paymentScheduleSummary,
  };
}

function ObjectTabLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-w-0 animate-pulse space-y-4"
    >
      <span className="sr-only">
        Завантаження розділу…
      </span>
      <div className="h-28 rounded-xl border bg-gray-50" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl border bg-gray-50" />
        <div className="h-36 rounded-xl border bg-gray-50" />
      </div>
    </div>
  );
}

async function ObjectTabContent({
  activeTab,
  page,
  object,
  canManageObject,
  canManageRecurrence,
  canViewActivity,
  canViewLedger,
}: TabContentProps) {
  const objectId = object.id;
  const today = getKyivDateValue();

  if (activeTab === "overview") {
    const [preview, finance] =
      await Promise.all([
        getObjectOverviewPreview(
          objectId
        ),
        canManageObject
          ? Promise.all([
              getManagementObjectCostSummary(
                objectId
              ),
              getObjectExpenseTotal(
                objectId
              ),
              getObjectPaymentTotals([
                objectId,
              ]),
              getObjectPaymentSchedule(
                objectId
              ),
            ]).then(
              ([
                costs,
                otherExpensesCost,
                paymentTotals,
                paymentSchedule,
              ]) =>
                buildFinanceData(
                  object,
                  costs,
                  otherExpensesCost,
                  [
                    paymentTotals.get(
                      objectId
                    ) || 0,
                  ],
                  paymentSchedule,
                  today
                )
            )
          : Promise.resolve(
              undefined
            ),
      ]);

    return (
      <ObjectOverview
        activeTasks={
          preview.activeTasks
        }
        activeTasksCount={
          preview.activeTasksCount
        }
        materialsCount={
          preview.materialsCount
        }
        totalHours={
          preview.totalHours
        }
        documentsCount={
          preview.documentsCount
        }
        photosCount={
          preview.photosCount
        }
        recentWorkLogs={
          preview.recentWorkLogs
        }
        employees={[]}
        today={today}
        supervision={
          object.status ===
          PERIODIC_SUPERVISION_STATUS ? (
            <ObjectSupervisionCard
              objectId={object.id}
              intervalDays={
                object.supervision_interval_days
              }
              lastDate={
                object.last_supervision_date
              }
              nextDate={
                object.next_supervision_date
              }
              today={today}
              canManage={
                canManageObject
              }
            />
          ) : undefined
        }
        finance={finance}
      />
    );
  }

  if (activeTab === "materials") {
    const [
      materialsPage,
      warehouseItems,
      movements,
      settings,
    ] = await Promise.all([
      canManageObject
        ? getManagementObjectMaterialsPage(
            objectId,
            page
          )
        : getObjectMaterialsPage(
            objectId,
            page
          ),
      canManageObject
        ? getManagementWarehouseItems()
        : Promise.resolve([]),
      canViewLedger
        ? getObjectMaterialMovements(
            objectId
          )
        : Promise.resolve([]),
      getAppSettings(),
    ]);

    return (
      <>
        <ObjectMaterials
          materials={
            materialsPage.items
          }
          totalCount={
            materialsPage.total
          }
          warehouseItems={
            warehouseItems
          }
          objectId={objectId}
          movements={movements}
          currency={
            settings.currency
          }
          canViewLedger={
            canViewLedger
          }
          canManage={
            canManageObject
          }
        />
        <ObjectTabPagination
          objectId={objectId}
          tab="materials"
          page={materialsPage.page}
          pageSize={
            materialsPage.pageSize
          }
          total={materialsPage.total}
          hasPreviousPage={
            materialsPage.hasPreviousPage
          }
          hasNextPage={
            materialsPage.hasNextPage
          }
        />
      </>
    );
  }

  if (activeTab === "work") {
    const [workLogsPage, employees] =
      await Promise.all([
        canManageObject
          ? getManagementObjectWorkLogsPage(
              objectId,
              page
            )
          : getObjectWorkLogsPage(
              objectId,
              page
            ),
        getEmployees(),
      ]);

    return (
      <>
        <ObjectWorkLogs
          workLogs={
            workLogsPage.items
          }
          totalCount={
            workLogsPage.total
          }
          objectId={objectId}
          employees={employees}
          canManage={
            canManageObject
          }
        />
        <ObjectTabPagination
          objectId={objectId}
          tab="work"
          page={workLogsPage.page}
          pageSize={
            workLogsPage.pageSize
          }
          total={workLogsPage.total}
          hasPreviousPage={
            workLogsPage.hasPreviousPage
          }
          hasNextPage={
            workLogsPage.hasNextPage
          }
        />
      </>
    );
  }

  if (activeTab === "tasks") {
    const [tasks, employees] =
      await Promise.all([
        getObjectTasks(objectId),
        getEmployees(),
      ]);

    return (
      <ObjectTasks
        tasks={tasks}
        objectId={objectId}
        employees={employees}
        canManage={
          canManageObject
        }
        canManageRecurrence={
          canManageRecurrence
        }
      />
    );
  }

  if (
    activeTab === "finance" &&
    canManageObject
  ) {
    const [
      costs,
      expenses,
      payments,
      paymentSchedule,
    ] = await Promise.all([
      getManagementObjectCostSummary(
        objectId
      ),
      getObjectExpenses(objectId),
      getObjectPayments(objectId),
      getObjectPaymentSchedule(
        objectId
      ),
    ]);
    const otherExpensesCost =
      sumFiniteValues(
        expenses.map(
          (expense) =>
            expense.amount
        )
      );
    const finance = buildFinanceData(
      object,
      costs,
      otherExpensesCost,
      payments.map(
        (payment) =>
          Number(payment.amount)
      ),
      paymentSchedule,
      today
    );

    return (
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <ObjectSummary
          finance={finance}
        />

        <ObjectPaymentSchedule
          objectId={objectId}
          clientPrice={
            finance.clientPrice
          }
          lifetimeTotalPaid={
            finance.paymentSummary.totalPaid
          }
          scheduleItems={
            paymentSchedule
          }
          today={today}
        />

        <ObjectPayments
          objectId={objectId}
          payments={payments}
          today={today}
        />

        <ObjectExpenses
          expenses={expenses}
          objectId={objectId}
        />
      </div>
    );
  }

  if (activeTab === "documents") {
    const documentsPage =
      await getObjectDocumentsPage(
        objectId,
        page
      );

    return (
      <>
        <ObjectDocuments
          objectId={objectId}
          documents={
            documentsPage.items
          }
          totalCount={
            documentsPage.total
          }
          canManage={
            canManageObject
          }
        />
        <ObjectTabPagination
          objectId={objectId}
          tab="documents"
          page={documentsPage.page}
          pageSize={
            documentsPage.pageSize
          }
          total={documentsPage.total}
          hasPreviousPage={
            documentsPage.hasPreviousPage
          }
          hasNextPage={
            documentsPage.hasNextPage
          }
        />
      </>
    );
  }

  if (activeTab === "photos") {
    const photosPage =
      await getObjectPhotosPage(
        objectId,
        page
      );

    return (
      <>
        <ObjectPhotos
          photos={photosPage.items}
          totalCount={
            photosPage.total
          }
          objectId={objectId}
          canManage={
            canManageObject
          }
        />
        <ObjectTabPagination
          objectId={objectId}
          tab="photos"
          page={photosPage.page}
          pageSize={
            photosPage.pageSize
          }
          total={photosPage.total}
          hasPreviousPage={
            photosPage.hasPreviousPage
          }
          hasNextPage={
            photosPage.hasNextPage
          }
        />
      </>
    );
  }

  if (
    activeTab === "history" &&
    canViewActivity
  ) {
    const activityPage =
      await getObjectActivityLogs(
        objectId
      );

    return (
      <ObjectActivityTimeline
        key={objectId}
        objectId={objectId}
        initialPage={activityPage}
      />
    );
  }

  return null;
}

export default async function ObjectPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, query] =
    await Promise.all([
      params,
      searchParams,
    ]);
  const objectId = Number(id);

  if (
    !Number.isInteger(objectId) ||
    objectId <= 0
  ) {
    notFound();
  }

  const profile =
    await getCurrentUserProfile();
  const canManageObject = profile
    ? canManageObjects(profile.role)
    : false;
  const canViewFinance =
    canManageObject;
  const canViewActivity = profile
    ? canViewActivityLog(
        profile.role
      )
    : false;
  const canManageRecurrence = profile
    ? canManageTasks(profile.role)
    : false;
  const canViewLedger = profile
    ? canViewWarehouseLedger(
        profile.role
      )
    : false;
  const activeTab = resolveObjectTab(
    getSingleSearchValue(query.tab),
    canViewFinance,
    canViewActivity
  );
  const page = resolvePage(
    getSingleSearchValue(query.page)
  );
  const object = canViewFinance
    ? await getManagementObject(
        objectId
      )
    : await getObject(objectId);

  if (!object) {
    notFound();
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      <Link
        href="/objects"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-green-700"
      >
        ← До об’єктів
      </Link>

      <ObjectPassportHeader
        object={object}
        employees={[]}
        canManage={canManageObject}
      />

      <ObjectTabs
        objectId={objectId}
        activeTab={activeTab}
        canViewFinance={
          canViewFinance
        }
        canViewHistory={
          canViewActivity
        }
      >
        <ObjectTabErrorBoundary
          key={`${activeTab}:${page}`}
        >
          <Suspense
            fallback={
              <ObjectTabLoading />
            }
          >
            <ObjectTabContent
              activeTab={activeTab}
              page={page}
              object={object}
              canManageObject={
                canManageObject
              }
              canManageRecurrence={
                canManageRecurrence
              }
              canViewActivity={
                canViewActivity
              }
              canViewLedger={
                canViewLedger
              }
            />
          </Suspense>
        </ObjectTabErrorBoundary>
      </ObjectTabs>
    </div>
  );
}

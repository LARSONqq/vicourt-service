import Link from "next/link";
import { notFound } from "next/navigation";

import ObjectTabs from "@/components/ObjectTabs";
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
import ObjectTasks from "@/components/objects/ObjectTasks";
import ObjectWorkLogs from "@/components/objects/ObjectWorkLogs";

import {
  getEmployees,
  getManagementEmployees,
} from "@/services/employeeService";

import {
  getMaterials,
  getManagementMaterials,
  getManagementObject,
  getManagementWorkLogs,
  getObject,
  getObjectPhotos,
  getObjectTasks,
  getWorkLogs,
} from "@/services/objectService";

import {
  getObjectExpenses,
} from "@/services/objectExpenseService";
import {
  getObjectPayments,
} from "@/services/objectPaymentService";
import {
  getObjectPaymentSchedule,
} from "@/services/objectPaymentScheduleService";
import {
  getObjectDocuments,
} from "@/services/objectDocumentService";

import {
  getObjectMaterialMovements,
  getManagementWarehouseItems,
  getWarehouseItems,
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

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ObjectPage({
  params,
}: Props) {
  const { id } =
    await params;

  const objectId =
    Number(id);

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    notFound();
  }

  const profile =
    await getCurrentUserProfile();
  const canViewPayments =
    profile
      ? canManageObjects(
          profile.role
        )
      : false;
  const canViewActivity =
    profile
      ? canViewActivityLog(
          profile.role
        )
      : false;
  const canManageRecurrence =
    profile
      ? canManageTasks(profile.role)
      : false;
  const canViewLedger =
    profile
      ? canViewWarehouseLedger(
          profile.role
        )
      : false;

  const [
    object,
    tasks,
    materials,
    workLogs,
    photos,
    employees,
    warehouseItems,
    expenses,
    payments,
    paymentSchedule,
    documents,
    activityPage,
    materialMovements,
    settings,
  ] = await Promise.all([
    canViewPayments
      ? getManagementObject(
          objectId
        )
      : getObject(objectId),
    getObjectTasks(objectId),
    canViewPayments
      ? getManagementMaterials(
          objectId
        )
      : getMaterials(objectId),
    canViewPayments
      ? getManagementWorkLogs(
          objectId
        )
      : getWorkLogs(objectId),
    getObjectPhotos(objectId),
    canViewPayments
      ? getManagementEmployees()
      : getEmployees(),
    canViewPayments
      ? getManagementWarehouseItems()
      : getWarehouseItems(),
    canViewPayments
      ? getObjectExpenses(
          objectId
        )
      : Promise.resolve([]),
    canViewPayments
      ? getObjectPayments(
          objectId
        )
      : Promise.resolve([]),
    canViewPayments
      ? getObjectPaymentSchedule(
          objectId
        )
      : Promise.resolve([]),
    getObjectDocuments(
      objectId
    ),
    canViewActivity
      ? getObjectActivityLogs(
          objectId
        )
      : Promise.resolve({
          logs: [],
          nextCursor: null,
        }),
    canViewLedger
      ? getObjectMaterialMovements(
          objectId
        )
      : Promise.resolve([]),
    getAppSettings(),
  ]);

  if (!object) {
    notFound();
  }

  const employeeList =
    Array.isArray(
      employees
    )
      ? employees
      : [];

  const taskList =
    Array.isArray(
      tasks
    )
      ? tasks
      : [];

  const materialList =
    Array.isArray(
      materials
    )
      ? materials
      : [];

  const workLogList =
    Array.isArray(
      workLogs
    )
      ? workLogs
      : [];

  const photoList =
    Array.isArray(
      photos
    )
      ? photos
      : [];

  const warehouseItemList =
    Array.isArray(
      warehouseItems
    )
      ? warehouseItems
      : [];

  const expenseList =
    Array.isArray(
      expenses
    )
      ? expenses
      : [];
  const paymentList =
    Array.isArray(
      payments
    )
      ? payments
      : [];
  const paymentScheduleList =
    Array.isArray(
      paymentSchedule
    )
      ? paymentSchedule
      : [];
  const documentList =
    Array.isArray(
      documents
    )
      ? documents
      : [];

  const activeTaskList =
    taskList
      .filter(
      (task) =>
        task.status !==
        "Виконано"
      )
      .sort(
        (first, second) => {
          const firstDue =
            first.due_date ||
            "9999-12-31";
          const secondDue =
            second.due_date ||
            "9999-12-31";

          return (
            firstDue.localeCompare(
              secondDue
            ) ||
            first.created_at.localeCompare(
              second.created_at
            ) ||
            first.id -
              second.id
          );
        }
      );
  const upcomingTasks =
    activeTaskList.slice(0, 5);
  const recentWorkLogs = [
    ...workLogList,
  ]
    .sort(
      (first, second) =>
        second.work_date.localeCompare(
          first.work_date
        ) ||
        second.created_at.localeCompare(
          first.created_at
        ) ||
        second.id - first.id
    )
    .slice(0, 3);

  const totalHours =
    workLogList.reduce(
      (
        sum,
        workLog
      ) => {
        const hours =
          Number(
            workLog.hours ||
              0
          );

        return (
          sum +
          (
            Number.isFinite(
              hours
            )
              ? hours
              : 0
          )
        );
      },
      0
    );

  const materialsCost =
    materialList.reduce(
      (
        sum,
        material
      ) => {
        const quantity =
          Number(
            material.quantity ||
              0
          );

        const price =
          Number(
            material.price ||
              0
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          !Number.isFinite(
            price
          )
        ) {
          return sum;
        }

        return (
          sum +
          quantity *
            price
        );
      },
      0
    );

  const laborCost =
    workLogList.reduce(
      (
        sum,
        workLog
      ) => {
        const hours =
          Number(
            workLog.hours ||
              0
          );

        const hourlyRate =
          Number(
            workLog.hourly_rate ||
              0
          );

        if (
          !Number.isFinite(
            hours
          ) ||
          !Number.isFinite(
            hourlyRate
          )
        ) {
          return sum;
        }

        return (
          sum +
          hours *
            hourlyRate
        );
      },
      0
    );

  const otherExpensesCost =
    expenseList.reduce(
      (
        sum,
        expense
      ) => {
        const amount =
          Number(
            expense.amount ||
              0
          );

        return (
          sum +
          (
            Number.isFinite(
              amount
            )
              ? amount
              : 0
          )
        );
      },
      0
    );

  const canManageObject =
    profile
      ? canManageObjects(
          profile.role
        )
      : false;
  const paymentSummary =
    canViewPayments
      ? calculateObjectPaymentSummary(
          object.client_price ??
            null,
          paymentList.map(
            (payment) =>
              Number(
                payment.amount
              )
          )
        )
      : undefined;
  const today =
    getKyivDateValue();
  const paymentScheduleSummary =
    canViewPayments &&
    paymentSummary
      ? calculateObjectPaymentSchedule(
          paymentScheduleList,
          paymentSummary.totalPaid,
          object.client_price ??
            null,
          today
        )
      : undefined;
  const financeData =
    canViewPayments &&
    paymentSummary &&
    paymentScheduleSummary
      ? {
          materialsCost,
          laborCost,
          otherExpensesCost,
          costBudget:
            object.cost_budget ??
            null,
          clientPrice:
            object.client_price ??
            null,
          paymentSummary,
          paymentScheduleSummary,
        }
      : undefined;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      {/* BACK */}
      <Link
        href="/objects"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-green-700"
      >
        ← До об’єктів
      </Link>

      <ObjectPassportHeader
        object={object}
        employees={
          canManageObject
            ? employeeList
            : []
        }
        canManage={
          canManageObject
        }
      />

      {/* CONTENT */}
      <ObjectTabs
        overview={
          <ObjectOverview
            activeTasks={
              upcomingTasks
            }
            materialsCount={
              materialList.length
            }
            totalHours={
              totalHours
            }
            documentsCount={
              documentList.length
            }
            photosCount={
              photoList.length
            }
            recentWorkLogs={
              recentWorkLogs
            }
            employees={
              employeeList
            }
            today={today}
            supervision={
              object.status ===
              PERIODIC_SUPERVISION_STATUS ? (
                <ObjectSupervisionCard
                  objectId={
                    object.id
                  }
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
            finance={
              financeData
            }
          />
        }
        tasks={
          <ObjectTasks
            tasks={
              taskList
            }
            objectId={
              object.id
            }
            employees={
              employeeList
            }
            canManage={
              canManageObject
            }
            canManageRecurrence={
              canManageRecurrence
            }
          />
        }
        materials={
          <ObjectMaterials
            materials={
              materialList
            }
            warehouseItems={
              warehouseItemList
            }
            objectId={
              object.id
            }
            movements={
              materialMovements
            }
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
        }
        work={
          <ObjectWorkLogs
            workLogs={
              workLogList
            }
            objectId={
              object.id
            }
            employees={
              employeeList
            }
            canManage={
              canManageObject
            }
          />
        }
        finance={
          financeData ? (
            <div className="min-w-0 space-y-4 sm:space-y-5">
              <ObjectSummary
                finance={
                  financeData
                }
              />

              <ObjectPaymentSchedule
                objectId={
                  object.id
                }
                clientPrice={
                  financeData.clientPrice
                }
                lifetimeTotalPaid={
                  financeData.paymentSummary.totalPaid
                }
                scheduleItems={
                  paymentScheduleList
                }
                today={today}
              />

              <ObjectPayments
                objectId={
                  object.id
                }
                payments={
                  paymentList
                }
                today={today}
              />

              <ObjectExpenses
                expenses={
                  expenseList
                }
                objectId={
                  object.id
                }
              />
            </div>
          ) : undefined
        }
        documents={
          <ObjectDocuments
            objectId={
              object.id
            }
            documents={
              documentList
            }
            canManage={
              canManageObject
            }
          />
        }
        photos={
          <ObjectPhotos
            photos={
              photoList
            }
            objectId={
              object.id
            }
            canManage={
              canManageObject
            }
          />
        }
        history={
          canViewActivity ? (
            <ObjectActivityTimeline
              key={object.id}
              objectId={
                object.id
              }
              initialPage={
                activityPage
              }
            />
          ) : undefined
        }
      />
    </div>
  );
}

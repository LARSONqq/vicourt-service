import Link from "next/link";
import { notFound } from "next/navigation";

import ObjectTabs from "@/components/ObjectTabs";

import DeleteObjectButton from "@/components/objects/DeleteObjectButton";
import ObjectDocuments from "@/components/objects/ObjectDocuments";
import ObjectExpenses from "@/components/objects/ObjectExpenses";
import ObjectInfo from "@/components/objects/ObjectInfo";
import ObjectMaterials from "@/components/objects/ObjectMaterials";
import ObjectPayments from "@/components/objects/ObjectPayments";
import ObjectPaymentSchedule from "@/components/objects/ObjectPaymentSchedule";
import ObjectPhotos from "@/components/objects/ObjectPhotos";
import ObjectSummary from "@/components/objects/ObjectSummary";
import ObjectSupervisionCard from "@/components/objects/ObjectSupervisionCard";
import ObjectTasks from "@/components/objects/ObjectTasks";
import ObjectWorkLogs from "@/components/objects/ObjectWorkLogs";

import { getEmployees } from "@/services/employeeService";

import {
  getMaterials,
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
  getWarehouseItems,
} from "@/services/warehouseService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  calculateObjectPaymentSummary,
} from "@/lib/objectPayments";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function getStatusStyle(
  status: string | null
) {
  switch (status) {
    case "Новий":
      return "bg-blue-100 text-blue-700";

    case "В роботі":
      return "bg-green-100 text-green-700";

    case "На постійному обслуговуванні":
      return "bg-purple-100 text-purple-700";

    case "Під періодичним наглядом":
      return "bg-rose-100 text-rose-700";

    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";

    case "Завершено":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

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
  ] = await Promise.all([
    getObject(objectId),
    getObjectTasks(objectId),
    getMaterials(objectId),
    getWorkLogs(objectId),
    getObjectPhotos(objectId),
    getEmployees(),
    getWarehouseItems(),
    getObjectExpenses(objectId),
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

  const activeTasks =
    taskList.filter(
      (task) =>
        task.status !==
        "Виконано"
    ).length;

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
          object.client_price,
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

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      {/* BACK */}
      <Link
        href="/objects"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-green-700"
      >
        ← До об’єктів
      </Link>

      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-bold text-gray-900 sm:text-3xl">
              {object.name}
            </h1>

            <span
              className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:hidden ${getStatusStyle(
                object.status
              )}`}
            >
              {object.status ||
                "Без статусу"}
            </span>
          </div>

          <p className="mt-2 break-words text-sm text-gray-500 sm:text-base">
            {object.address ||
              "Адресу не вказано"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`hidden rounded-full px-4 py-2 text-sm font-medium sm:inline-flex ${getStatusStyle(
              object.status
            )}`}
          >
            {object.status ||
              "Без статусу"}
          </span>

          <DeleteObjectButton
            objectId={
              object.id
            }
            objectName={
              object.name
            }
          />
        </div>
      </div>

      {object.status ===
        PERIODIC_SUPERVISION_STATUS && (
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
          today={
            today
          }
          canManage={
            canManageObject
          }
        />
      )}

      {/* SUMMARY */}
      <ObjectSummary
        activeTasks={
          activeTasks
        }
        materialsCount={
          materialList.length
        }
        totalHours={
          totalHours
        }
        photosCount={
          photoList.length
        }
        materialsCost={
          materialsCost
        }
        laborCost={
          laborCost
        }
        otherExpensesCost={
          otherExpensesCost
        }
        costBudget={
          object.cost_budget
        }
        clientPrice={
          object.client_price
        }
        paymentSummary={
          paymentSummary
        }
      />

      {canViewPayments && (
        <>
          <ObjectPaymentSchedule
            objectId={object.id}
            clientPrice={
              object.client_price
            }
            lifetimeTotalPaid={
              paymentSummary
                ?.totalPaid ?? 0
            }
            scheduleItems={
              paymentScheduleList
            }
            today={today}
          />

          <ObjectPayments
            objectId={object.id}
            payments={paymentList}
            today={today}
          />
        </>
      )}

      {/* CONTENT */}
      <ObjectTabs
        info={
          <ObjectInfo
            object={
              object
            }
            employees={
              employeeList
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
          />
        }
        journal={
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
          />
        }
        expenses={
          <ObjectExpenses
            expenses={
              expenseList
            }
            objectId={
              object.id
            }
          />
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
          />
        }
      />
    </div>
  );
}

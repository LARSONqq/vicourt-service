import Link from "next/link";
import { notFound } from "next/navigation";

import ObjectTabs from "@/components/ObjectTabs";
import DeleteObjectButton from "@/components/objects/DeleteObjectButton";
import ObjectInfo from "@/components/objects/ObjectInfo";
import ObjectMaterials from "@/components/objects/ObjectMaterials";
import ObjectPhotos from "@/components/objects/ObjectPhotos";
import ObjectSummary from "@/components/objects/ObjectSummary";
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

import { getWarehouseItems } from "@/services/warehouseService";

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
  const { id } = await params;

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

  const [
    object,
    tasks,
    materials,
    workLogs,
    photos,
    employees,
    warehouseItems,
  ] = await Promise.all([
    getObject(objectId),
    getObjectTasks(objectId),
    getMaterials(objectId),
    getWorkLogs(objectId),
    getObjectPhotos(objectId),
    getEmployees(),
    getWarehouseItems(),
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
      ) =>
        sum +
        Number(
          workLog.hours ||
            0
        ),
      0
    );

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
      />

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
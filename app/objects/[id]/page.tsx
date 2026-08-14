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

export default async function ObjectPage({
  params,
}: Props) {
  const { id } = await params;
  const objectId = Number(id);

  if (
    !Number.isInteger(objectId) ||
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

  const employeeList = Array.isArray(
    employees
  )
    ? employees
    : [];

  const taskList = Array.isArray(tasks)
    ? tasks
    : [];

  const materialList = Array.isArray(
    materials
  )
    ? materials
    : [];

  const workLogList = Array.isArray(
    workLogs
  )
    ? workLogs
    : [];

  const photoList = Array.isArray(photos)
    ? photos
    : [];

  const warehouseItemList =
    Array.isArray(warehouseItems)
      ? warehouseItems
      : [];

  const activeTasks = taskList.filter(
    (task) =>
      task.status !== "Виконано"
  ).length;

  const totalHours = workLogList.reduce(
    (sum, workLog) =>
      sum +
      Number(workLog.hours || 0),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {object.name}
          </h1>

          <p className="mt-1 text-gray-500">
            {object.address ||
              "Адресу не вказано"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            {object.status ||
              "Без статусу"}
          </span>

          <DeleteObjectButton
            objectId={object.id}
            objectName={object.name}
          />
        </div>
      </div>

      <ObjectSummary
        activeTasks={activeTasks}
        materialsCount={
          materialList.length
        }
        totalHours={totalHours}
        photosCount={photoList.length}
      />

      <ObjectTabs
        info={
          <ObjectInfo
            object={object}
            employees={employeeList}
          />
        }
        tasks={
          <ObjectTasks
            tasks={taskList}
            objectId={object.id}
            employees={employeeList}
          />
        }
        materials={
          <ObjectMaterials
            materials={materialList}
            warehouseItems={
              warehouseItemList
            }
            objectId={object.id}
          />
        }
        journal={
          <ObjectWorkLogs
            workLogs={workLogList}
            objectId={object.id}
            employees={employeeList}
          />
        }
        photos={
          <ObjectPhotos
            photos={photoList}
            objectId={object.id}
          />
        }
      />
    </div>
  );
}
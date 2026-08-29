import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import TasksList from "@/components/tasks/TasksList";

import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";
import { getObjects } from "@/services/objectService";
import { getCurrentUserProfile } from "@/services/profileService";
import { getAllTasks } from "@/services/taskService";
import {
  canManageEquipment,
  canManageObjects,
} from "@/lib/auth/permissions";

export default async function TasksPage() {
  const [
    tasks,
    objects,
    employees,
    equipment,
    profile,
  ] = await Promise.all([
    getAllTasks(),
    getObjects(),
    getEmployees(),
    getEquipment(),
    getCurrentUserProfile(),
  ]);

  const canManageSupervision =
    profile
      ? canManageObjects(
          profile.role
        )
      : false;
  const canManageMaintenance =
    profile
      ? canManageEquipment(profile.role)
      : false;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Завдання
        </h1>

        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          Загальний список завдань по
          об’єктах і техніці
        </p>
      </div>

      {/* NEW TASK */}
      <div className="min-w-0">
        <AddGlobalTaskForm
          objects={objects}
          equipment={equipment}
          employees={employees}
        />
      </div>

      {/* TASK LIST */}
      <div className="min-w-0">
        <TasksList
          tasks={tasks}
          employees={employees}
          objects={objects}
          equipment={equipment}
          canManageSupervision={
            canManageSupervision
          }
          canManageEquipment={
            canManageMaintenance
          }
        />
      </div>
    </div>
  );
}

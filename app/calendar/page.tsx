import WeeklyTaskCalendar from "@/components/calendar/WeeklyTaskCalendar";

import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";
import { getObjects } from "@/services/objectService";
import { getCurrentUserProfile } from "@/services/profileService";
import { getAllTasks } from "@/services/taskService";
import {
  canManageEquipment,
  canManageObjects,
} from "@/lib/auth/permissions";

export default async function CalendarPage() {
  const [
    tasks,
    employees,
    objects,
    equipment,
    profile,
  ] = await Promise.all([
    getAllTasks(),
    getEmployees(),
    getObjects(),
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

  const taskList =
    Array.isArray(tasks)
      ? tasks
      : [];

  const employeeList =
    Array.isArray(employees)
      ? employees
      : [];

  const objectList =
    Array.isArray(objects)
      ? objects
      : [];
  const equipmentList =
    Array.isArray(equipment)
      ? equipment
      : [];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Календар завдань
        </h1>

        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          Тижневий план робіт команди
        </p>
      </div>

      {/* CALENDAR */}
      <div className="min-w-0">
        <WeeklyTaskCalendar
          tasks={taskList}
          employees={employeeList}
          objects={objectList}
          equipment={equipmentList}
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

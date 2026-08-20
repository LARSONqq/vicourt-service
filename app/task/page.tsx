import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import TasksList from "@/components/tasks/TasksList";

import { getEmployees } from "@/services/employeeService";
import { getObjects } from "@/services/objectService";
import { getAllTasks } from "@/services/taskService";

export default async function TasksPage() {
  const [
    tasks,
    objects,
    employees,
  ] = await Promise.all([
    getAllTasks(),
    getObjects(),
    getEmployees(),
  ]);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Завдання
        </h1>

        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          Загальний список завдань по
          всіх об’єктах
        </p>
      </div>

      {/* NEW TASK */}
      <div className="min-w-0">
        <AddGlobalTaskForm
          objects={objects}
          employees={employees}
        />
      </div>

      {/* TASK LIST */}
      <div className="min-w-0">
        <TasksList
          tasks={tasks}
          employees={employees}
        />
      </div>
    </div>
  );
}
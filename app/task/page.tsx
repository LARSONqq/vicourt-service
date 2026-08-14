import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import TasksList from "@/components/tasks/TasksList";
import { getEmployees } from "@/services/employeeService";
import { getObjects } from "@/services/objectService";
import { getAllTasks } from "@/services/taskService";

export default async function TasksPage() {
  const [tasks, objects, employees] =
    await Promise.all([
      getAllTasks(),
      getObjects(),
      getEmployees(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Завдання
        </h1>

        <p className="mt-1 text-gray-500">
          Загальний список завдань по всіх
          об’єктах
        </p>
      </div>

      <AddGlobalTaskForm
        objects={objects}
        employees={employees}
      />

      <TasksList
        tasks={tasks}
        employees={employees}
      />
    </div>
  );
}
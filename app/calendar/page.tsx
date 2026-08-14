import WeeklyTaskCalendar from "@/components/calendar/WeeklyTaskCalendar";
import { getEmployees } from "@/services/employeeService";
import { getObjects } from "@/services/objectService";
import { getAllTasks } from "@/services/taskService";

export default async function CalendarPage() {
  const [tasks, employees, objects] =
    await Promise.all([
      getAllTasks(),
      getEmployees(),
      getObjects(),
    ]);

  const taskList = Array.isArray(tasks)
    ? tasks
    : [];

  const employeeList = Array.isArray(employees)
    ? employees
    : [];

  const objectList = Array.isArray(objects)
    ? objects
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Календар завдань
        </h1>

        <p className="mt-1 text-gray-500">
          Тижневий план робіт команди
        </p>
      </div>

      <WeeklyTaskCalendar
        tasks={taskList}
        employees={employeeList}
        objects={objectList}
      />
    </div>
  );
}
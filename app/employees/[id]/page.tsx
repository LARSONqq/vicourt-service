import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";

import {
  getEmployeeWorkLogs,
  getObjects,
} from "@/services/objectService";

import { getAllTasks } from "@/services/taskService";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(
  date: string | null
) {
  if (!date) {
    return "Не вказано";
  }

  return new Intl.DateTimeFormat(
    "uk-UA"
  ).format(
    new Date(
      `${date}T00:00:00`
    )
  );
}

function formatHours(
  hours: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 1,
    }
  ).format(hours);
}

function getEmployeeStatusClasses(
  status: string
) {
  switch (status) {
    case "Активний":
      return "bg-green-50 text-green-700";

    case "У відпустці":
      return "bg-blue-50 text-blue-700";

    case "На лікарняному":
      return "bg-orange-50 text-orange-700";

    case "Звільнений":
      return "bg-red-50 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getTaskStatusClasses(
  status: string
) {
  switch (status) {
    case "Заплановано":
      return "bg-blue-50 text-blue-700";

    case "В роботі":
      return "bg-yellow-50 text-yellow-700";

    case "Виконано":
      return "bg-green-50 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default async function EmployeePage({
  params,
}: Props) {
  await requireSectionAccess(
    "employees"
  );

  const { id } =
    await params;

  const employeeId =
    Number(id);

  if (
    !Number.isInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    notFound();
  }

  const [
    employees,
    tasks,
    objects,
    equipment,
    workLogs,
  ] = await Promise.all([
    getEmployees(),
    getAllTasks(),
    getObjects(),
    getEquipment(),
    getEmployeeWorkLogs(
      employeeId
    ),
  ]);

  const employee =
    employees.find(
      (item) =>
        Number(item.id) ===
        employeeId
    );

  if (!employee) {
    notFound();
  }

  const employeeTasks =
    tasks.filter(
      (task) =>
        Number(
          task.assigned_employee_id
        ) === employeeId
    );

  const activeTasks =
    employeeTasks.filter(
      (task) =>
        task.status !==
        "Виконано"
    );

  const completedTasks =
    employeeTasks.filter(
      (task) =>
        task.status ===
        "Виконано"
    );

  const employeeObjects =
    objects.filter(
      (object) =>
        Number(
          object.responsible_employee_id
        ) === employeeId
    );

  const employeeEquipment =
    equipment.filter(
      (item) =>
        Number(
          item.responsible_employee_id
        ) === employeeId
    );

  const totalHours =
    workLogs.reduce(
      (sum, workLog) =>
        sum +
        Number(
          workLog.hours || 0
        ),
      0
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <Link
          href="/employees"
          className="inline-flex min-h-10 items-center text-sm font-medium text-green-700 hover:underline"
        >
          ← Назад до працівників
        </Link>

        <div className="mt-3 flex min-w-0 flex-col gap-4 rounded-xl border bg-white p-4 sm:mt-4 sm:p-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">
              {
                employee.last_name
              }{" "}
              {
                employee.first_name
              }
            </h1>

            <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
              {employee.position ||
                "Посаду не вказано"}
            </p>
          </div>

          <span
            className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-sm font-medium sm:px-4 sm:py-2 ${getEmployeeStatusClasses(
              employee.status
            )}`}
          >
            {
              employee.status
            }
          </span>
        </div>
      </div>

      {/* STATS */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Активні завдання
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
            {
              activeTasks.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Виконані завдання
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
            {
              completedTasks.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Відпрацьовано годин
          </p>

          <p className="mt-2 text-2xl font-bold text-purple-700 sm:text-3xl">
            {formatHours(
              totalHours
            )}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Записів у журналі
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {workLogs.length}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Об’єкти
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {
              employeeObjects.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Закріплена техніка
          </p>

          <p className="mt-2 text-2xl font-bold text-orange-600 sm:text-3xl">
            {
              employeeEquipment.length
            }
          </p>
        </div>
      </section>

      {/* INFO */}
      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Інформація
        </h2>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 sm:text-sm">
              Телефон
            </p>

            {employee.phone ? (
              <a
                href={`tel:${employee.phone}`}
                className="mt-1 block break-all font-medium text-green-700 hover:underline"
              >
                {
                  employee.phone
                }
              </a>
            ) : (
              <p className="mt-1 font-medium text-gray-800">
                Не вказано
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-500 sm:text-sm">
              Email
            </p>

            {employee.email ? (
              <a
                href={`mailto:${employee.email}`}
                className="mt-1 block break-all font-medium text-green-700 hover:underline"
              >
                {
                  employee.email
                }
              </a>
            ) : (
              <p className="mt-1 font-medium text-gray-800">
                Не вказано
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-500 sm:text-sm">
              Тип роботи
            </p>

            <p className="mt-1 break-words font-medium text-gray-800">
              {employee.employment_type ||
                "Не вказано"}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-500 sm:text-sm">
              Дата прийняття
            </p>

            <p className="mt-1 font-medium text-gray-800">
              {formatDate(
                employee.hire_date
              )}
            </p>
          </div>
        </div>

        {employee.notes && (
          <div className="mt-5 min-w-0 border-t pt-4 sm:mt-6 sm:pt-5">
            <p className="text-xs text-gray-500 sm:text-sm">
              Примітки
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 sm:text-base">
              {
                employee.notes
              }
            </p>
          </div>
        )}
      </section>

      {/* WORK LOGS */}
      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
        <div className="mb-4 sm:mb-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Історія виконаних робіт
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Роботи, записані в
            журналах об’єктів
          </p>
        </div>

        {workLogs.length ===
        0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center sm:p-8">
            <p className="text-sm text-gray-500 sm:text-base">
              Записів про виконані
              роботи немає.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {workLogs.map(
              (workLog) => (
                <article
                  key={
                    workLog.id
                  }
                  className="min-w-0 rounded-xl border p-4 sm:p-5"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {formatDate(
                          workLog.work_date
                        )}
                      </p>

                      {workLog.object ? (
                        <Link
                          href={`/objects/${workLog.object.id}`}
                          className="mt-1 inline-block break-words text-sm font-medium text-green-700 hover:underline"
                        >
                          {
                            workLog
                              .object
                              .name
                          }
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">
                          Об’єкт не
                          знайдено
                        </p>
                      )}
                    </div>

                    <span className="w-fit shrink-0 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                      {formatHours(
                        Number(
                          workLog.hours ||
                            0
                        )
                      )}{" "}
                      год.
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 sm:text-base">
                    {
                      workLog.description
                    }
                  </p>
                </article>
              )
            )}
          </div>
        )}
      </section>

      {/* ACTIVE TASKS */}
      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Активні завдання
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Поточні завдання
              працівника
            </p>
          </div>

          <Link
            href="/task"
            className="flex min-h-10 w-full items-center justify-center rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 sm:w-fit sm:border-0 sm:bg-transparent sm:p-0 sm:hover:bg-transparent sm:hover:underline"
          >
            Відкрити всі завдання
          </Link>
        </div>

        {activeTasks.length ===
        0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm text-gray-500 sm:text-base">
              Активних завдань немає.
            </p>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
            {activeTasks.map(
              (task) => (
                <article
                  key={
                    task.id
                  }
                  className="min-w-0 rounded-xl border p-4 sm:p-5"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-gray-900">
                        {
                          task.title
                        }
                      </h3>

                      {task.object && (
                        <Link
                          href={`/objects/${task.object.id}`}
                          className="mt-1 block break-words text-sm text-green-700 hover:underline"
                        >
                          {
                            task.object
                              .name
                          }
                        </Link>
                      )}
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusClasses(
                        task.status
                      )}`}
                    >
                      {
                        task.status
                      }
                    </span>
                  </div>

                  {task.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
                      {
                        task.description
                      }
                    </p>
                  )}

                  <p className="mt-4 border-t pt-3 text-sm text-gray-500">
                    Термін:{" "}
                    <span className="font-medium text-gray-700">
                      {formatDate(
                        task.due_date
                      )}
                    </span>
                  </p>
                </article>
              )
            )}
          </div>
        )}
      </section>

      {/* OBJECTS + EQUIPMENT */}
      <section className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        {/* OBJECTS */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Об’єкти
          </h2>

          {employeeObjects.length ===
          0 ? (
            <div className="mt-4 rounded-xl border border-dashed p-5 text-center sm:mt-5">
              <p className="text-sm text-gray-500 sm:text-base">
                Закріплених об’єктів
                немає.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 sm:mt-5">
              {employeeObjects.map(
                (object) => (
                  <Link
                    key={
                      object.id
                    }
                    href={`/objects/${object.id}`}
                    className="block min-w-0 rounded-lg border p-3 transition hover:border-green-300 hover:bg-green-50 sm:p-4"
                  >
                    <p className="break-words font-medium text-gray-900">
                      {
                        object.name
                      }
                    </p>

                    <p className="mt-1 break-words text-sm text-gray-500">
                      {object.address ||
                        "Адресу не вказано"}
                    </p>
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        {/* EQUIPMENT */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Закріплена техніка
          </h2>

          {employeeEquipment.length ===
          0 ? (
            <div className="mt-4 rounded-xl border border-dashed p-5 text-center sm:mt-5">
              <p className="text-sm text-gray-500 sm:text-base">
                Закріпленої техніки
                немає.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 sm:mt-5">
              {employeeEquipment.map(
                (item) => (
                  <div
                    key={item.id}
                    className="min-w-0 rounded-lg border p-3 sm:p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-gray-900">
                          {
                            item.name
                          }
                        </p>

                        <p className="mt-1 break-all text-sm text-gray-500">
                          {item.inventory_number ||
                            "Без інвентарного номера"}
                        </p>
                      </div>

                      <span className="w-fit shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {
                          item.status
                        }
                      </span>
                    </div>

                    {item.location && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs text-gray-500">
                          Локація
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-700">
                          {
                            item.location
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
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
    <div className="space-y-6">
      <div>
        <Link
          href="/employees"
          className="text-sm font-medium text-green-700 hover:underline"
        >
          ← Назад до працівників
        </Link>

        <div className="mt-4 flex flex-col gap-4 rounded-xl border bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {
                employee.last_name
              }{" "}
              {
                employee.first_name
              }
            </h1>

            <p className="mt-1 text-gray-500">
              {employee.position ||
                "Посаду не вказано"}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-medium ${getEmployeeStatusClasses(
              employee.status
            )}`}
          >
            {
              employee.status
            }
          </span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Активні завдання
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-700">
            {
              activeTasks.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Виконані завдання
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {
              completedTasks.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Відпрацьовано годин
          </p>

          <p className="mt-2 text-3xl font-bold text-purple-700">
            {formatHours(
              totalHours
            )}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Записів у журналі
          </p>

          <p className="mt-2 text-3xl font-bold">
            {workLogs.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Об’єкти
          </p>

          <p className="mt-2 text-3xl font-bold">
            {
              employeeObjects.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Закріплена техніка
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            {
              employeeEquipment.length
            }
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">
          Інформація
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">
              Телефон
            </p>

            {employee.phone ? (
              <a
                href={`tel:${employee.phone}`}
                className="mt-1 block font-medium text-green-700 hover:underline"
              >
                {
                  employee.phone
                }
              </a>
            ) : (
              <p className="mt-1 font-medium">
                Не вказано
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">
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
              <p className="mt-1 font-medium">
                Не вказано
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Тип роботи
            </p>

            <p className="mt-1 font-medium">
              {employee.employment_type ||
                "Не вказано"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Дата прийняття
            </p>

            <p className="mt-1 font-medium">
              {formatDate(
                employee.hire_date
              )}
            </p>
          </div>
        </div>

        {employee.notes && (
          <div className="mt-6 border-t pt-5">
            <p className="text-sm text-gray-500">
              Примітки
            </p>

            <p className="mt-2 whitespace-pre-wrap">
              {
                employee.notes
              }
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            Історія виконаних робіт
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Роботи, записані в
            журналах об’єктів
          </p>
        </div>

        {workLogs.length ===
        0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-gray-500">
              Записів про виконані
              роботи немає.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {workLogs.map(
              (workLog) => (
                <article
                  key={
                    workLog.id
                  }
                  className="rounded-xl border p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {formatDate(
                          workLog.work_date
                        )}
                      </p>

                      {workLog.object ? (
                        <Link
                          href={`/objects/${workLog.object.id}`}
                          className="mt-1 inline-block text-sm font-medium text-green-700 hover:underline"
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

                    <span className="w-fit rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                      {formatHours(
                        Number(
                          workLog.hours ||
                            0
                        )
                      )}{" "}
                      год.
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-gray-700">
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

      <section className="rounded-xl border bg-white p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Активні завдання
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Поточні завдання
              працівника
            </p>
          </div>

          <Link
            href="/task"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Відкрити всі завдання
          </Link>
        </div>

        {activeTasks.length ===
        0 ? (
          <p className="text-gray-500">
            Активних завдань немає.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeTasks.map(
              (task) => (
                <article
                  key={task.id}
                  className="rounded-xl border p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {
                          task.title
                        }
                      </h3>

                      {task.object && (
                        <Link
                          href={`/objects/${task.object.id}`}
                          className="mt-1 block text-sm text-green-700 hover:underline"
                        >
                          {
                            task.object
                              .name
                          }
                        </Link>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusClasses(
                        task.status
                      )}`}
                    >
                      {
                        task.status
                      }
                    </span>
                  </div>

                  {task.description && (
                    <p className="mt-3 text-sm text-gray-600">
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-xl font-semibold">
            Об’єкти
          </h2>

          {employeeObjects.length ===
          0 ? (
            <p className="mt-5 text-gray-500">
              Закріплених об’єктів
              немає.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {employeeObjects.map(
                (object) => (
                  <Link
                    key={
                      object.id
                    }
                    href={`/objects/${object.id}`}
                    className="block rounded-lg border p-4 hover:border-green-300 hover:bg-green-50"
                  >
                    <p className="font-medium">
                      {
                        object.name
                      }
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {object.address ||
                        "Адресу не вказано"}
                    </p>
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-xl font-semibold">
            Закріплена техніка
          </h2>

          {employeeEquipment.length ===
          0 ? (
            <p className="mt-5 text-gray-500">
              Закріпленої техніки
              немає.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {employeeEquipment.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {
                            item.name
                          }
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {item.inventory_number ||
                            "Без інвентарного номера"}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {
                          item.status
                        }
                      </span>
                    </div>

                    {item.location && (
                      <p className="mt-3 text-sm text-gray-500">
                        Локація:{" "}
                        <span className="font-medium text-gray-700">
                          {
                            item.location
                          }
                        </span>
                      </p>
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
"use client";

import Link from "next/link";
import {
  Fragment,
  useMemo,
  useState,
} from "react";
import { deleteWorkLog } from "@/app/actions/workLogActions";
import type { Employee } from "@/types/employee";
import type { WorkLog } from "@/types/workLog";
import AddWorkLogForm from "./AddWorkLogForm";
import EditWorkLogForm from "./EditWorkLogForm";

type WorkLogWithEmployee = WorkLog & {
  employee_id?: number | null;
};

type Props = {
  workLogs: WorkLogWithEmployee[];
  objectId: number;
  employees?: Employee[];
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");

  return `${day}.${month}.${year}`;
}

export default function ObjectWorkLogs({
  workLogs,
  objectId,
  employees = [],
}: Props) {
  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const employeesById = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ])
    );
  }, [employees]);

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Журнал робіт
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Історія виконаних робіт на об’єкті
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) => !previous
            )
          }
          className="w-fit rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
        >
          {showForm
            ? "Закрити"
            : "+ Додати запис"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-gray-50 p-4">
          <AddWorkLogForm
            objectId={objectId}
            employees={employees}
          />
        </div>
      )}

      {workLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-gray-500">
            Записів поки що немає.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workLogs.map((workLog) => {
            const employee =
              workLog.employee_id
                ? employeesById.get(
                    Number(
                      workLog.employee_id
                    )
                  )
                : undefined;

            return (
              <Fragment key={workLog.id}>
                <article className="rounded-xl border p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {formatDate(
                          workLog.work_date
                        )}
                      </p>

                      {Number(workLog.hours) >
                        0 && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                          {workLog.hours} год.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(
                            editingId ===
                              workLog.id
                              ? null
                              : workLog.id
                          )
                        }
                        className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Редагувати
                      </button>

                      <form
                        action={deleteWorkLog.bind(
                          null,
                          workLog.id,
                          objectId
                        )}
                        onSubmit={(event) => {
                          const confirmed =
                            window.confirm(
                              "Видалити цей запис із журналу?"
                            );

                          if (!confirmed) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Видалити
                        </button>
                      </form>
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-gray-800">
                    {workLog.description}
                  </p>

                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Працівник
                    </p>

                    {employee ? (
                      <Link
                        href={`/employees/${employee.id}`}
                        className="mt-1 inline-block font-medium text-green-700 hover:underline"
                      >
                        {employee.last_name}{" "}
                        {employee.first_name}
                      </Link>
                    ) : workLog.workers ? (
                      <p className="mt-1 font-medium text-gray-700">
                        {workLog.workers}
                      </p>
                    ) : (
                      <p className="mt-1 text-gray-400">
                        Не вказано
                      </p>
                    )}
                  </div>
                </article>

                {editingId ===
                  workLog.id && (
                  <EditWorkLogForm
                    workLog={workLog}
                    objectId={objectId}
                    employees={employees}
                    onCancel={() =>
                      setEditingId(null)
                    }
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
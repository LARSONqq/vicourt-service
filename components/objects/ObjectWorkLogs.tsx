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

type WorkLogWithEmployee =
  WorkLog & {
    employee_id?: number | null;
  };

type Props = {
  workLogs: WorkLogWithEmployee[];
  objectId: number;
  employees?: Employee[];
};

function formatDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] = date.split("-");

  return `${day}.${month}.${year}`;
}

export default function ObjectWorkLogs({
  workLogs,
  objectId,
  employees = [],
}: Props) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const employeesById =
    useMemo(() => {
      return new Map(
        employees.map(
          (employee) => [
            employee.id,
            employee,
          ]
        )
      );
    }, [employees]);

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold sm:text-xl">
            Журнал робіт
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Історія виконаних робіт
            на об’єкті
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Записів:{" "}
            {workLogs.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) =>
                !previous
            )
          }
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm
            ? "Закрити форму"
            : "+ Додати запис"}
        </button>
      </div>

      {/* ADD FORM */}
      {showForm && (
        <div className="mb-5 min-w-0 rounded-xl border bg-gray-50 p-3 sm:mb-6 sm:p-4">
          <AddWorkLogForm
            objectId={
              objectId
            }
            employees={
              employees
            }
          />
        </div>
      )}

      {/* EMPTY */}
      {workLogs.length ===
      0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400">
            📝
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Записів поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Додай перший запис про
            виконані роботи.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {workLogs.map(
            (workLog) => {
              const employee =
                workLog.employee_id
                  ? employeesById.get(
                      Number(
                        workLog.employee_id
                      )
                    )
                  : undefined;

              return (
                <Fragment
                  key={
                    workLog.id
                  }
                >
                  <article className="min-w-0 rounded-xl border p-4 sm:p-5">
                    {/* DATE / HOURS */}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {formatDate(
                          workLog.work_date
                        )}
                      </p>

                      {Number(
                        workLog.hours
                      ) > 0 && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 sm:text-sm">
                          {
                            workLog.hours
                          }{" "}
                          год.
                        </span>
                      )}
                    </div>

                    {/* DESCRIPTION */}
                    <div className="mt-4">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 sm:text-base">
                        {
                          workLog.description
                        }
                      </p>
                    </div>

                    {/* EMPLOYEE */}
                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Працівник
                      </p>

                      {employee ? (
                        <Link
                          href={`/employees/${employee.id}`}
                          className="mt-1 inline-block break-words font-medium text-green-700 hover:underline"
                        >
                          {
                            employee.last_name
                          }{" "}
                          {
                            employee.first_name
                          }
                        </Link>
                      ) : workLog.workers ? (
                        <p className="mt-1 break-words font-medium text-gray-700">
                          {
                            workLog.workers
                          }
                        </p>
                      ) : (
                        <p className="mt-1 text-gray-400">
                          Не вказано
                        </p>
                      )}
                    </div>

                    {/* ACTIONS */}
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end">
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
                        className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          editingId ===
                          workLog.id
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "text-blue-600 hover:bg-blue-50"
                        }`}
                      >
                        {editingId ===
                        workLog.id
                          ? "Закрити"
                          : "Редагувати"}
                      </button>

                      <form
                        action={deleteWorkLog.bind(
                          null,
                          workLog.id,
                          objectId
                        )}
                        onSubmit={(
                          event
                        ) => {
                          const confirmed =
                            window.confirm(
                              "Видалити цей запис із журналу?"
                            );

                          if (
                            !confirmed
                          ) {
                            event.preventDefault();
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        <button
                          type="submit"
                          className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
                        >
                          Видалити
                        </button>
                      </form>
                    </div>
                  </article>

                  {/* EDIT FORM */}
                  {editingId ===
                    workLog.id && (
                    <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:p-4">
                      <EditWorkLogForm
                        workLog={
                          workLog
                        }
                        objectId={
                          objectId
                        }
                        employees={
                          employees
                        }
                        onCancel={() =>
                          setEditingId(
                            null
                          )
                        }
                      />
                    </div>
                  )}
                </Fragment>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
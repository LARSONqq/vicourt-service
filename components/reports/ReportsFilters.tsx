import Link from "next/link";

import {
  objectExpenseCategories,
} from "@/constants/objectExpenses";

import type {
  ReportEmployeeOption,
  ReportObjectOption,
  ReportsFilters,
} from "@/types/report";

type Props = {
  filters: ReportsFilters;
  objects: ReportObjectOption[];
  employees:
    ReportEmployeeOption[];
};

export default function ReportsFilters({
  filters,
  objects,
  employees,
}: Props) {
  return (
    <section className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900">
          Фільтри звіту
        </h2>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          Вибрані параметри
          зберігаються в адресі
          сторінки та не втрачаються
          після оновлення.
        </p>
      </div>

      <form
        method="get"
        className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      >
        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Дата від
          </label>

          <input
            type="date"
            name="from"
            defaultValue={
              filters.dateFrom
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Дата до
          </label>

          <input
            type="date"
            name="to"
            defaultValue={
              filters.dateTo
            }
            min={
              filters.dateFrom
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Об’єкт
          </label>

          <select
            name="object"
            defaultValue={
              filters.objectId
                ? String(
                    filters.objectId
                  )
                : ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі об’єкти
            </option>

            {objects.map(
              (object) => (
                <option
                  key={object.id}
                  value={
                    object.id
                  }
                >
                  {object.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Працівник
          </label>

          <select
            name="employee"
            defaultValue={
              filters.employeeId
                ? String(
                    filters.employeeId
                  )
                : ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі працівники
            </option>

            {employees.map(
              (employee) => (
                <option
                  key={
                    employee.id
                  }
                  value={
                    employee.id
                  }
                >
                  {employee.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Категорія витрат
          </label>

          <select
            name="expense_category"
            defaultValue={
              filters.expenseCategory ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі категорії
            </option>

            {objectExpenseCategories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Рух складу
          </label>

          <select
            name="movement_type"
            defaultValue={
              filters.movementType ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі рухи
            </option>

            <option value="Прихід">
              Прихід
            </option>

            <option value="Списання">
              Списання
            </option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 xl:col-span-3 2xl:col-span-6 2xl:flex 2xl:justify-end">
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-green-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-green-700 2xl:min-w-40"
          >
            Застосувати
          </button>

          <Link
            href="/reports"
            className="flex min-h-11 items-center justify-center rounded-lg border bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 2xl:min-w-40"
          >
            Скинути фільтри
          </Link>
        </div>
      </form>

      {filters.employeeId && (
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700 sm:text-sm">
          Фільтр працівника
          застосовується до годин і
          вартості робіт. Матеріали,
          інші витрати та закупівлі не
          приписуються конкретному
          працівнику.
        </p>
      )}
    </section>
  );
}

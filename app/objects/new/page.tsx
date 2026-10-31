import { createObject } from "@/app/actions/objectActions";
import NewObjectStatusFields from "@/components/objects/NewObjectStatusFields";
import { getEmployees } from "@/services/employeeService";

export default async function NewObjectPage() {
  const employees = await getEmployees();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-medium text-green-700">Новий робочий простір</p>
        <h1 className="vc-page-title mt-1">
          Новий об&apos;єкт
        </h1>

        <p className="text-gray-500">
          Заповніть інформацію про новий об&apos;єкт.
        </p>
      </header>

      <form
        action={createObject}
        className="vc-surface space-y-5 p-4 sm:p-6"
      >
        <div>
          <label className="mb-2 block font-medium">
            Назва об&apos;єкта
          </label>

          <input
            name="name"
            required
            className="vc-field min-h-11 w-full p-3"
            placeholder="Будинок Петренків"
          />
        </div>

        <fieldset className="rounded-xl border bg-gray-50 p-4">
          <legend className="px-1 font-semibold text-gray-900">
            Фінанси
          </legend>

          <p className="mt-1 text-sm text-gray-500">
            Необов’язкові планові
            значення для об’єкта.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Плановий бюджет
                витрат, грн
              </label>

              <input
                type="number"
                name="cost_budget"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="vc-field min-h-11 w-full p-3"
                placeholder="100000"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Вартість для
                клієнта, грн
              </label>

              <input
                type="number"
                name="client_price"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="vc-field min-h-11 w-full p-3"
                placeholder="135000"
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label className="mb-2 block font-medium">
            Замовник
          </label>

          <input
            name="customer"
            className="vc-field min-h-11 w-full p-3"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            className="vc-field min-h-11 w-full p-3"
            placeholder="+380..."
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            Адреса
          </label>

          <input
            name="address"
            className="vc-field min-h-11 w-full p-3"
          />
        </div>

        <NewObjectStatusFields />

        <div>
          <label className="mb-2 block font-medium">
            Відповідальний працівник
          </label>

          <select
            name="responsible_employee_id"
            defaultValue=""
            className="vc-field min-h-11 w-full p-3"
          >
            <option value="">
              Не призначати
            </option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.last_name}{" "}
                {employee.first_name}
                {employee.position
                  ? ` — ${employee.position}`
                  : ""}
                {employee.status !== "Активний"
                  ? ` (${employee.status})`
                  : ""}
              </option>
            ))}
          </select>

          {employees.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Працівників ще не додано. Додай їх у
              розділі «Працівники».
            </p>
          )}
        </div>

        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-green-700 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:w-fit"
        >
          Створити об&apos;єкт
        </button>
      </form>
    </div>
  );
}

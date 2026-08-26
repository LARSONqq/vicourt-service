import { createObject } from "@/app/actions/objectActions";
import NewObjectStatusFields from "@/components/objects/NewObjectStatusFields";
import { getEmployees } from "@/services/employeeService";

export default async function NewObjectPage() {
  const employees = await getEmployees();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Новий об&apos;єкт
        </h1>

        <p className="text-gray-500">
          Заповніть інформацію про новий об&apos;єкт.
        </p>
      </div>

      <form
        action={createObject}
        className="space-y-5 rounded-xl border bg-white p-6"
      >
        <div>
          <label className="mb-2 block font-medium">
            Назва об&apos;єкта
          </label>

          <input
            name="name"
            required
            className="w-full rounded-lg border p-3"
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
                className="w-full rounded-lg border bg-white p-3"
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
                className="w-full rounded-lg border bg-white p-3"
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
            className="w-full rounded-lg border p-3"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            className="w-full rounded-lg border p-3"
            placeholder="+380..."
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            Адреса
          </label>

          <input
            name="address"
            className="w-full rounded-lg border p-3"
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
            className="w-full rounded-lg border bg-white p-3"
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
          className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
        >
          Створити об&apos;єкт
        </button>
      </form>
    </div>
  );
}

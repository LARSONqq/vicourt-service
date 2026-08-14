import { createObject } from "@/app/actions/objectActions";
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

        <div>
          <label className="mb-2 block font-medium">
            Статус
          </label>

          <select
            name="status"
            className="w-full rounded-lg border bg-white p-3"
            defaultValue="В роботі"
          >
            <option value="В роботі">
              В роботі
            </option>

            <option value="Пауза">
              Пауза
            </option>

            <option value="Завершений">
              Завершений
            </option>
          </select>
        </div>

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
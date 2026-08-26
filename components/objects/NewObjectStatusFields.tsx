"use client";

import { useState } from "react";

import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";

const defaultStatus =
  "В роботі";

export default function NewObjectStatusFields() {
  const [status, setStatus] =
    useState(defaultStatus);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block font-medium">
          Статус
        </label>

        <select
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white p-3"
        >
          <option value="В роботі">
            В роботі
          </option>

          <option value="На постійному обслуговуванні">
            На постійному обслуговуванні
          </option>

          <option value={PERIODIC_SUPERVISION_STATUS}>
            {PERIODIC_SUPERVISION_STATUS}
          </option>

          <option value="Пауза">
            Призупинено
          </option>

          <option value="Завершений">
            Завершений
          </option>
        </select>
      </div>

      {status ===
        PERIODIC_SUPERVISION_STATUS && (
        <fieldset className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <legend className="px-1 font-semibold text-gray-900">
            Періодичний нагляд
          </legend>

          <p className="mt-1 text-sm text-gray-600">
            Вкажіть періодичність і
            заплануйте перший огляд.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Періодичність, днів
              </label>

              <input
                type="number"
                name="supervision_interval_days"
                min="1"
                step="1"
                inputMode="numeric"
                list="new-object-supervision-intervals"
                className="w-full rounded-lg border bg-white p-3"
                placeholder="Наприклад, 14"
              />

              <datalist id="new-object-supervision-intervals">
                <option value="7" />
                <option value="14" />
                <option value="30" />
              </datalist>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Дата першого / наступного
                огляду
              </label>

              <input
                type="date"
                name="next_supervision_date"
                className="w-full rounded-lg border bg-white p-3"
              />
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );
}

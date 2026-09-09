"use client";

import {
  useRef,
  useState,
} from "react";
import type {
  FormEvent,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  getEquipmentWorkSessionFormOptions,
  recordEquipmentWorkSession,
} from "@/app/actions/equipmentUsageActions";

import type {
  EquipmentWorkSessionFormOptions,
} from "@/types/equipmentUsage";

type Props = {
  equipmentId: number;
  today: string;
};

function createIdempotencyKey() {
  if (
    typeof globalThis.crypto
      ?.randomUUID !== "function"
  ) {
    throw new Error(
      "Браузер не може створити безпечний ключ запиту. Оновіть сторінку або браузер."
    );
  }

  return globalThis.crypto.randomUUID();
}

function parseDuration(
  value: string
) {
  const normalized = value.trim();

  if (
    !/^\d+(?:\.\d{1,3})?$/u.test(
      normalized
    )
  ) {
    throw new Error(
      "Вкажіть додатну кількість годин, максимум із трьома десятковими знаками."
    );
  }

  const duration =
    Number(normalized);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error(
      "Відпрацьований час має бути більшим за нуль."
    );
  }

  return duration;
}

function formatHours(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 3,
    }
  ).format(value);
}

function getEmployeeName(
  employee: EquipmentWorkSessionFormOptions["employees"][number]
) {
  return [
    employee.first_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ") ||
    `Працівник #${employee.id}`;
}

export default function EquipmentWorkSessionForm({
  equipmentId,
  today,
}: Props) {
  const router = useRouter();
  const submissionLock =
    useRef(false);
  const idempotencyKeyRef =
    useRef<string | null>(null);
  const [isOpen, setIsOpen] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [options, setOptions] =
    useState<EquipmentWorkSessionFormOptions | null>(
      null
    );
  const [readingDate, setReadingDate] =
    useState(today);
  const [duration, setDuration] =
    useState("");
  const [objectId, setObjectId] =
    useState("");
  const [employeeId, setEmployeeId] =
    useState("");
  const [note, setNote] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function toggleForm() {
    if (isOpen) {
      setIsOpen(false);
      setErrorMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      idempotencyKeyRef.current ??=
        createIdempotencyKey();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося підготувати форму."
      );
      return;
    }

    setIsOpen(true);

    if (options) {
      return;
    }

    setIsLoading(true);

    try {
      const loadedOptions =
        await getEquipmentWorkSessionFormOptions();

      setOptions(loadedOptions);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити об’єкти та працівників."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submissionLock.current ||
      isSubmitting
    ) {
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const parsedObjectId =
        Number(objectId);
      const parsedEmployeeId =
        Number(employeeId);

      if (
        !Number.isInteger(
          parsedObjectId
        ) ||
        parsedObjectId <= 0
      ) {
        throw new Error(
          "Оберіть об’єкт."
        );
      }

      if (
        !Number.isInteger(
          parsedEmployeeId
        ) ||
        parsedEmployeeId <= 0
      ) {
        throw new Error(
          "Оберіть працівника."
        );
      }

      const idempotencyKey =
        idempotencyKeyRef.current ??
        createIdempotencyKey();

      idempotencyKeyRef.current =
        idempotencyKey;

      const result =
        await recordEquipmentWorkSession({
          equipmentId,
          duration:
            parseDuration(
              duration
            ),
          readingDate,
          objectId:
            parsedObjectId,
          employeeId:
            parsedEmployeeId,
          note:
            note.trim() || null,
          idempotencyKey,
        });

      setSuccessMessage(
        `Додано ${formatHours(
          result.duration
        )} год. Поточне напрацювання: ${formatHours(
          result.new_current_usage
        )} мотогод.`
      );
      setReadingDate(today);
      setDuration("");
      setObjectId("");
      setEmployeeId("");
      setNote("");
      setIsOpen(false);
      idempotencyKeyRef.current =
        null;
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати використання техніки."
      );
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  const hasOptions =
    Boolean(
      options?.objects.length &&
      options.employees.length
    );

  return (
    <section className="min-w-0 rounded-xl border bg-gray-50 p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">
            Використання техніки
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Запишіть фактично відпрацьовані години на конкретному об’єкті.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            void toggleForm()
          }
          disabled={
            isLoading ||
            isSubmitting
          }
          aria-expanded={isOpen}
          className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
            isOpen
              ? "border bg-white text-gray-700 hover:bg-gray-100"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isOpen
            ? "Закрити форму"
            : isLoading
              ? "Завантаження…"
              : "+ Додати використання"}
        </button>
      </div>

      {successMessage && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {successMessage}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      {isOpen && (
        <div className="mt-4 border-t pt-4">
          {isLoading ? (
            <p
              role="status"
              className="text-sm text-gray-500"
            >
              Завантаження об’єктів і працівників…
            </p>
          ) : !hasOptions ? (
            <p className="text-sm text-gray-600">
              Для запису роботи потрібні хоча б один об’єкт і один працівник.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="min-w-0 space-y-4"
            >
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Дата роботи
                  <input
                    type="date"
                    value={readingDate}
                    max={today}
                    onChange={(event) =>
                      setReadingDate(
                        event.target.value
                      )
                    }
                    required
                    disabled={isSubmitting}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Відпрацьовано годин
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    step="0.001"
                    value={duration}
                    onChange={(event) =>
                      setDuration(
                        event.target.value
                      )
                    }
                    placeholder="Наприклад: 2.5"
                    required
                    disabled={isSubmitting}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition placeholder:text-gray-400 focus:border-green-600 disabled:bg-gray-100"
                  />
                </label>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Об’єкт
                  <select
                    value={objectId}
                    onChange={(event) =>
                      setObjectId(
                        event.target.value
                      )
                    }
                    required
                    disabled={isSubmitting}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Оберіть об’єкт
                    </option>
                    {options?.objects.map(
                      (object) => (
                        <option
                          key={object.id}
                          value={object.id}
                        >
                          {object.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Працівник
                  <select
                    value={employeeId}
                    onChange={(event) =>
                      setEmployeeId(
                        event.target.value
                      )
                    }
                    required
                    disabled={isSubmitting}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Оберіть працівника
                    </option>
                    {options?.employees.map(
                      (employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {getEmployeeName(
                            employee
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label className="block min-w-0 text-sm font-medium text-gray-700">
                Примітка
                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(
                      event.target.value
                    )
                  }
                  rows={3}
                  maxLength={2000}
                  disabled={isSubmitting}
                  placeholder="Необов’язково"
                  className="mt-2 w-full min-w-0 resize-y rounded-lg border bg-white px-3 py-2 outline-none transition placeholder:text-gray-400 focus:border-green-600 disabled:bg-gray-100"
                />
              </label>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !hasOptions
                }
                className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting
                  ? "Збереження…"
                  : "Зберегти використання"}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

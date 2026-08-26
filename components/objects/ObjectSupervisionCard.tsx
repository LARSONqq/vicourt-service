"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeObjectSupervision,
} from "@/app/actions/objectActions";
import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  getObjectSupervisionState,
} from "@/lib/objectSupervision";

type Props = {
  objectId: number;
  intervalDays: number | null;
  lastDate: string | null;
  nextDate: string | null;
  today: string;
  canManage: boolean;
};

function getStatePresentation(
  nextDate: string | null,
  today: string
) {
  const state =
    getObjectSupervisionState(
      nextDate,
      today
    );

  switch (state.kind) {
    case "planned":
      return {
        label: "Заплановано",
        className:
          "bg-blue-100 text-blue-700",
      };

    case "today":
      return {
        label: "Огляд сьогодні",
        className:
          "bg-orange-100 text-orange-700",
      };

    case "overdue":
      return {
        label: `Прострочено на ${state.overdueDays} дн.`,
        className:
          "bg-red-100 text-red-700",
      };

    default:
      return {
        label: "Не заплановано",
        className:
          "bg-gray-100 text-gray-600",
      };
  }
}

export default function ObjectSupervisionCard({
  objectId,
  intervalDays,
  lastDate,
  nextDate,
  today,
  canManage,
}: Props) {
  const router = useRouter();
  const [currentLastDate, setCurrentLastDate] =
    useState(lastDate);
  const [currentNextDate, setCurrentNextDate] =
    useState(nextDate);
  const [isSaving, setIsSaving] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const state =
    getStatePresentation(
      currentNextDate,
      today
    );
  const hasInterval =
    Number.isInteger(
      intervalDays
    ) &&
    Number(intervalDays) > 0;

  async function handleComplete() {
    if (
      isSaving ||
      !hasInterval
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await completeObjectSupervision(
          objectId
        );

      setCurrentLastDate(
        result.lastSupervisionDate
      );
      setCurrentNextDate(
        result.nextSupervisionDate
      );
      setSuccessMessage(
        `Огляд збережено. Наступний огляд: ${formatDateValue(
          result.nextSupervisionDate
        )}.`
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти огляд."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Періодичний нагляд
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Планування регулярних оглядів
            об’єкта
          </p>
        </div>

        <span
          className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium ${state.className}`}
        >
          {state.label}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="min-w-0 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Періодичність
            </p>

            <p className="mt-1 break-words font-medium text-gray-900">
              {hasInterval
                ? `кожні ${intervalDays} днів`
                : "Не вказано"}
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Останній огляд
            </p>

            <p className="mt-1 break-words font-medium text-gray-900">
              {formatDateValue(
                currentLastDate
              ) || "Ще не виконувався"}
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Наступний огляд
            </p>

            <p className="mt-1 break-words font-medium text-gray-900">
              {formatDateValue(
                currentNextDate
              ) || "Не заплановано"}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              onClick={handleComplete}
              disabled={
                isSaving ||
                !hasInterval
              }
              className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
            >
              {isSaving
                ? "Збереження..."
                : "Огляд виконано"}
            </button>

            {!hasInterval && (
              <p className="mt-2 text-sm text-orange-700">
                Спочатку вкажіть
                періодичність нагляду.
              </p>
            )}
          </div>
        )}

        {successMessage && (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMessage}
          </p>
        )}

        {errorMessage && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  type MouseEvent,
} from "react";
import { completeDashboardTask } from "@/app/actions/dashboardTaskActions";

type Props = {
  taskId: number;
  objectId: number;
  compact?: boolean;
};

export default function CompleteTaskButton({
  taskId,
  objectId,
  compact = false,
}: Props) {
  const router = useRouter();

  const [isSaving, setIsSaving] =
    useState(false);

  const [isCompleted, setIsCompleted] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleComplete(
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSaving || isCompleted) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await completeDashboardTask(
        taskId,
        objectId
      );

      setIsCompleted(true);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося виконати завдання."
      );

      setIsSaving(false);
    }
  }

  if (isCompleted) {
    return (
      <span className="inline-flex items-center rounded-lg bg-green-100 px-3 py-2 text-xs font-medium text-green-700">
        ✓ Виконано
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={isSaving}
        onClick={handleComplete}
        className={`rounded-lg border border-green-200 bg-green-50 font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact
            ? "px-3 py-2 text-xs"
            : "px-4 py-2 text-sm"
        }`}
      >
        {isSaving
          ? "Збереження..."
          : "✓ Виконано"}
      </button>

      {errorMessage && (
        <p className="mt-2 max-w-56 text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
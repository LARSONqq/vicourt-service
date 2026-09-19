"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { taskMutationMessage } from "@/lib/taskDetail";

import {
  disableTaskTemplateAction,
} from "@/app/actions/taskTemplateActions";

type Props = {
  templateId: number;
  taskTitle: string;
  compact?: boolean;
  onStopped?: () => void;
};

export default function StopRecurringTaskButton({
  templateId,
  taskTitle,
  compact = false,
  onStopped,
}: Props) {
  const router = useRouter();
  const submitLock = useRef(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleStop() {
    if (submitLock.current) return;

    const confirmed = window.confirm(
      `Зупинити повторення «${taskTitle}»?\n\nНові повторення більше не створюватимуться. Поточне незавершене завдання залишиться як разове. Завершена історія збережеться.`
    );

    if (!confirmed) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await disableTaskTemplateAction(
        templateId
      );
      onStopped?.();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        taskMutationMessage(error, "Не вдалося зупинити повторення. Перевірте доступ і спробуйте ще раз.")
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={handleStop}
        disabled={isSubmitting}
        className={`w-full rounded-lg border border-orange-200 font-medium text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact
            ? "min-h-10 px-3 py-2 text-xs"
            : "min-h-11 px-4 py-2.5 text-sm"
        }`}
      >
        {isSubmitting
          ? "Зупинення..."
          : "Зупинити повторення"}
      </button>

      {errorMessage && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

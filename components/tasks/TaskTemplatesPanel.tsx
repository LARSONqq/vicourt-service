"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  type FormEvent,
} from "react";

import {
  activateTaskTemplateSeriesAction,
  createTaskFromTemplateAction,
  createTaskTemplateAction,
  disableTaskTemplateAction,
  updateTaskTemplateAction,
} from "@/app/actions/taskTemplateActions";
import TaskRecurrenceFields from "@/components/tasks/TaskRecurrenceFields";
import {
  getTaskRecurrenceLabel,
} from "@/lib/taskRecurrence";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type {
  TaskPriority,
  TaskTargetType,
} from "@/types/objectTask";
import type {
  TaskRecurrenceType,
  TaskTemplate,
} from "@/types/taskTemplate";

type Props = {
  templates: TaskTemplate[];
  objects: ObjectItem[];
  equipment: Equipment[];
  employees: Employee[];
};

type EditorMode =
  | "create"
  | "edit"
  | "use"
  | null;

type TemplateDraft = {
  title: string;
  description: string;
  targetType: TaskTargetType;
  priority: TaskPriority;
  assignedEmployeeId: string;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval: string;
  anchorDueDate: string;
};

const priorities: TaskPriority[] = [
  "Низький",
  "Середній",
  "Високий",
  "Терміновий",
];

const emptyDraft: TemplateDraft = {
  title: "",
  description: "",
  targetType: "object",
  priority: "Середній",
  assignedEmployeeId: "",
  recurrenceType: "none",
  recurrenceInterval: "14",
  anchorDueDate: "",
};

function getDraft(
  template: TaskTemplate
): TemplateDraft {
  return {
    title: template.title,
    description:
      template.description || "",
    targetType:
      template.target_type,
    priority: template.priority,
    assignedEmployeeId:
      template.assigned_employee_id
        ? String(
            template.assigned_employee_id
          )
        : "",
    recurrenceType:
      template.recurrence_type,
    recurrenceInterval: String(
      template.recurrence_interval ?? 14
    ),
    anchorDueDate:
      template.anchor_due_date || "",
  };
}

function getRecurrenceInterval(
  recurrenceType: TaskRecurrenceType,
  value: string
) {
  if (recurrenceType === "none") {
    return null;
  }
  if (recurrenceType !== "custom") {
    return 1;
  }

  return Number(value);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] =
    value.split("-");
  return `${day}.${month}.${year}`;
}

export default function TaskTemplatesPanel({
  templates,
  objects,
  equipment,
  employees,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] =
    useState(false);
  const [mode, setMode] =
    useState<EditorMode>(null);
  const [selectedId, setSelectedId] =
    useState<number | null>(null);
  const [draft, setDraft] =
    useState<TemplateDraft>(emptyDraft);
  const [targetId, setTargetId] =
    useState("");
  const [useDueDate, setUseDueDate] =
    useState("");
  const [useEmployeeId, setUseEmployeeId] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedTemplate =
    selectedId === null
      ? null
      : templates.find(
          (template) =>
            template.id === selectedId
        ) || null;

  function resetEditor() {
    setMode(null);
    setSelectedId(null);
    setDraft(emptyDraft);
    setTargetId("");
    setUseDueDate("");
    setUseEmployeeId("");
    setErrorMessage("");
  }

  function openCreate() {
    setMode("create");
    setSelectedId(null);
    setDraft(emptyDraft);
    setMessage("");
    setErrorMessage("");
  }

  function openEdit(
    template: TaskTemplate
  ) {
    setMode("edit");
    setSelectedId(template.id);
    setDraft(getDraft(template));
    setMessage("");
    setErrorMessage("");
  }

  function openUse(
    template: TaskTemplate
  ) {
    setMode("use");
    setSelectedId(template.id);
    setTargetId("");
    setUseDueDate(
      template.anchor_due_date || ""
    );
    setUseEmployeeId("");
    setMessage("");
    setErrorMessage("");
  }

  async function handleTemplateSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const recurrenceInterval =
        getRecurrenceInterval(
          draft.recurrenceType,
          draft.recurrenceInterval
        );
      const assignedEmployeeId =
        draft.assignedEmployeeId
          ? Number(
              draft.assignedEmployeeId
            )
          : null;

      if (
        mode === "edit" &&
        selectedTemplate
      ) {
        await updateTaskTemplateAction({
          templateId:
            selectedTemplate.id,
          title: draft.title,
          description:
            draft.description,
          priority: draft.priority,
          assignedEmployeeId,
          recurrenceType:
            draft.recurrenceType,
          recurrenceInterval,
          anchorDueDate:
            draft.anchorDueDate || null,
        });
        setMessage(
          "Шаблон оновлено. Поточне активне повторення синхронізовано."
        );
      } else {
        await createTaskTemplateAction({
          title: draft.title,
          description:
            draft.description,
          targetType:
            draft.targetType,
          objectId: null,
          equipmentId: null,
          priority: draft.priority,
          assignedEmployeeId,
          recurrenceType:
            draft.recurrenceType,
          recurrenceInterval,
          anchorDueDate:
            draft.anchorDueDate || null,
          isActive: false,
        });
        setMessage(
          "Шаблон створено."
        );
      }

      resetEditor();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти шаблон."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (
      isSubmitting ||
      !selectedTemplate
    ) {
      return;
    }

    const selectedTargetId =
      Number(targetId);
    const targetType =
      selectedTemplate.target_type;

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      if (
        selectedTemplate.recurrence_type ===
        "none"
      ) {
        await createTaskFromTemplateAction({
          templateId:
            selectedTemplate.id,
          targetType,
          objectId:
            targetType === "object"
              ? selectedTargetId
              : null,
          equipmentId:
            targetType === "equipment"
              ? selectedTargetId
              : null,
          dueDate: useDueDate || null,
          assignedEmployeeId:
            useEmployeeId
              ? Number(useEmployeeId)
              : null,
        });
        setMessage(
          "Завдання створено із шаблону."
        );
      } else {
        await activateTaskTemplateSeriesAction({
          templateId:
            selectedTemplate.id,
          targetType,
          objectId:
            targetType === "object"
              ? selectedTargetId
              : null,
          equipmentId:
            targetType === "equipment"
              ? selectedTargetId
              : null,
          anchorDueDate: useDueDate,
        });
        setMessage(
          "Серію активовано. Створено одне актуальне повторення."
        );
      }

      resetEditor();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося використати шаблон."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisable(
    template: TaskTemplate
  ) {
    const confirmed = window.confirm(
      `Зупинити повторення «${template.title}»?\n\nПоточне незавершене завдання залишиться звичайним manual-завданням, але наступні більше не створюватимуться.`
    );
    if (!confirmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      await disableTaskTemplateAction(
        template.id
      );
      setMessage(
        "Повторення зупинено. Поточне завдання збережено як разове."
      );
      resetEditor();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зупинити повторення."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">
            Шаблони завдань
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Швидкі разові завдання та серії з одним актуальним повторенням.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpen((current) =>
              !current
            );
            resetEditor();
          }}
          className="min-h-11 w-full rounded-lg border px-4 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-50 sm:w-fit"
        >
          {isOpen
            ? "Сховати шаблони"
            : `Шаблони (${templates.length})`}
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 min-w-0 space-y-4 border-t pt-5">
          {(message || errorMessage) && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                errorMessage
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {errorMessage || message}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Шаблонів і серій: {templates.length}
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="min-h-10 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 sm:w-fit"
            >
              + Новий шаблон
            </button>
          </div>

          {(mode === "create" ||
            (mode === "edit" &&
              selectedTemplate)) && (
            <form
              onSubmit={handleTemplateSubmit}
              className="min-w-0 space-y-4 rounded-xl border bg-gray-50 p-3 sm:p-4"
            >
              <div>
                <h3 className="font-semibold text-gray-900">
                  {mode === "create"
                    ? "Новий шаблон"
                    : "Редагування шаблону / серії"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Зміни активної серії застосуються до її поточного незавершеного завдання.
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <label className="min-w-0 text-sm font-medium text-gray-700 md:col-span-2">
                  Назва
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title:
                          event.target.value,
                      }))
                    }
                    required
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 font-normal outline-none focus:border-green-600"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700 md:col-span-2">
                  Опис
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2 w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 font-normal outline-none focus:border-green-600"
                  />
                </label>

                {mode === "create" && (
                  <label className="min-w-0 text-sm font-medium text-gray-700">
                    Тип цілі
                    <select
                      value={draft.targetType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          targetType:
                            event.target
                              .value as TaskTargetType,
                        }))
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                    >
                      <option value="object">Об’єкт</option>
                      <option value="equipment">Техніка</option>
                    </select>
                  </label>
                )}

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Пріоритет
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        priority:
                          event.target
                            .value as TaskPriority,
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Відповідальний
                  <select
                    value={draft.assignedEmployeeId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        assignedEmployeeId:
                          event.target.value,
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                  >
                    <option value="">Не призначати</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.last_name} {employee.first_name}
                      </option>
                    ))}
                  </select>
                </label>

                {draft.recurrenceType !== "none" && (
                  <label className="min-w-0 text-sm font-medium text-gray-700">
                    Опорна дата
                    <input
                      type="date"
                      value={draft.anchorDueDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          anchorDueDate:
                            event.target.value,
                        }))
                      }
                      required={
                        selectedTemplate?.is_active ===
                        true
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                    />
                  </label>
                )}
              </div>

              <TaskRecurrenceFields
                idPrefix="template-editor"
                allowNone={
                  selectedTemplate?.is_active !==
                  true
                }
                value={draft.recurrenceType}
                customInterval={
                  draft.recurrenceInterval
                }
                onChange={(recurrenceType) =>
                  setDraft((current) => ({
                    ...current,
                    recurrenceType,
                  }))
                }
                onCustomIntervalChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    recurrenceInterval: value,
                  }))
                }
              />

              <div className="grid grid-cols-1 gap-2 sm:flex">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Збереження..."
                    : "Зберегти"}
                </button>
                <button
                  type="button"
                  onClick={resetEditor}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-lg border bg-white px-4 py-2 font-medium text-gray-700 disabled:opacity-60"
                >
                  Скасувати
                </button>
              </div>
            </form>
          )}

          {mode === "use" &&
            selectedTemplate && (
            <form
              onSubmit={handleUseSubmit}
              className="min-w-0 space-y-4 rounded-xl border border-green-100 bg-green-50/40 p-3 sm:p-4"
            >
              <div>
                <h3 className="break-words font-semibold text-gray-900">
                  Використати «{selectedTemplate.title}»
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedTemplate.recurrence_type === "none"
                    ? "Буде створено одне разове завдання."
                    : "Буде створено окрему серію для вибраної цілі та одне актуальне повторення."}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <label className="min-w-0 text-sm font-medium text-gray-700">
                  {selectedTemplate.target_type === "object"
                    ? "Об’єкт"
                    : "Техніка"}
                  <select
                    value={targetId}
                    onChange={(event) =>
                      setTargetId(
                        event.target.value
                      )
                    }
                    required
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 font-normal"
                  >
                    <option value="" disabled>
                      Обери ціль
                    </option>
                    {(selectedTemplate.target_type === "object"
                      ? objects
                      : equipment
                    ).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  {selectedTemplate.recurrence_type === "none"
                    ? "Термін виконання"
                    : "Опорна дата серії"}
                  <input
                    type="date"
                    value={useDueDate}
                    onChange={(event) =>
                      setUseDueDate(
                        event.target.value
                      )
                    }
                    required={
                      selectedTemplate.recurrence_type !==
                      "none"
                    }
                    className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                  />
                </label>

                {selectedTemplate.recurrence_type === "none" && (
                  <label className="min-w-0 text-sm font-medium text-gray-700 md:col-span-2">
                    Відповідальний
                    <select
                      value={useEmployeeId}
                      onChange={(event) =>
                        setUseEmployeeId(
                          event.target.value
                        )
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-3 font-normal"
                    >
                      <option value="">
                        Як у шаблоні
                      </option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.last_name} {employee.first_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:flex">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Створення..."
                    : selectedTemplate.recurrence_type === "none"
                      ? "Створити завдання"
                      : "Активувати серію"}
                </button>
                <button
                  type="button"
                  onClick={resetEditor}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-lg border bg-white px-4 py-2 font-medium text-gray-700 disabled:opacity-60"
                >
                  Скасувати
                </button>
              </div>
            </form>
          )}

          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gray-50 p-5 text-center text-sm text-gray-500">
              Шаблонів ще немає.
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
              {templates.map((template) => {
                const isBound =
                  template.object_id !== null ||
                  template.equipment_id !== null;
                const targetName =
                  template.object_id !== null
                    ? objects.find(
                        (object) =>
                          object.id ===
                          template.object_id
                      )?.name
                    : equipment.find(
                        (item) =>
                          item.id ===
                          template.equipment_id
                      )?.name;

                return (
                  <article
                    key={template.id}
                    className="min-w-0 rounded-xl border p-3 sm:p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-gray-900">
                          {template.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-teal-700">
                          {getTaskRecurrenceLabel(
                            template.recurrence_type,
                            template.recurrence_interval
                          )}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                          template.is_active
                            ? "bg-green-50 text-green-700"
                            : isBound
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {template.is_active
                          ? "Активна серія"
                          : isBound
                            ? "Зупинено"
                            : "Шаблон"}
                      </span>
                    </div>

                    {template.description && (
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-gray-600">
                        {template.description}
                      </p>
                    )}

                    <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-xs text-gray-400">Ціль</dt>
                        <dd className="mt-0.5 break-words text-gray-700">
                          {targetName ||
                            (template.target_type === "object"
                              ? "Будь-який об’єкт"
                              : "Будь-яка техніка")}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-gray-400">Опорна дата</dt>
                        <dd className="mt-0.5 text-gray-700">
                          {formatDate(
                            template.anchor_due_date
                          ) || "Під час використання"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-3 sm:flex sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(template)
                        }
                        disabled={isSubmitting}
                        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-60"
                      >
                        Редагувати
                      </button>
                      {!isBound && !template.is_active && (
                        <button
                          type="button"
                          onClick={() =>
                            openUse(template)
                          }
                          disabled={isSubmitting}
                          className="min-h-10 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 disabled:opacity-60"
                        >
                          Використати
                        </button>
                      )}
                      {template.is_active && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDisable(
                              template
                            )
                          }
                          disabled={isSubmitting}
                          className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
                        >
                          Зупинити повторення
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

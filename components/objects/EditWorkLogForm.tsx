"use client";

import {
  useRef,
  useState,
} from "react";

import { updateWorkLog } from "@/app/actions/workLogActions";

import {
  WORK_LOG_ATTACHMENT_ACCEPT,
  type WorkLogAttachmentMetadata,
} from "@/constants/workLogAttachments";

import {
  appendWorkLogAttachmentMetadata,
  removeWorkLogAttachment,
  uploadWorkLogAttachment,
} from "@/services/workLogAttachmentClientService";

import type { Employee } from "@/types/employee";
import type { WorkLog } from "@/types/workLog";

type WorkLogWithEmployee =
  WorkLog & {
    employee_id?: number | null;
  };

type Props = {
  workLog: WorkLogWithEmployee;
  objectId: number;
  employees?: Employee[];
  onCancel: () => void;
};

export default function EditWorkLogForm({
  workLog,
  objectId,
  employees = [],
  onCancel,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    selectedFileName,
    setSelectedFileName,
  ] = useState("");

  const [
    removeAttachment,
    setRemoveAttachment,
  ] = useState(false);

  const sortedEmployees = [
    ...employees,
  ].sort(
    (
      firstEmployee,
      secondEmployee
    ) =>
      `${firstEmployee.last_name} ${firstEmployee.first_name}`.localeCompare(
        `${secondEmployee.last_name} ${secondEmployee.first_name}`,
        "uk"
      )
  );

  const selectedEmployeeId =
    workLog.employee_id
      ? String(
          workLog.employee_id
        )
      : "";

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const attachment =
      formData.get(
        "attachment"
      );

    formData.delete(
      "attachment"
    );

    let uploadedAttachment:
      | WorkLogAttachmentMetadata
      | null = null;

    try {
      if (
        attachment instanceof
          File &&
        attachment.size > 0
      ) {
        uploadedAttachment =
          await uploadWorkLogAttachment(
            attachment,
            objectId
          );

        appendWorkLogAttachmentMetadata(
          formData,
          uploadedAttachment
        );

        formData.set(
          "attachment_action",
          "replace"
        );
      } else {
        formData.set(
          "attachment_action",
          removeAttachment
            ? "remove"
            : "keep"
        );
      }

      const result =
        await updateWorkLog(
          formData
        );

      if (result.warning) {
        window.alert(
          result.warning
        );
      }

      onCancel();
    } catch (error) {
      if (
        uploadedAttachment
      ) {
        try {
          await removeWorkLogAttachment(
            uploadedAttachment.attachmentPath
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Не вдалося очистити завантажений файл:",
            cleanupError
          );
        }
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити запис."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-4"
    >
      <input
        type="hidden"
        name="work_log_id"
        value={workLog.id}
      />

      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <input
        type="hidden"
        name="workers"
        value={
          workLog.employee_id
            ? ""
            : workLog.workers ||
              ""
        }
      />

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Редагування запису
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Зміни інформацію про виконану роботу
        </p>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* DATE + EMPLOYEE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата
          </label>

          <input
            type="date"
            name="work_date"
            defaultValue={
              workLog.work_date
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Працівник
          </label>

          <select
            name="employee_id"
            defaultValue={
              selectedEmployeeId
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не вибрано
            </option>

            {sortedEmployees.map(
              (employee) => (
                <option
                  key={
                    employee.id
                  }
                  value={
                    employee.id
                  }
                >
                  {
                    employee.last_name
                  }{" "}
                  {
                    employee.first_name
                  }
                  {employee.position
                    ? ` — ${employee.position}`
                    : ""}
                </option>
              )
            )}
          </select>

          {!workLog.employee_id &&
            workLog.workers && (
              <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2">
                <p className="text-xs text-orange-700">
                  Раніше було вказано:
                </p>

                <p className="mt-1 break-words text-sm font-medium text-orange-800">
                  {workLog.workers}
                </p>
              </div>
            )}

          {employees.length ===
            0 && (
            <p className="mt-2 text-xs text-orange-600">
              Працівників поки немає у списку.
            </p>
          )}
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Виконана робота
        </label>

        <textarea
          name="description"
          rows={4}
          defaultValue={
            workLog.description
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        />
      </div>

      {/* HOURS */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Кількість годин
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:max-w-sm">
          <input
            type="number"
            name="hours"
            inputMode="decimal"
            min="0"
            step="0.5"
            defaultValue={
              workLog.hours
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <span className="flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-600">
            год.
          </span>
        </div>
      </div>

      {/* ATTACHMENT */}
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Прикріплений файл
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-400">
            PDF, DOC, DOCX, XLS або
            XLSX до 10 МБ.
          </p>
        </div>

        {workLog.attachment_path &&
          workLog.attachment_name &&
          !removeAttachment && (
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-lg"
                >
                  📎
                </span>

                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-gray-800">
                    {
                      workLog.attachment_name
                    }
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Поточний файл
                  </p>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                {workLog.attachment_url && (
                  <a
                    href={
                      workLog.attachment_url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-10 rounded-lg border px-3 py-2 text-center text-sm font-medium text-green-700 transition hover:bg-green-50"
                  >
                    Відкрити
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setRemoveAttachment(
                      true
                    );

                    setSelectedFileName(
                      ""
                    );

                    if (
                      fileInputRef.current
                    ) {
                      fileInputRef.current.value =
                        "";
                    }
                  }}
                  disabled={
                    isSubmitting
                  }
                  className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  Видалити файл
                </button>
              </div>
            </div>
          )}

        {workLog.attachment_path &&
          removeAttachment && (
            <div className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-orange-800">
                Файл буде видалено після
                збереження змін.
              </p>

              <button
                type="button"
                onClick={() =>
                  setRemoveAttachment(
                    false
                  )
                }
                disabled={
                  isSubmitting
                }
                className="min-h-10 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
              >
                Залишити файл
              </button>
            </div>
          )}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {workLog.attachment_path &&
            !removeAttachment
              ? "Замінити файл"
              : "Прикріпити файл"}
          </label>

          <input
            ref={fileInputRef}
            type="file"
            name="attachment"
            accept={
              WORK_LOG_ATTACHMENT_ACCEPT
            }
            disabled={
              isSubmitting
            }
            onChange={(
              event
            ) => {
              const file =
                event.target
                  .files?.[0];

              setSelectedFileName(
                file?.name || ""
              );

              if (file) {
                setRemoveAttachment(
                  false
                );
              }

              setErrorMessage(
                ""
              );
            }}
            className="block min-h-11 w-full min-w-0 overflow-hidden rounded-lg border bg-white text-sm text-gray-600 file:mr-3 file:border-0 file:border-r file:bg-gray-50 file:px-4 file:py-3 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {selectedFileName && (
            <p className="mt-2 break-all text-xs text-gray-500">
              Новий файл:{" "}
              <span className="font-medium text-gray-700">
                {
                  selectedFileName
                }
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}

"use client";

import {
  FormEvent,
  useRef,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  cancelObjectDocumentUpload,
  finalizeObjectDocumentUpload,
  prepareObjectDocumentUpload,
} from "@/app/actions/objectDocumentActions";
import {
  getObjectDocumentFileValidationError,
  OBJECT_DOCUMENT_ACCEPT,
  OBJECT_DOCUMENT_ACCESS_LEVELS,
  OBJECT_DOCUMENT_CATEGORIES,
  OBJECT_DOCUMENT_NOTE_MAX_LENGTH,
  OBJECT_DOCUMENT_TITLE_MAX_LENGTH,
} from "@/constants/objectDocuments";
import {
  uploadPreparedObjectDocument,
} from "@/services/objectDocumentClientService";

import type {
  PreparedObjectDocumentUpload,
} from "@/types/objectDocument";

type Props = {
  objectId: number;
  onSaved?: () => void;
};

function getSuggestedTitle(
  fileName: string
) {
  const title = fileName
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return title.slice(
    0,
    OBJECT_DOCUMENT_TITLE_MAX_LENGTH
  );
}

export default function ObjectDocumentForm({
  objectId,
  onSaved,
}: Props) {
  const router =
    useRouter();
  const formRef =
    useRef<HTMLFormElement>(
      null
    );
  const [title, setTitle] =
    useState("");
  const [isTitleEdited, setIsTitleEdited] =
    useState(false);
  const [selectedFileName, setSelectedFileName] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData =
      new FormData(
        event.currentTarget
      );
    const file = formData.get(
      "file"
    );

    if (
      !(file instanceof File) ||
      file.size <= 0
    ) {
      setErrorMessage(
        "Обери файл документа."
      );

      return;
    }

    const fileValidationError =
      getObjectDocumentFileValidationError(
        file
      );

    if (fileValidationError) {
      setErrorMessage(
        fileValidationError
      );

      return;
    }

    let prepared:
      | PreparedObjectDocumentUpload
      | null = null;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      prepared =
        await prepareObjectDocumentUpload(
          {
            objectId,
            title: String(
              formData.get(
                "title"
              ) ?? ""
            ),
            category: String(
              formData.get(
                "category"
              ) ?? ""
            ),
            accessLevel: String(
              formData.get(
                "access_level"
              ) ?? ""
            ),
            note: String(
              formData.get(
                "note"
              ) ?? ""
            ),
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }
        );

      await uploadPreparedObjectDocument(
        file,
        prepared
      );
      await finalizeObjectDocumentUpload(
        prepared.documentId,
        objectId
      );

      formRef.current?.reset();
      setTitle("");
      setIsTitleEdited(false);
      setSelectedFileName("");
      router.refresh();
      onSaved?.();
    } catch (error) {
      let cleanupFailed = false;

      if (prepared) {
        try {
          await cancelObjectDocumentUpload(
            prepared.documentId,
            objectId
          );
        } catch {
          cleanupFailed = true;
        }
      }

      const message =
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити документ.";

      setErrorMessage(
        cleanupFailed
          ? `${message} Не вдалося автоматично очистити незавершене завантаження — повідом адміністратора.`
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="min-w-0 space-y-5"
    >
      <div>
        <h3 className="font-semibold text-gray-900">
          Новий документ
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Один файл на один запис документа.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Назва документа
          </label>
          <input
            type="text"
            name="title"
            value={title}
            maxLength={
              OBJECT_DOCUMENT_TITLE_MAX_LENGTH
            }
            onChange={(event) => {
              setTitle(
                event.target.value
              );
              setIsTitleEdited(true);
            }}
            placeholder="Наприклад: Договір №12"
            required
            disabled={isSubmitting}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:opacity-60"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>
          <select
            name="category"
            defaultValue="other"
            disabled={isSubmitting}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:opacity-60"
          >
            {OBJECT_DOCUMENT_CATEGORIES.map(
              (category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Доступ
          </label>
          <select
            name="access_level"
            defaultValue="team"
            disabled={isSubmitting}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:opacity-60"
          >
            {OBJECT_DOCUMENT_ACCESS_LEVELS.map(
              (accessLevel) => (
                <option
                  key={accessLevel.value}
                  value={accessLevel.value}
                >
                  {accessLevel.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0 md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Примітка
          </label>
          <textarea
            name="note"
            rows={3}
            maxLength={
              OBJECT_DOCUMENT_NOTE_MAX_LENGTH
            }
            disabled={isSubmitting}
            placeholder="Необов’язково"
            className="w-full min-w-0 resize-y rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:opacity-60"
          />
        </div>

        <div className="min-w-0 md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Файл
          </label>
          <input
            type="file"
            name="file"
            accept={
              OBJECT_DOCUMENT_ACCEPT
            }
            disabled={isSubmitting}
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              setSelectedFileName(
                file?.name || ""
              );
              setErrorMessage("");

              if (
                file &&
                !isTitleEdited
              ) {
                setTitle(
                  getSuggestedTitle(
                    file.name
                  )
                );
              }
            }}
            required
            className="block min-h-11 w-full min-w-0 overflow-hidden rounded-lg border bg-white text-sm text-gray-600 file:mr-3 file:border-0 file:border-r file:bg-gray-50 file:px-4 file:py-3 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {selectedFileName && (
            <p className="mt-2 break-all text-xs text-gray-500">
              Обрано: {selectedFileName}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-gray-400">
            PDF, Word, Excel, CSV, TXT або зображення. Максимум 25 МБ.
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Завантаження..."
            : "Завантажити документ"}
        </button>
      </div>
    </form>
  );
}

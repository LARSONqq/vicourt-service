"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  updateObjectDocumentMetadata,
} from "@/app/actions/objectDocumentActions";
import {
  OBJECT_DOCUMENT_ACCESS_LEVELS,
  OBJECT_DOCUMENT_CATEGORIES,
  OBJECT_DOCUMENT_NOTE_MAX_LENGTH,
  OBJECT_DOCUMENT_TITLE_MAX_LENGTH,
} from "@/constants/objectDocuments";

import type {
  ObjectDocument,
} from "@/types/objectDocument";

type Props = {
  document: ObjectDocument;
  onCancel: () => void;
};

export default function ObjectDocumentMetadataForm({
  document,
  onCancel,
}: Props) {
  const router =
    useRouter();
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateObjectDocumentMetadata(
        new FormData(
          event.currentTarget
        )
      );
      router.refresh();
      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити документ."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:p-4"
    >
      <input
        type="hidden"
        name="document_id"
        value={document.id}
      />
      <input
        type="hidden"
        name="object_id"
        value={document.object_id}
      />

      <h4 className="font-semibold text-gray-900">
        Редагування документа
      </h4>

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
            defaultValue={document.title}
            maxLength={
              OBJECT_DOCUMENT_TITLE_MAX_LENGTH
            }
            required
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600 disabled:opacity-60"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>
          <select
            name="category"
            defaultValue={document.category}
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600 disabled:opacity-60"
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
            defaultValue={
              document.access_level
            }
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600 disabled:opacity-60"
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
            defaultValue={
              document.note || ""
            }
            maxLength={
              OBJECT_DOCUMENT_NOTE_MAX_LENGTH
            }
            disabled={isSubmitting}
            className="w-full resize-y rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-10 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти"}
        </button>
      </div>
    </form>
  );
}

"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  createObjectDocumentSignedUrl,
  deleteObjectDocument,
} from "@/app/actions/objectDocumentActions";
import {
  formatObjectDocumentFileSize,
  getObjectDocumentAccessLabel,
  getObjectDocumentCategoryLabel,
  getObjectDocumentIcon,
  OBJECT_DOCUMENT_ACCESS_LEVELS,
  OBJECT_DOCUMENT_CATEGORIES,
} from "@/constants/objectDocuments";

import type {
  ObjectDocument,
} from "@/types/objectDocument";

import ObjectDocumentForm from "./ObjectDocumentForm";
import ObjectDocumentMetadataForm from "./ObjectDocumentMetadataForm";

type Props = {
  objectId: number;
  documents: ObjectDocument[];
  canManage: boolean;
};

function formatDocumentDate(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Дата невідома";
  }

  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

export default function ObjectDocuments({
  objectId,
  documents,
  canManage,
}: Props) {
  const router =
    useRouter();
  const [showForm, setShowForm] =
    useState(false);
  const [search, setSearch] =
    useState("");
  const [category, setCategory] =
    useState("all");
  const [accessLevel, setAccessLevel] =
    useState("all");
  const [editingId, setEditingId] =
    useState<number | null>(
      null
    );
  const [openingId, setOpeningId] =
    useState<number | null>(
      null
    );
  const [deletingId, setDeletingId] =
    useState<number | null>(
      null
    );
  const [errorMessage, setErrorMessage] =
    useState("");

  const filteredDocuments =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase(
            "uk-UA"
          );

      return documents.filter(
        (document) => {
          if (
            category !== "all" &&
            document.category !==
              category
          ) {
            return false;
          }

          if (
            accessLevel !== "all" &&
            document.access_level !==
              accessLevel
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            document.title,
            document.original_file_name,
            document.note,
          ]
            .filter(
              (value): value is string =>
                Boolean(value)
            )
            .some((value) =>
              value
                .toLocaleLowerCase(
                  "uk-UA"
                )
                .includes(
                  normalizedSearch
                )
            );
        }
      );
    }, [
      accessLevel,
      category,
      documents,
      search,
    ]);

  async function handleOpen(
    document: ObjectDocument
  ) {
    if (openingId !== null) {
      return;
    }

    const openedWindow =
      window.open(
        "about:blank",
        "_blank"
      );

    if (openedWindow) {
      openedWindow.opener = null;
    }

    setOpeningId(document.id);
    setErrorMessage("");

    try {
      const { url } =
        await createObjectDocumentSignedUrl(
          document.id
        );

      if (openedWindow) {
        openedWindow.location.replace(
          url
        );
      } else {
        window.location.assign(
          url
        );
      }
    } catch (error) {
      openedWindow?.close();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося відкрити документ."
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(
    document: ObjectDocument
  ) {
    if (
      !window.confirm(
        `Видалити документ «${document.title}»?`
      )
    ) {
      return;
    }

    setDeletingId(document.id);
    setErrorMessage("");

    try {
      await deleteObjectDocument(
        document.id,
        objectId
      );

      if (
        editingId ===
        document.id
      ) {
        setEditingId(null);
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити документ."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Документи
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Договори, кошториси, креслення та інші робочі файли об’єкта.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Документів: {documents.length}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm(
                (current) =>
                  !current
              );
              setErrorMessage("");
            }}
            className={`min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
              showForm
                ? "border bg-white text-gray-700 hover:bg-gray-50"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {showForm
              ? "Закрити форму"
              : "+ Додати документ"}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="mt-5 rounded-xl border bg-gray-50 p-3 sm:p-4">
          <ObjectDocumentForm
            objectId={objectId}
            onSaved={() =>
              setShowForm(false)
            }
          />
        </div>
      )}

      {errorMessage && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Пошук за назвою або файлом"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
          />

          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
          >
            <option value="all">
              Усі категорії
            </option>
            {OBJECT_DOCUMENT_CATEGORIES.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              )
            )}
          </select>

          {canManage ? (
            <select
              value={accessLevel}
              onChange={(event) =>
                setAccessLevel(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
            >
              <option value="all">
                Усі рівні доступу
              </option>
              {OBJECT_DOCUMENT_ACCESS_LEVELS.map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          ) : (
            <div className="flex min-h-11 items-center rounded-lg bg-blue-50 px-3 text-sm text-blue-700">
              Доступні файли команди
            </div>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl">
            📄
          </div>
          <p className="mt-3 font-medium text-gray-700">
            Документів ще немає
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {canManage
              ? "Додай перший робочий файл об’єкта."
              : "Для команди поки немає доступних документів."}
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed bg-gray-50/50 p-6 text-center text-sm text-gray-500">
          За вибраними фільтрами документів не знайдено.
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {filteredDocuments.map(
              (document) => (
                <article
                  key={document.id}
                  className="min-w-0 rounded-xl border p-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-xl"
                    >
                      {getObjectDocumentIcon(
                        document.mime_type
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold text-gray-900">
                        {document.title}
                      </h3>
                      <p className="mt-1 break-all text-xs text-gray-500">
                        {document.original_file_name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {getObjectDocumentCategoryLabel(
                        document.category
                      )}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        document.access_level ===
                        "management"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {getObjectDocumentAccessLabel(
                        document.access_level
                      )}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    {formatObjectDocumentFileSize(
                      document.file_size
                    )}
                    {" · "}
                    {formatDocumentDate(
                      document.created_at
                    )}
                  </p>

                  {document.note && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
                      {document.note}
                    </p>
                  )}

                  <div className={`mt-4 grid gap-2 border-t pt-4 ${canManage ? "grid-cols-3" : "grid-cols-1"}`}>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpen(
                          document
                        )
                      }
                      disabled={
                        openingId !== null
                      }
                      className="min-h-10 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                    >
                      {openingId ===
                      document.id
                        ? "..."
                        : "Відкрити"}
                    </button>

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(
                              editingId ===
                                document.id
                                ? null
                                : document.id
                            )
                          }
                          className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              document
                            )
                          }
                          disabled={
                            deletingId !== null
                          }
                          className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId ===
                          document.id
                            ? "..."
                            : "Видалити"}
                        </button>
                      </>
                    )}
                  </div>

                  {canManage &&
                    editingId ===
                      document.id && (
                      <div className="mt-4">
                        <ObjectDocumentMetadataForm
                          document={document}
                          onCancel={() =>
                            setEditingId(
                              null
                            )
                          }
                        />
                      </div>
                    )}
                </article>
              )
            )}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 text-left text-sm text-gray-600">
                <tr>
                  <th className="p-4">Документ</th>
                  <th className="p-4">Категорія</th>
                  <th className="p-4">Доступ</th>
                  <th className="p-4">Розмір / дата</th>
                  <th className="p-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map(
                  (document) => (
                    <Fragment key={document.id}>
                      <tr className="border-t align-top">
                        <td className="min-w-[280px] p-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              aria-hidden="true"
                              className="text-xl"
                            >
                              {getObjectDocumentIcon(
                                document.mime_type
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="break-words font-semibold text-gray-900">
                                {document.title}
                              </p>
                              <p className="mt-1 break-all text-xs text-gray-500">
                                {document.original_file_name}
                              </p>
                              {document.note && (
                                <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-gray-500">
                                  {document.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {getObjectDocumentCategoryLabel(
                            document.category
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                              document.access_level ===
                              "management"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {getObjectDocumentAccessLabel(
                              document.access_level
                            )}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          <p>
                            {formatObjectDocumentFileSize(
                              document.file_size
                            )}
                          </p>
                          <p className="mt-1">
                            {formatDocumentDate(
                              document.created_at
                            )}
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpen(
                                  document
                                )
                              }
                              disabled={
                                openingId !== null
                              }
                              className="min-h-10 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                            >
                              {openingId ===
                              document.id
                                ? "..."
                                : "Відкрити"}
                            </button>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingId(
                                      editingId ===
                                        document.id
                                        ? null
                                        : document.id
                                    )
                                  }
                                  className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  Редагувати
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      document
                                    )
                                  }
                                  disabled={
                                    deletingId !== null
                                  }
                                  className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                                >
                                  {deletingId ===
                                  document.id
                                    ? "..."
                                    : "Видалити"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {canManage &&
                        editingId ===
                          document.id && (
                          <tr className="border-t">
                            <td
                              colSpan={5}
                              className="p-4"
                            >
                              <ObjectDocumentMetadataForm
                                document={document}
                                onCancel={() =>
                                  setEditingId(
                                    null
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

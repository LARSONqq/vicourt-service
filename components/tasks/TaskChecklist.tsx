"use client";

import { useRouter } from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import {
  addTaskChecklistItem,
  deleteTaskChecklistItem,
  getTaskChecklistItems,
  toggleTaskChecklistItem,
} from "@/app/actions/taskChecklistActions";

import type { TaskChecklistItem } from "@/types/taskChecklistItem";

type Props = {
  taskId: number;
  objectId: number;
};

export default function TaskChecklist({
  taskId,
  objectId,
}: Props) {
  const router = useRouter();

  const [items, setItems] =
    useState<TaskChecklistItem[]>([]);

  const [
    newItemTitle,
    setNewItemTitle,
  ] = useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isAdding, setIsAdding] =
    useState(false);

  const [
    pendingItemId,
    setPendingItemId,
  ] = useState<number | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadChecklist() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const loadedItems =
          await getTaskChecklistItems(
            taskId
          );

        if (!isActive) {
          return;
        }

        setItems(loadedItems);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити чекліст."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadChecklist();

    return () => {
      isActive = false;
    };
  }, [taskId]);

  const completedCount =
    useMemo(() => {
      return items.filter(
        (item) =>
          item.is_completed
      ).length;
    }, [items]);

  const progressPercent =
    items.length > 0
      ? Math.round(
          (completedCount /
            items.length) *
            100
        )
      : 0;

  async function handleAddItem() {
    const normalizedTitle =
      newItemTitle.trim();

    if (
      !normalizedTitle ||
      isAdding
    ) {
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    try {
      const createdItem =
        await addTaskChecklistItem(
          taskId,
          objectId,
          normalizedTitle
        );

      setItems(
        (currentItems) => [
          ...currentItems,
          createdItem,
        ]
      );

      setNewItemTitle("");

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати пункт."
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function handleToggleItem(
    item: TaskChecklistItem
  ) {
    if (
      pendingItemId !== null
    ) {
      return;
    }

    const previousItems =
      items;

    const nextCompleted =
      !item.is_completed;

    setPendingItemId(
      item.id
    );

    setErrorMessage("");

    setItems(
      (currentItems) =>
        currentItems.map(
          (currentItem) =>
            currentItem.id ===
            item.id
              ? {
                  ...currentItem,
                  is_completed:
                    nextCompleted,
                }
              : currentItem
        )
    );

    try {
      const updatedItem =
        await toggleTaskChecklistItem(
          item.id,
          taskId,
          objectId,
          nextCompleted
        );

      setItems(
        (currentItems) =>
          currentItems.map(
            (currentItem) =>
              currentItem.id ===
              updatedItem.id
                ? updatedItem
                : currentItem
          )
      );

      router.refresh();
    } catch (error) {
      setItems(
        previousItems
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити пункт."
      );
    } finally {
      setPendingItemId(
        null
      );
    }
  }

  async function handleDeleteItem(
    item: TaskChecklistItem
  ) {
    const confirmed =
      window.confirm(
        `Видалити пункт «${item.title}»?`
      );

    if (
      !confirmed ||
      pendingItemId !== null
    ) {
      return;
    }

    const previousItems =
      items;

    setPendingItemId(
      item.id
    );

    setErrorMessage("");

    setItems(
      (currentItems) =>
        currentItems.filter(
          (currentItem) =>
            currentItem.id !==
            item.id
        )
    );

    try {
      await deleteTaskChecklistItem(
        item.id,
        taskId,
        objectId
      );

      router.refresh();
    } catch (error) {
      setItems(
        previousItems
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити пункт."
      );
    } finally {
      setPendingItemId(
        null
      );
    }
  }

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key !== "Enter"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    handleAddItem();
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800">
            Чекліст
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Розбий завдання на окремі
            етапи
          </p>
        </div>

        <span className="w-fit shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {completedCount} із{" "}
          {items.length} виконано
        </span>
      </div>

      {/* PROGRESS */}
      {items.length > 0 && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-600 transition-all"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>

          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>
              Прогрес
            </span>

            <span>
              {progressPercent}%
            </span>
          </div>
        </div>
      )}

      {/* ERROR */}
      {errorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* ADD ITEM */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          value={newItemTitle}
          disabled={isAdding}
          onChange={(event) =>
            setNewItemTitle(
              event.target.value
            )
          }
          onKeyDown={
            handleInputKeyDown
          }
          placeholder="Новий пункт чекліста"
          maxLength={250}
          className="min-h-11 min-w-0 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition placeholder:text-gray-400 focus:border-green-600 disabled:opacity-60"
        />

        <button
          type="button"
          disabled={
            isAdding ||
            !newItemTitle.trim()
          }
          onClick={
            handleAddItem
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isAdding
            ? "Додавання..."
            : "+ Додати"}
        </button>
      </div>

      {/* ITEMS */}
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="rounded-lg bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            Завантаження чекліста...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-gray-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-gray-600">
              Пунктів поки немає
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Додай перший етап вище
            </p>
          </div>
        ) : (
          items.map(
            (item) => {
              const isPending =
                pendingItemId ===
                item.id;

              return (
                <div
                  key={item.id}
                  className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border p-3 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start ${
                    item.is_completed
                      ? "border-green-100 bg-green-50/50"
                      : "bg-white"
                  }`}
                >
                  {/* CHECK */}
                  <button
                    type="button"
                    disabled={
                      pendingItemId !==
                      null
                    }
                    aria-pressed={
                      item.is_completed
                    }
                    onClick={() =>
                      handleToggleItem(
                        item
                      )
                    }
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      item.is_completed
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-gray-300 bg-white text-transparent hover:border-green-500"
                    }`}
                  >
                    ✓
                  </button>

                  {/* TITLE */}
                  <p
                    className={`min-w-0 break-words pt-1 text-sm leading-5 ${
                      item.is_completed
                        ? "text-gray-500 line-through"
                        : "text-gray-800"
                    }`}
                  >
                    {item.title}
                  </p>

                  {/* DELETE */}
                  <button
                    type="button"
                    disabled={
                      pendingItemId !==
                      null
                    }
                    onClick={() =>
                      handleDeleteItem(
                        item
                      )
                    }
                    className="col-start-2 w-fit rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:col-start-3 sm:row-start-1"
                  >
                    {isPending
                      ? "..."
                      : "Видалити"}
                  </button>
                </div>
              );
            }
          )
        )}
      </div>
    </section>
  );
}
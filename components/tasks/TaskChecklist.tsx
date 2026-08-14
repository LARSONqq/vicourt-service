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

  const [items, setItems] = useState<
    TaskChecklistItem[]
  >([]);

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

  const completedCount = useMemo(() => {
    return items.filter(
      (item) => item.is_completed
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

    if (!normalizedTitle || isAdding) {
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

      setItems((currentItems) => [
        ...currentItems,
        createdItem,
      ]);

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
    if (pendingItemId !== null) {
      return;
    }

    const previousItems = items;

    const nextCompleted =
      !item.is_completed;

    setPendingItemId(item.id);
    setErrorMessage("");

    setItems((currentItems) =>
      currentItems.map(
        (currentItem) =>
          currentItem.id === item.id
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

      setItems((currentItems) =>
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
      setItems(previousItems);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити пункт."
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleDeleteItem(
    item: TaskChecklistItem
  ) {
    const confirmed = window.confirm(
      `Видалити пункт «${item.title}»?`
    );

    if (
      !confirmed ||
      pendingItemId !== null
    ) {
      return;
    }

    const previousItems = items;

    setPendingItemId(item.id);
    setErrorMessage("");

    setItems((currentItems) =>
      currentItems.filter(
        (currentItem) =>
          currentItem.id !== item.id
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
      setItems(previousItems);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити пункт."
      );
    } finally {
      setPendingItemId(null);
    }
  }

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    handleAddItem();
  }

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            Чекліст
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Розбий завдання на окремі
            етапи
          </p>
        </div>

        <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {completedCount} із{" "}
          {items.length} виконано
        </span>
      </div>

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

          <p className="mt-1 text-right text-xs text-gray-500">
            {progressPercent}%
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600 disabled:opacity-60"
        />

        <button
          type="button"
          disabled={
            isAdding ||
            !newItemTitle.trim()
          }
          onClick={handleAddItem}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAdding
            ? "Додавання..."
            : "+ Додати"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="rounded-lg bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            Завантаження чекліста...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">
            Пунктів поки що немає
          </div>
        ) : (
          items.map((item) => {
            const isPending =
              pendingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition ${
                  item.is_completed
                    ? "border-green-100 bg-green-50/50"
                    : "bg-white"
                }`}
              >
                <button
                  type="button"
                  disabled={
                    pendingItemId !== null
                  }
                  aria-pressed={
                    item.is_completed
                  }
                  onClick={() =>
                    handleToggleItem(item)
                  }
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    item.is_completed
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-transparent hover:border-green-500"
                  }`}
                >
                  ✓
                </button>

                <p
                  className={`min-w-0 flex-1 text-sm ${
                    item.is_completed
                      ? "text-gray-500 line-through"
                      : "text-gray-800"
                  }`}
                >
                  {item.title}
                </p>

                <button
                  type="button"
                  disabled={
                    pendingItemId !== null
                  }
                  onClick={() =>
                    handleDeleteItem(item)
                  }
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending
                    ? "..."
                    : "Видалити"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
import Link from "next/link";

import CompleteTaskButton from "@/components/dashboard/CompleteTaskButton";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
import TodayTasksSection from "@/components/dashboard/TodayTasksSection";

import { getObjects } from "@/services/objectService";
import {
  getPlannedPurchaseTotals,
} from "@/services/purchaseService";
import { getAllTasks } from "@/services/taskService";
import { getWarehouseItems } from "@/services/warehouseService";

import type {
  TaskWithObject,
} from "@/types/taskWithObject";

function getObjectStatusStyle(
  status: string | null
) {
  switch (status) {
    case "Новий":
      return "bg-blue-100 text-blue-700";

    case "В роботі":
      return "bg-green-100 text-green-700";

    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";

    case "Завершено":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getTaskStatusStyle(
  status: string
) {
  switch (status) {
    case "Заплановано":
      return "bg-blue-50 text-blue-700";

    case "В роботі":
      return "bg-yellow-50 text-yellow-700";

    case "Виконано":
      return "bg-green-50 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getPriorityStyle(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "bg-red-100 text-red-700";

    case "Високий":
      return "bg-orange-100 text-orange-700";

    case "Середній":
      return "bg-violet-100 text-violet-700";

    case "Низький":
      return "bg-gray-100 text-gray-600";

    default:
      return "bg-violet-100 text-violet-700";
  }
}

function getPriorityBorderStyle(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "border-l-red-500";

    case "Високий":
      return "border-l-orange-500";

    case "Середній":
      return "border-l-violet-400";

    case "Низький":
      return "border-l-gray-300";

    default:
      return "border-l-violet-400";
  }
}

function getPriorityOrder(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return 1;

    case "Високий":
      return 2;

    case "Середній":
      return 3;

    case "Низький":
      return 4;

    default:
      return 3;
  }
}

function formatDate(
  date: string | null
) {
  if (!date) {
    return "Дата не вказана";
  }

  const [
    year,
    month,
    day,
  ] = date.split("-");

  return `${day}.${month}.${year}`;
}

function formatCreatedDate(
  date: string
) {
  const datePart =
    date.slice(0, 10);

  const [
    year,
    month,
    day,
  ] = datePart.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return "Невідома дата";
  }

  return `${day}.${month}.${year}`;
}

function getTodayValue() {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(
    2,
    "0"
  );

  const day = String(
    today.getDate()
  ).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function isTaskOverdue(
  task: TaskWithObject,
  today: string
) {
  return Boolean(
    task.due_date &&
      task.due_date < today &&
      task.status !==
        "Виконано"
  );
}

function getAttentionTaskScore(
  task: TaskWithObject,
  today: string
) {
  if (
    isTaskOverdue(
      task,
      today
    )
  ) {
    return 1;
  }

  if (
    task.priority ===
    "Терміновий"
  ) {
    return 2;
  }

  return 3;
}

export default async function HomePage() {
  const [
    objects,
    tasks,
    warehouseItems,
    plannedPurchaseTotals,
  ] = await Promise.all([
    getObjects(),
    getAllTasks(),
    getWarehouseItems(),
    getPlannedPurchaseTotals(),
  ]);

  const objectList =
    Array.isArray(
      objects
    )
      ? objects
      : [];

  const taskList =
    Array.isArray(
      tasks
    )
      ? tasks
      : [];

  const warehouseItemList =
    Array.isArray(
      warehouseItems
    )
      ? warehouseItems
      : [];

  const today =
    getTodayValue();

  const totalObjects =
    objectList.length;

  const activeObjects =
    objectList.filter(
      (object) =>
        object.status ===
        "В роботі"
    ).length;

  const completedObjects =
    objectList.filter(
      (object) =>
        object.status ===
        "Завершено"
    ).length;

  const activeTasks =
    taskList.filter(
      (task) =>
        task.status !==
        "Виконано"
    );

  const overdueTasks =
    activeTasks.filter(
      (task) =>
        isTaskOverdue(
          task,
          today
        )
    );

  const urgentTasks =
    activeTasks.filter(
      (task) =>
        task.priority ===
        "Терміновий"
    );

  const todayTasks =
    activeTasks
      .filter(
        (task) =>
          task.due_date ===
          today
      )
      .sort(
        (
          firstTask,
          secondTask
        ) => {
          const priorityDifference =
            getPriorityOrder(
              firstTask.priority
            ) -
            getPriorityOrder(
              secondTask.priority
            );

          if (
            priorityDifference !==
            0
          ) {
            return priorityDifference;
          }

          return firstTask.title.localeCompare(
            secondTask.title,
            "uk"
          );
        }
      );

  const completedTasks =
    taskList.filter(
      (task) =>
        task.status ===
        "Виконано"
    ).length;

  const recentObjects =
    objectList.slice(
      0,
      5
    );

  const attentionTasks =
    activeTasks
      .filter(
        (task) =>
          isTaskOverdue(
            task,
            today
          ) ||
          task.priority ===
            "Терміновий"
      )
      .sort(
        (
          firstTask,
          secondTask
        ) => {
          const firstScore =
            getAttentionTaskScore(
              firstTask,
              today
            );

          const secondScore =
            getAttentionTaskScore(
              secondTask,
              today
            );

          if (
            firstScore !==
            secondScore
          ) {
            return (
              firstScore -
              secondScore
            );
          }

          if (
            firstTask.due_date &&
            secondTask.due_date
          ) {
            return firstTask.due_date.localeCompare(
              secondTask.due_date
            );
          }

          if (
            firstTask.due_date
          ) {
            return -1;
          }

          if (
            secondTask.due_date
          ) {
            return 1;
          }

          return firstTask.title.localeCompare(
            secondTask.title,
            "uk"
          );
        }
      )
      .slice(
        0,
        6
      );

  const nearestTasks =
    activeTasks
      .filter(
        (task) =>
          task.due_date
      )
      .sort(
        (
          firstTask,
          secondTask
        ) =>
          firstTask.due_date!.localeCompare(
            secondTask.due_date!
          )
      )
      .slice(
        0,
        5
      );

  const lowStockItems =
    warehouseItemList
      .filter(
        (item) =>
          Number(
            item.quantity
          ) <=
          Number(
            item.min_quantity
          )
      )
      .sort(
        (
          firstItem,
          secondItem
        ) => {
          const firstQuantity =
            Number(
              firstItem.quantity
            );

          const secondQuantity =
            Number(
              secondItem.quantity
            );

          const firstPlanned =
            Number(
              plannedPurchaseTotals[
                firstItem.id
              ] || 0
            );

          const secondPlanned =
            Number(
              plannedPurchaseTotals[
                secondItem.id
              ] || 0
            );

          const firstExpected =
            firstQuantity +
            firstPlanned;

          const secondExpected =
            secondQuantity +
            secondPlanned;

          const firstMinimum =
            Number(
              firstItem.min_quantity
            );

          const secondMinimum =
            Number(
              secondItem.min_quantity
            );

          const firstNeedsPurchase =
            firstExpected <
            firstMinimum;

          const secondNeedsPurchase =
            secondExpected <
            secondMinimum;

          if (
            firstNeedsPurchase &&
            !secondNeedsPurchase
          ) {
            return -1;
          }

          if (
            secondNeedsPurchase &&
            !firstNeedsPurchase
          ) {
            return 1;
          }

          return (
            firstExpected -
            secondExpected
          );
        }
      )
      .slice(
        0,
        6
      );

  const itemsNeedingPurchase =
    warehouseItemList.filter(
      (item) => {
        const quantity =
          Number(
            item.quantity
          );

        const minimum =
          Number(
            item.min_quantity
          );

        const planned =
          Number(
            plannedPurchaseTotals[
              item.id
            ] || 0
          );

        const expected =
          quantity +
          planned;

        return (
          quantity <= minimum &&
          expected < minimum
        );
      }
    );

  const hasAttentionTasks =
    attentionTasks.length >
    0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Головна панель
          </h1>

          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Загальна інформація про
            об’єкти, завдання та склад
          </p>
        </div>

        <Link
          href="/objects/new"
          className="w-full rounded-lg bg-green-600 px-5 py-3 text-center font-medium text-white hover:bg-green-700 sm:w-fit"
        >
          + Новий об’єкт
        </Link>
      </div>

      {/* MAIN STATS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Усього об’єктів
          </p>

          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {totalObjects}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Об’єктів у роботі
          </p>

          <p className="mt-2 text-2xl font-bold text-green-600 sm:text-3xl">
            {activeObjects}
          </p>
        </div>

        <div
          className={`rounded-xl border bg-white p-4 sm:p-5 ${
            urgentTasks.length >
            0
              ? "border-orange-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Термінових завдань
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              urgentTasks.length >
              0
                ? "text-orange-600"
                : "text-gray-700"
            }`}
          >
            {urgentTasks.length}
          </p>
        </div>

        <div
          className={`rounded-xl border bg-white p-4 sm:p-5 ${
            overdueTasks.length >
            0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Прострочених завдань
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              overdueTasks.length >
              0
                ? "text-red-600"
                : "text-gray-700"
            }`}
          >
            {overdueTasks.length}
          </p>
        </div>

        <Link
          href="/purchases"
          className={`col-span-2 rounded-xl border bg-white p-4 transition hover:bg-gray-50 sm:p-5 md:col-span-1 ${
            itemsNeedingPurchase.length >
            0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Потрібно закупити
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              itemsNeedingPurchase.length >
              0
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {
              itemsNeedingPurchase.length
            }
          </p>
        </Link>
      </div>

      {/* ATTENTION */}
      {hasAttentionTasks ? (
        <section className="overflow-hidden rounded-xl border border-red-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-semibold text-red-800 sm:text-xl">
                Потребують уваги
              </h2>

              <p className="mt-1 text-sm text-red-700">
                Термінові та
                прострочені завдання
              </p>
            </div>

            <Link
              href="/task"
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-red-700 sm:w-fit"
            >
              Переглянути завдання
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-2">
            {attentionTasks.map(
              (task) => {
                const overdue =
                  isTaskOverdue(
                    task,
                    today
                  );

                const priority =
                  task.priority ||
                  "Середній";

                return (
                  <article
                    key={task.id}
                    className={`min-w-0 rounded-xl border border-l-4 bg-white p-4 ${getPriorityBorderStyle(
                      priority
                    )}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">
                          {
                            task.title
                          }
                        </h3>

                        {task.object && (
                          <Link
                            href={`/objects/${task.object.id}`}
                            className="mt-1 block break-words text-sm font-medium text-green-700 hover:underline"
                          >
                            {
                              task
                                .object
                                .name
                            }
                          </Link>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityStyle(
                            priority
                          )}`}
                        >
                          {priority}
                        </span>

                        {overdue && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Прострочено
                          </span>
                        )}
                      </div>
                    </div>

                    {task.description && (
                      <p className="mt-3 line-clamp-2 break-words text-sm text-gray-600">
                        {
                          task.description
                        }
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          Термін
                        </p>

                        <p
                          className={`mt-1 break-words font-medium ${
                            overdue
                              ? "text-red-600"
                              : "text-gray-700"
                          }`}
                        >
                          {formatDate(
                            task.due_date
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          Відповідальний
                        </p>

                        <p className="mt-1 break-words font-medium text-gray-700">
                          {task.assignee ||
                            "Не призначено"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusStyle(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RescheduleTaskButton
                          taskId={
                            task.id
                          }
                          objectId={
                            task.object_id
                          }
                          currentDate={
                            task.due_date
                          }
                          compact
                        />

                        <CompleteTaskButton
                          taskId={
                            task.id
                          }
                          objectId={
                            task.object_id
                          }
                          compact
                        />

                        <Link
                          href="/task"
                          className="inline-flex px-2 py-2 text-sm font-medium text-green-700 hover:underline"
                        >
                          Відкрити →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
              ✓
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Усе під контролем
              </h2>

              <p className="text-sm text-gray-500">
                Термінових і
                прострочених завдань
                немає
              </p>
            </div>
          </div>

          <Link
            href="/calendar"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Відкрити календар
          </Link>
        </section>
      )}

      {/* TODAY */}
      {todayTasks.length >
        0 && (
        <TodayTasksSection
          tasks={todayTasks}
          today={today}
        />
      )}

      {/* LOW STOCK */}
      <section
        className={`overflow-hidden rounded-xl border bg-white ${
          lowStockItems.length >
          0
            ? "border-orange-200"
            : ""
        }`}
      >
        <div
          className={`flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
            lowStockItems.length >
            0
              ? "border-orange-100 bg-orange-50"
              : ""
          }`}
        >
          <div>
            <h2
              className={`text-lg font-semibold sm:text-xl ${
                lowStockItems.length >
                0
                  ? "text-orange-800"
                  : ""
              }`}
            >
              Низькі залишки складу
            </h2>

            <p
              className={`mt-1 text-sm ${
                lowStockItems.length >
                0
                  ? "text-orange-700"
                  : "text-gray-500"
              }`}
            >
              Фактичний та очікуваний
              запас матеріалів
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              href="/purchases"
              className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-center text-sm font-medium text-orange-700 hover:bg-orange-100 sm:px-4"
            >
              Закупівлі
            </Link>

            <Link
              href="/warehouse"
              className="rounded-lg bg-orange-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-orange-700 sm:px-4"
            >
              Відкрити склад
            </Link>
          </div>
        </div>

        {lowStockItems.length ===
        0 ? (
          <div className="flex items-start gap-3 p-4 sm:items-center sm:p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 font-semibold text-green-700">
              ✓
            </div>

            <div>
              <p className="font-medium text-gray-800">
                Залишків достатньо
              </p>

              <p className="text-sm text-gray-500">
                Матеріалів із низьким
                залишком немає
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:gap-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {lowStockItems.map(
              (item) => {
                const quantity =
                  Number(
                    item.quantity
                  );

                const minimum =
                  Number(
                    item.min_quantity
                  );

                const planned =
                  Number(
                    plannedPurchaseTotals[
                      item.id
                    ] || 0
                  );

                const expected =
                  quantity +
                  planned;

                const shortage =
                  Math.max(
                    minimum -
                      expected,
                    0
                  );

                const purchaseCovered =
                  expected >=
                  minimum;

                const isOutOfStock =
                  quantity <= 0;

                const percentage =
                  minimum > 0
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          (
                            expected /
                            minimum
                          ) *
                            100
                        )
                      )
                    : 100;

                return (
                  <article
                    key={item.id}
                    className={`min-w-0 rounded-xl border p-4 ${
                      purchaseCovered
                        ? "border-green-200 bg-green-50"
                        : isOutOfStock
                          ? "border-red-200 bg-red-50"
                          : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-gray-900">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {item.category ||
                            "Без категорії"}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                          purchaseCovered
                            ? "bg-green-100 text-green-700"
                            : isOutOfStock
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {purchaseCovered
                          ? "Закупівлю заплановано"
                          : isOutOfStock
                            ? "Немає"
                            : "Закінчується"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          На складі
                        </p>

                        <p className="mt-1 break-words text-lg font-bold text-gray-900 sm:text-xl">
                          {quantity}{" "}
                          {item.unit}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Мінімум
                        </p>

                        <p className="mt-1 break-words text-lg font-bold text-gray-700 sm:text-xl">
                          {minimum}{" "}
                          {item.unit}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Заплановано
                        </p>

                        <p
                          className={`mt-1 break-words text-lg font-bold sm:text-xl ${
                            planned > 0
                              ? "text-blue-700"
                              : "text-gray-400"
                          }`}
                        >
                          +{planned}{" "}
                          {item.unit}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Очікується
                        </p>

                        <p
                          className={`mt-1 break-words text-lg font-bold sm:text-xl ${
                            purchaseCovered
                              ? "text-green-700"
                              : "text-orange-700"
                          }`}
                        >
                          {expected}{" "}
                          {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${
                          purchaseCovered
                            ? "bg-green-500"
                            : isOutOfStock
                              ? "bg-red-500"
                              : "bg-orange-500"
                        }`}
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    {purchaseCovered ? (
                      <div className="mt-4 rounded-lg border border-green-200 bg-white/70 p-3">
                        <p className="text-sm font-medium text-green-700">
                          ✓ Після
                          оприбуткування запас
                          буде достатнім
                        </p>

                        <Link
                          href="/purchases"
                          className="mt-2 inline-block text-sm font-medium text-green-700 hover:underline"
                        >
                          Переглянути
                          закупівлю →
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 rounded-lg border border-orange-200 bg-white/70 p-3">
                          <p className="text-sm text-gray-600">
                            Ще потрібно
                            запланувати:
                          </p>

                          <p className="mt-1 font-semibold text-orange-700">
                            {shortage}{" "}
                            {item.unit}
                          </p>
                        </div>

                        <div className="mt-4 border-t border-black/5 pt-4">
                          <Link
                            href={`/purchases?item=${item.id}#new-purchase`}
                            className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
                              isOutOfStock
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-orange-600 text-white hover:bg-orange-700"
                            }`}
                          >
                            + Запланувати
                            ще {shortage}{" "}
                            {item.unit}
                          </Link>
                        </div>
                      </>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* RECENT / NEAREST */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <section className="order-2 overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Найближчі завдання
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Завдання з найближчим
                терміном
              </p>
            </div>

            <Link
              href="/task"
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Переглянути всі
            </Link>
          </div>

          {nearestTasks.length ===
          0 ? (
            <div className="p-6 text-center sm:p-8">
              <p className="text-gray-500">
                Активних завдань із
                терміном немає.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {nearestTasks.map(
                (task) => {
                  const overdue =
                    isTaskOverdue(
                      task,
                      today
                    );

                  const priority =
                    task.priority ||
                    "Середній";

                  return (
                    <div
                      key={task.id}
                      className="min-w-0 p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-semibold">
                            {
                              task.title
                            }
                          </p>

                          {task.object && (
                            <Link
                              href={`/objects/${task.object.id}`}
                              className="mt-1 block break-words text-sm text-green-700 hover:underline"
                            >
                              {
                                task
                                  .object
                                  .name
                              }
                            </Link>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityStyle(
                              priority
                            )}`}
                          >
                            {priority}
                          </span>

                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusStyle(
                              task.status
                            )}`}
                          >
                            {
                              task.status
                            }
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={
                            overdue
                              ? "font-medium text-red-600"
                              : "text-gray-500"
                          }
                        >
                          До:{" "}
                          {formatDate(
                            task.due_date
                          )}
                        </span>

                        {overdue && (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                            Прострочено
                          </span>
                        )}
                      </div>

                      <div className="mt-4 border-t pt-4">
                        <p className="break-words text-sm text-gray-500">
                          Відповідальний:{" "}
                          <span className="font-medium text-gray-700">
                            {task.assignee ||
                              "Не призначено"}
                          </span>
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <RescheduleTaskButton
                            taskId={
                              task.id
                            }
                            objectId={
                              task.object_id
                            }
                            currentDate={
                              task.due_date
                            }
                            compact
                          />

                          <CompleteTaskButton
                            taskId={
                              task.id
                            }
                            objectId={
                              task.object_id
                            }
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="order-1 overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Останні об’єкти
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                П’ять останніх
                створених об’єктів
              </p>
            </div>

            <Link
              href="/objects"
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Переглянути всі
            </Link>
          </div>

          {recentObjects.length ===
          0 ? (
            <div className="p-6 text-center sm:p-8">
              <p className="text-gray-500">
                Об’єктів поки що
                немає.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentObjects.map(
                (object) => (
                  <Link
                    key={object.id}
                    href={`/objects/${object.id}`}
                    className="flex min-w-0 flex-col gap-3 p-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold">
                        {object.name}
                      </p>

                      <p className="mt-1 break-words text-sm text-gray-500">
                        {object.customer ||
                          "Замовника не вказано"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${getObjectStatusStyle(
                          object.status
                        )}`}
                      >
                        {object.status ||
                          "Без статусу"}
                      </span>

                      <p className="text-xs text-gray-400">
                        {formatCreatedDate(
                          object.created_at
                        )}
                      </p>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM STATS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Активних завдань
          </p>

          <p className="mt-2 text-xl font-bold text-yellow-600 sm:text-2xl">
            {activeTasks.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Завершених об’єктів
          </p>

          <p className="mt-2 text-xl font-bold text-gray-700 sm:text-2xl">
            {completedObjects}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Виконаних завдань
          </p>

          <p className="mt-2 text-xl font-bold text-green-600 sm:text-2xl">
            {completedTasks}
          </p>
        </div>
      </div>
    </div>
  );
}
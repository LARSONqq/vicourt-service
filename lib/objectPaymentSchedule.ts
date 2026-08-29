import {
  fromMoneyInCents,
  toMoneyInCents,
} from "@/lib/objectPayments";

import type {
  AllocatedObjectPaymentScheduleItem,
  ObjectPaymentScheduleItem,
  ObjectPaymentScheduleStatus,
  ObjectPaymentScheduleSummary,
} from "@/types/objectPaymentSchedule";

function compareScheduleItems(
  first: ObjectPaymentScheduleItem,
  second: ObjectPaymentScheduleItem
) {
  return (
    first.due_date.localeCompare(
      second.due_date
    ) ||
    first.created_at.localeCompare(
      second.created_at
    ) ||
    first.id - second.id
  );
}

function getScheduleStatus(
  dueDate: string,
  paidInCents: number,
  remainingInCents: number,
  today: string
): ObjectPaymentScheduleStatus {
  if (remainingInCents <= 0) {
    return "paid";
  }

  if (dueDate < today) {
    return "overdue";
  }

  if (dueDate === today) {
    return "due_today";
  }

  return paidInCents > 0
    ? "partially_paid"
    : "planned";
}

export function calculateObjectPaymentSchedule<
  T extends ObjectPaymentScheduleItem,
>(
  scheduleItems: T[],
  lifetimeTotalPaid: number,
  clientPrice: number | null,
  today: string
): ObjectPaymentScheduleSummary<T> {
  const sortedItems = [
    ...scheduleItems,
  ].sort(compareScheduleItems);
  const totalPaidInCents =
    Math.max(
      toMoneyInCents(
        lifetimeTotalPaid
      ),
      0
    );
  let plannedBeforeInCents =
    0;
  let cumulativeDueInCents =
    0;

  const items = sortedItems.map(
    (
      item
    ): AllocatedObjectPaymentScheduleItem<T> => {
      const amountInCents =
        Math.max(
          toMoneyInCents(
            Number(item.amount)
          ),
          0
        );
      const paidInCents =
        Math.min(
          Math.max(
            totalPaidInCents -
              plannedBeforeInCents,
            0
          ),
          amountInCents
        );
      const remainingInCents =
        amountInCents -
        paidInCents;

      if (item.due_date <= today) {
        cumulativeDueInCents +=
          amountInCents;
      }

      plannedBeforeInCents +=
        amountInCents;

      return {
        ...item,
        amount:
          fromMoneyInCents(
            amountInCents
          ),
        paidAmount:
          fromMoneyInCents(
            paidInCents
          ),
        remainingAmount:
          fromMoneyInCents(
            remainingInCents
          ),
        overdueAmount:
          item.due_date < today
            ? fromMoneyInCents(
                remainingInCents
              )
            : 0,
        status:
          getScheduleStatus(
            item.due_date,
            paidInCents,
            remainingInCents,
            today
          ),
      };
    }
  );

  const scheduledTotalInCents =
    plannedBeforeInCents;
  const remainingScheduledInCents =
    items.reduce(
      (total, item) =>
        total +
        toMoneyInCents(
          item.remainingAmount
        ),
      0
    );
  const overdueInCents =
    items.reduce(
      (total, item) =>
        total +
        toMoneyInCents(
          item.overdueAmount
        ),
      0
    );
  const normalizedClientPrice =
    clientPrice === null ||
    !Number.isFinite(clientPrice)
      ? null
      : Math.max(
          toMoneyInCents(
            clientPrice
          ),
          0
        );

  return {
    items,
    scheduledTotal:
      fromMoneyInCents(
        scheduledTotalInCents
      ),
    totalPaid:
      fromMoneyInCents(
        totalPaidInCents
      ),
    remainingScheduled:
      fromMoneyInCents(
        remainingScheduledInCents
      ),
    remainingToReceive:
      fromMoneyInCents(
        normalizedClientPrice ===
        null
          ? remainingScheduledInCents
          : Math.max(
              normalizedClientPrice -
                totalPaidInCents,
              0
            )
      ),
    cumulativeDue:
      fromMoneyInCents(
        cumulativeDueInCents
      ),
    overdueAmount:
      fromMoneyInCents(
        overdueInCents
      ),
    unscheduledAmount:
      normalizedClientPrice ===
      null
        ? null
        : fromMoneyInCents(
            Math.max(
              normalizedClientPrice -
                scheduledTotalInCents,
              0
            )
          ),
    scheduleOverage:
      normalizedClientPrice ===
      null
        ? null
        : fromMoneyInCents(
            Math.max(
              scheduledTotalInCents -
                normalizedClientPrice,
              0
            )
          ),
    nextPayment:
      items.find(
        (item) =>
          item.remainingAmount > 0
      ) ?? null,
  };
}

import type {
  ObjectPaymentStatus,
  ObjectPaymentSummary,
} from "@/types/objectPayment";

function toMoneyInCents(
  value: number
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function fromMoneyInCents(
  value: number
) {
  return value / 100;
}

export function calculateObjectPaymentSummary(
  clientPrice: number | null,
  paymentAmounts: number[]
): ObjectPaymentSummary {
  const normalizedClientPrice =
    clientPrice === null ||
    !Number.isFinite(clientPrice)
      ? null
      : fromMoneyInCents(
          toMoneyInCents(
            clientPrice
          )
        );
  const totalPaidInCents =
    paymentAmounts.reduce(
      (total, amount) =>
        total +
        Math.max(
          toMoneyInCents(
            amount
          ),
          0
        ),
      0
    );
  const totalPaid =
    fromMoneyInCents(
      totalPaidInCents
    );

  if (
    normalizedClientPrice ===
    null
  ) {
    return {
      clientPrice: null,
      totalPaid,
      remainingToPay: null,
      overpayment: null,
      status: "price_missing",
      progressPercent: null,
    };
  }

  const clientPriceInCents =
    toMoneyInCents(
      normalizedClientPrice
    );
  const differenceInCents =
    clientPriceInCents -
    totalPaidInCents;
  let status: ObjectPaymentStatus;

  if (totalPaidInCents === 0) {
    status = "unpaid";
  } else if (
    differenceInCents > 0
  ) {
    status = "partially_paid";
  } else if (
    differenceInCents === 0
  ) {
    status = "paid";
  } else {
    status = "overpaid";
  }

  return {
    clientPrice:
      normalizedClientPrice,
    totalPaid,
    remainingToPay:
      fromMoneyInCents(
        Math.max(
          differenceInCents,
          0
        )
      ),
    overpayment:
      fromMoneyInCents(
        Math.max(
          -differenceInCents,
          0
        )
      ),
    status,
    progressPercent:
      clientPriceInCents > 0
        ? (totalPaidInCents /
            clientPriceInCents) *
          100
        : null,
  };
}

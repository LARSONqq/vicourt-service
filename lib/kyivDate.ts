const KYIV_TIME_ZONE =
  "Europe/Kyiv";

const kyivDateFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        KYIV_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

const kyivTimeFormatter =
  new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        KYIV_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  );

function getDateParts(
  date: Date
) {
  return Object.fromEntries(
    kyivDateFormatter
      .formatToParts(date)
      .filter(
        (part) =>
          part.type !==
          "literal"
      )
      .map((part) => [
        part.type,
        part.value,
      ])
  );
}

export function getKyivDateValue(
  date = new Date()
) {
  const parts =
    getDateParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getKyivTimeValue(
  date = new Date()
) {
  return kyivTimeFormatter.format(
    date
  );
}

export function isValidDateValue(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [year, month, day] =
    value
      .split("-")
      .map(Number);

  const parsedDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    parsedDate.getUTCFullYear() ===
      year &&
    parsedDate.getUTCMonth() ===
      month - 1 &&
    parsedDate.getUTCDate() ===
      day
  );
}

function getUtcDate(
  value: string
) {
  if (!isValidDateValue(value)) {
    return null;
  }

  const [year, month, day] =
    value
      .split("-")
      .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}

export function addDaysToDateValue(
  value: string,
  days: number
) {
  const date =
    getUtcDate(value);

  if (
    !date ||
    !Number.isInteger(days)
  ) {
    throw new Error(
      "Не вдалося розрахувати дату наступного огляду."
    );
  }

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

export function getDateDifferenceInDays(
  from: string,
  to: string
) {
  const fromDate =
    getUtcDate(from);
  const toDate =
    getUtcDate(to);

  if (!fromDate || !toDate) {
    return null;
  }

  return Math.round(
    (
      toDate.getTime() -
      fromDate.getTime()
    ) /
      86_400_000
  );
}

export function formatDateValue(
  value: string | null
) {
  if (
    !value ||
    !isValidDateValue(value)
  ) {
    return null;
  }

  const [year, month, day] =
    value.split("-");

  return `${day}.${month}.${year}`;
}

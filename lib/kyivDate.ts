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

const kyivTimestampFormatter =
  new Intl.DateTimeFormat(
    "uk-UA",
    {
      timeZone:
        KYIV_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  );

const kyivOffsetFormatter =
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        KYIV_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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

export function formatKyivTimestamp(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return kyivTimestampFormatter
    .format(date)
    .replace(",", "");
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

function getKyivOffsetMilliseconds(
  date: Date
) {
  const parts = Object.fromEntries(
    kyivOffsetFormatter
      .formatToParts(date)
      .filter(
        (part) =>
          part.type !==
          "literal"
      )
      .map((part) => [
        part.type,
        Number(part.value),
      ])
  );

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - date.getTime()
  );
}

export function getKyivDateStartUtc(
  value: string
) {
  if (!isValidDateValue(value)) {
    return null;
  }

  const [year, month, day] =
    value
      .split("-")
      .map(Number);
  const localMidnight = Date.UTC(
    year,
    month - 1,
    day
  );
  let timestamp = localMidnight;

  // Другий прохід враховує зміну offset на межі літнього часу.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offset =
      getKyivOffsetMilliseconds(
        new Date(timestamp)
      );
    timestamp =
      localMidnight - offset;
  }

  return new Date(
    timestamp
  ).toISOString();
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

export const GLOBAL_SEARCH_MIN_LENGTH =
  2;
export const GLOBAL_SEARCH_MAX_LENGTH =
  100;

export class GlobalSearchInputError extends Error {}

export function normalizeGlobalSearchQuery(
  value: string
) {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

  if (
    Array.from(normalized)
      .length >
    GLOBAL_SEARCH_MAX_LENGTH
  ) {
    throw new GlobalSearchInputError(
      `Пошуковий запит не може перевищувати ${GLOBAL_SEARCH_MAX_LENGTH} символів.`
    );
  }

  return normalized;
}

export function isMeaningfulSearchQuery(
  query: string
) {
  return (
    Array.from(query).length >=
    GLOBAL_SEARCH_MIN_LENGTH
  );
}

function normalizeComparable(
  value: string
) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(
  value: string
) {
  return normalizeComparable(
    value
  ).replace(
    /[^\p{L}\p{N}]+/gu,
    ""
  );
}

export function getSafeSearchCandidateToken(
  query: string
) {
  const tokens =
    query.match(
      /[\p{L}\p{N}]+/gu
    ) || [];

  if (tokens.length === 0) {
    return null;
  }

  const token = [...tokens]
    .sort(
      (first, second) =>
        Array.from(second)
          .length -
        Array.from(first)
          .length
    )[0]
    .normalize("NFKC");
  const numericOnly =
    /^\p{N}+$/u.test(token);
  const candidate =
    numericOnly &&
    Array.from(token).length > 3
      ? Array.from(token)
          .slice(0, 3)
          .join("")
      : token;

  return Array.from(candidate)
    .length >=
    GLOBAL_SEARCH_MIN_LENGTH
    ? candidate
    : null;
}

export function buildSafeOrIlikeFilter(
  columns: readonly string[],
  candidateToken: string
) {
  if (
    !/^[\p{L}\p{N}]+$/u.test(
      candidateToken
    )
  ) {
    throw new GlobalSearchInputError(
      "Пошуковий запит містить непідтримувані символи."
    );
  }

  // Raw user input ніколи не потрапляє в PostgREST grammar: сюди
  // доходить лише token із Unicode-літер/цифр, а колонки задає код.
  const pattern =
    `%${candidateToken}%`;

  return columns
    .map(
      (column) =>
        `${column}.ilike.${pattern}`
    )
    .join(",");
}

function getFieldMatchRank(
  field: string,
  query: string
) {
  const normalizedField =
    normalizeComparable(field);
  const normalizedQuery =
    normalizeComparable(query);
  const compactField =
    normalizeCompact(field);
  const compactQuery =
    normalizeCompact(query);

  if (
    !normalizedField ||
    !normalizedQuery
  ) {
    return null;
  }

  if (
    normalizedField ===
    normalizedQuery
  ) {
    return 0;
  }

  if (
    normalizedField.startsWith(
      normalizedQuery
    )
  ) {
    return 1;
  }

  if (
    normalizedField.includes(
      normalizedQuery
    )
  ) {
    return 2;
  }

  if (
    compactQuery.length >=
      GLOBAL_SEARCH_MIN_LENGTH &&
    compactField === compactQuery
  ) {
    return 0;
  }

  if (
    compactQuery.length >=
      GLOBAL_SEARCH_MIN_LENGTH &&
    compactField.startsWith(
      compactQuery
    )
  ) {
    return 1;
  }

  if (
    compactQuery.length >=
      GLOBAL_SEARCH_MIN_LENGTH &&
    compactField.includes(
      compactQuery
    )
  ) {
    return 2;
  }

  return null;
}

export function rankGlobalSearchCandidate(
  primary: string,
  secondary: Array<
    string | null | undefined
  >,
  query: string
) {
  const primaryRank =
    getFieldMatchRank(
      primary,
      query
    );

  if (primaryRank !== null) {
    return primaryRank;
  }

  let secondaryRank:
    | number
    | null = null;

  for (const field of secondary) {
    if (!field) {
      continue;
    }

    const rank =
      getFieldMatchRank(
        field,
        query
      );

    if (
      rank !== null &&
      (secondaryRank === null ||
        rank < secondaryRank)
    ) {
      secondaryRank = rank;
    }
  }

  return secondaryRank === null
    ? null
    : secondaryRank + 3;
}

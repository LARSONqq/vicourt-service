"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  GLOBAL_SEARCH_MAX_LENGTH,
  GLOBAL_SEARCH_MIN_LENGTH,
} from "@/lib/globalSearch";
import {
  isGlobalSearchResponse,
} from "@/types/globalSearch";

import type {
  GlobalSearchGroup,
  GlobalSearchResult,
} from "@/types/globalSearch";

const SEARCH_DEBOUNCE_MS =
  300;

function isEditableTarget(
  target: EventTarget | null
) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function getCategoryIcon(
  category: GlobalSearchGroup["category"]
) {
  switch (category) {
    case "objects":
      return "📍";
    case "tasks":
      return "✓";
    case "equipment":
      return "🔧";
    case "employees":
      return "👤";
    case "warehouse":
      return "📦";
    case "purchases":
      return "+";
    case "finance":
      return "₴";
  }
}

function getResultDomId(
  result: GlobalSearchResult
) {
  return `global-search-${result.id.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  )}`;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] =
    useState(false);
  const [query, setQuery] =
    useState("");
  const [groups, setGroups] =
    useState<GlobalSearchGroup[]>(
      []
    );
  const [isLoading, setIsLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [selectedIndex, setSelectedIndex] =
    useState(0);
  const inputRef =
    useRef<HTMLInputElement>(null);
  const dialogRef =
    useRef<HTMLDivElement>(null);
  const triggerRef =
    useRef<HTMLButtonElement>(null);
  const previousFocusRef =
    useRef<HTMLElement | null>(
      null
    );
  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );
  const requestVersionRef =
    useRef(0);

  const flatResults = useMemo(
    () =>
      groups.flatMap(
        (group) =>
          group.results
      ),
    [groups]
  );
  const normalizedQuery =
    query.trim().replace(
      /\s+/g,
      " "
    );
  const isQueryLongEnough =
    Array.from(normalizedQuery)
      .length >=
    GLOBAL_SEARCH_MIN_LENGTH;

  const openSearch =
    useCallback(() => {
      if (
        document.activeElement instanceof
        HTMLElement
      ) {
        previousFocusRef.current =
          document.activeElement;
      }

      setIsOpen(true);

      requestAnimationFrame(
        () => {
          inputRef.current?.focus();
        }
      );
    }, []);

  const closeSearch =
    useCallback(() => {
      abortControllerRef.current?.abort();
      requestVersionRef.current += 1;
      setIsOpen(false);
      setQuery("");
      setGroups([]);
      setIsLoading(false);
      setErrorMessage("");
      setSelectedIndex(0);

      requestAnimationFrame(
        () => {
          const previousFocus =
            previousFocusRef.current;

          if (
            previousFocus?.isConnected
          ) {
            previousFocus.focus();
          } else {
            triggerRef.current?.focus();
          }
        }
      );
    }, []);

  useEffect(() => {
    function handleGlobalShortcut(
      event: KeyboardEvent
    ) {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLocaleLowerCase() ===
          "k" &&
        !isEditableTarget(
          event.target
        )
      ) {
        event.preventDefault();
        openSearch();

        return;
      }

      if (
        event.key ===
          "Escape" &&
        isOpen
      ) {
        event.preventDefault();
        closeSearch();
      }
    }

    window.addEventListener(
      "keydown",
      handleGlobalShortcut
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleGlobalShortcut
      );
    };
  }, [
    closeSearch,
    isOpen,
    openSearch,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;
    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      !isQueryLongEnough
    ) {
      return;
    }

    const requestVersion =
      requestVersionRef.current +
      1;
    requestVersionRef.current =
      requestVersion;
    const controller =
      new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current =
      controller;

    const timeoutId =
      window.setTimeout(
        async () => {
          try {
            const params =
              new URLSearchParams({
                q: normalizedQuery,
              });
            const response =
              await fetch(
                `/api/search?${params.toString()}`,
                {
                  method: "GET",
                  signal:
                    controller.signal,
                  cache: "no-store",
                  headers: {
                    Accept:
                      "application/json",
                  },
                }
              );

            if (!response.ok) {
              throw new Error(
                "Search request failed."
              );
            }

            const payload: unknown =
              await response.json();

            if (
              !isGlobalSearchResponse(
                payload
              )
            ) {
              throw new Error(
                "Invalid search response."
              );
            }

            if (
              controller.signal
                .aborted ||
              requestVersion !==
                requestVersionRef.current
            ) {
              return;
            }

            setGroups(
              payload.groups
            );
            setSelectedIndex(0);
            setErrorMessage("");
          } catch {
            if (
              controller.signal
                .aborted ||
              requestVersion !==
                requestVersionRef.current
            ) {
              return;
            }

            setGroups([]);
            setErrorMessage(
              "Не вдалося виконати пошук."
            );
          } finally {
            if (
              requestVersion ===
              requestVersionRef.current
            ) {
              setIsLoading(false);
            }
          }
        },
        SEARCH_DEBOUNCE_MS
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
      controller.abort();
    };
  }, [
    isOpen,
    isQueryLongEnough,
    normalizedQuery,
    query,
  ]);

  function handleQueryChange(
    value: string
  ) {
    const normalized = value
      .trim()
      .replace(/\s+/g, " ");
    const meaningful =
      Array.from(normalized)
        .length >=
      GLOBAL_SEARCH_MIN_LENGTH;

    setQuery(value);
    setSelectedIndex(0);
    setErrorMessage("");

    if (!meaningful) {
      abortControllerRef.current?.abort();
      requestVersionRef.current += 1;
      setGroups([]);
      setIsLoading(false);

      return;
    }

    setIsLoading(true);
  }

  function focusSelectedResult(
    index: number
  ) {
    const result =
      flatResults[index];

    if (!result) {
      return;
    }

    requestAnimationFrame(
      () => {
        document
          .getElementById(
            getResultDomId(
              result
            )
          )
          ?.scrollIntoView({
            block: "nearest",
          });
      }
    );
  }

  function handleDialogKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (
      event.key === "ArrowDown" &&
      flatResults.length > 0
    ) {
      event.preventDefault();
      const nextIndex =
        (selectedIndex + 1) %
        flatResults.length;
      setSelectedIndex(
        nextIndex
      );
      focusSelectedResult(
        nextIndex
      );

      return;
    }

    if (
      event.key === "ArrowUp" &&
      flatResults.length > 0
    ) {
      event.preventDefault();
      const nextIndex =
        (selectedIndex -
          1 +
          flatResults.length) %
        flatResults.length;
      setSelectedIndex(
        nextIndex
      );
      focusSelectedResult(
        nextIndex
      );

      return;
    }

    if (
      event.key === "Enter" &&
      !isLoading &&
      flatResults[selectedIndex]
    ) {
      event.preventDefault();
      const result =
        flatResults[
          selectedIndex
        ];
      closeSearch();
      router.push(result.href);

      return;
    }

    if (
      event.key !== "Tab" ||
      !dialogRef.current
    ) {
      return;
    }

    const focusable =
      Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    const first =
      focusable[0];
    const last =
      focusable[
        focusable.length - 1
      ];

    if (
      !first ||
      !last
    ) {
      return;
    }

    if (
      event.shiftKey &&
      document.activeElement ===
        first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement ===
        last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openSearch}
        aria-label="Відкрити глобальний пошук"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="hidden min-h-10 w-44 items-center justify-between gap-3 rounded-lg border bg-gray-50 px-3 text-sm text-gray-500 transition hover:border-green-300 hover:bg-white hover:text-gray-700 sm:inline-flex xl:w-64"
      >
        <span className="truncate">
          🔍 Пошук...
        </span>
        <kbd className="shrink-0 rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
          ⌘/Ctrl K
        </kbd>
      </button>

      <button
        type="button"
        onClick={openSearch}
        aria-label="Відкрити глобальний пошук"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white text-base text-gray-600 transition hover:bg-gray-50 sm:hidden"
      >
        🔍
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6 sm:pt-[8vh]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Закрити пошук"
            onClick={closeSearch}
            className="absolute inset-0 bg-black/45"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
            onKeyDown={
              handleDialogKeyDown
            }
            className="relative flex max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl sm:max-h-[80vh]"
          >
            <div className="flex min-w-0 items-center gap-3 border-b px-3 py-3 sm:px-4">
              <span
                aria-hidden="true"
                className="shrink-0 text-gray-400"
              >
                🔍
              </span>

              <input
                ref={inputRef}
                type="search"
                value={query}
                maxLength={
                  GLOBAL_SEARCH_MAX_LENGTH
                }
                onChange={(event) =>
                  handleQueryChange(
                    event.target.value
                  )
                }
                placeholder="Пошук у ViCourt..."
                aria-label="Пошук у ViCourt"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="global-search-results"
                aria-expanded={
                  flatResults.length >
                  0
                }
                aria-activedescendant={
                  flatResults[
                    selectedIndex
                  ]
                    ? getResultDomId(
                        flatResults[
                          selectedIndex
                        ]
                      )
                    : undefined
                }
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base text-gray-900 outline-none placeholder:text-gray-400"
              />

              {isLoading && (
                <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                  Пошук…
                </span>
              )}

              <button
                type="button"
                onClick={closeSearch}
                aria-label="Закрити пошук"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 hover:bg-gray-200"
              >
                ×
              </button>
            </div>

            <h2
              id="global-search-title"
              className="sr-only"
            >
              Глобальний пошук ViCourt
            </h2>

            <div
              id="global-search-results"
              role="listbox"
              aria-label="Результати пошуку"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3"
            >
              {!isQueryLongEnough ? (
                <div className="px-3 py-10 text-center">
                  <p className="font-medium text-gray-700">
                    Почніть вводити назву
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-gray-500">
                    Об’єкт, завдання, техніку або матеріал можна знайти від двох символів.
                  </p>
                </div>
              ) : errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : !isLoading &&
                groups.length ===
                  0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="font-medium text-gray-700">
                    Нічого не знайдено
                  </p>
                  <p className="mt-2 break-words text-sm text-gray-500">
                    За запитом «{normalizedQuery}» немає результатів.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map(
                    (group) => (
                      <section
                        key={
                          group.category
                        }
                        aria-labelledby={`global-search-group-${group.category}`}
                      >
                        <h3
                          id={`global-search-group-${group.category}`}
                          className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400"
                        >
                          <span aria-hidden="true">
                            {getCategoryIcon(
                              group.category
                            )}
                          </span>
                          {group.label}
                        </h3>

                        <div className="mt-1 space-y-1">
                          {group.results.map(
                            (result) => {
                              const index =
                                flatResults.findIndex(
                                  (item) =>
                                    item.id ===
                                    result.id
                                );
                              const isSelected =
                                index ===
                                selectedIndex;

                              return (
                                <Link
                                  id={getResultDomId(
                                    result
                                  )}
                                  key={result.id}
                                  href={
                                    result.href
                                  }
                                  role="option"
                                  aria-selected={
                                    isSelected
                                  }
                                  onMouseEnter={() =>
                                    setSelectedIndex(
                                      index
                                    )
                                  }
                                  onFocus={() =>
                                    setSelectedIndex(
                                      index
                                    )
                                  }
                                  onClick={
                                    (event) => {
                                      if (
                                        isLoading
                                      ) {
                                        event.preventDefault();

                                        return;
                                      }

                                      closeSearch();
                                    }
                                  }
                                  aria-disabled={
                                    isLoading
                                  }
                                  tabIndex={
                                    isLoading
                                      ? -1
                                      : 0
                                  }
                                  className={`flex min-w-0 items-start gap-3 rounded-lg px-3 py-3 outline-none transition ${
                                    isLoading
                                      ? "pointer-events-none opacity-60"
                                      : isSelected
                                      ? "bg-green-50 ring-1 ring-inset ring-green-200"
                                      : "hover:bg-gray-50 focus:bg-green-50 focus:ring-1 focus:ring-inset focus:ring-green-200"
                                  }`}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="min-w-0 break-words font-medium text-gray-900">
                                        {
                                          result.title
                                        }
                                      </span>

                                      {result.badge && (
                                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                          {
                                            result.badge
                                          }
                                        </span>
                                      )}
                                    </span>

                                    {result.subtitle && (
                                      <span className="mt-1 block break-words text-sm leading-5 text-gray-500">
                                        {
                                          result.subtitle
                                        }
                                      </span>
                                    )}
                                  </span>

                                  <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-gray-300"
                                  >
                                    →
                                  </span>
                                </Link>
                              );
                            }
                          )}
                        </div>
                      </section>
                    )
                  )}

                  {isLoading && (
                    <p className="px-3 py-2 text-center text-xs text-gray-400">
                      Оновлюємо результати…
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="hidden items-center justify-between gap-3 border-t bg-gray-50 px-4 py-2 text-[11px] text-gray-400 sm:flex">
              <span>
                ↑↓ вибір · Enter перейти
              </span>
              <span>
                Esc закрити
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

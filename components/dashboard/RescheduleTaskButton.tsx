"use client";

import { useRouter } from "next/navigation";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { createPortal } from "react-dom";

import { rescheduleDashboardTask } from "@/app/actions/dashboardTaskActions";

type Props = {
  taskId: number;
  objectId: number;
  currentDate: string | null;
  compact?: boolean;
  onRescheduled?: (
    newDate: string
  ) => void;
};

type PopupPosition = {
  top: number;
  left: number;
};

function formatInputDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateAfterDays(
  days: number
) {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days
  );

  return formatInputDate(
    date
  );
}

function formatDisplayDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] = date
    .slice(0, 10)
    .split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return date;
  }

  return `${day}.${month}.${year}`;
}

export default function RescheduleTaskButton({
  taskId,
  objectId,
  currentDate,
  compact = false,
  onRescheduled,
}: Props) {
  const router =
    useRouter();

  const buttonRef =
    useRef<HTMLButtonElement | null>(
      null
    );

  const popupRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    isMounted,
    setIsMounted,
  ] = useState(false);

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    customDate,
    setCustomDate,
  ] = useState(
    currentDate ||
      getDateAfterDays(1)
  );

  const [
    popupPosition,
    setPopupPosition,
  ] = useState<PopupPosition>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function updatePopupPosition() {
    const button =
      buttonRef.current;

    if (!button) {
      return;
    }

    const rect =
      button.getBoundingClientRect();

    const popupWidth = 288;
    const viewportPadding = 16;

    let left =
      rect.right -
      popupWidth;

    if (
      left <
      viewportPadding
    ) {
      left =
        viewportPadding;
    }

    if (
      left +
        popupWidth >
      window.innerWidth -
        viewportPadding
    ) {
      left =
        window.innerWidth -
        popupWidth -
        viewportPadding;
    }

    setPopupPosition({
      top:
        rect.bottom +
        8,

      left,
    });
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePopupPosition();

    function handleResize() {
      updatePopupPosition();
    }

    function handleScroll() {
      updatePopupPosition();
    }

    window.addEventListener(
      "resize",
      handleResize
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );

      window.removeEventListener(
        "scroll",
        handleScroll,
        true
      );
    };
  }, [isOpen]);

  useEffect(() => {
    function handleOutsideClick(
      event: PointerEvent
    ) {
      const target =
        event.target as Node;

      const clickedButton =
        buttonRef.current?.contains(
          target
        );

      const clickedPopup =
        popupRef.current?.contains(
          target
        );

      if (
        !clickedButton &&
        !clickedPopup
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );
    };
  }, []);

  async function saveNewDate(
    newDate: string
  ) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedTask =
        await rescheduleDashboardTask(
          taskId,
          objectId,
          newDate
        );

      setCustomDate(
        updatedTask.dueDate
      );

      setSuccessMessage(
        `Перенесено на ${formatDisplayDate(
          updatedTask.dueDate
        )}`
      );

      setIsOpen(false);

      onRescheduled?.(
        updatedTask.dueDate
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося перенести завдання."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggle(
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSaving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!isOpen) {
      updatePopupPosition();
    }

    setIsOpen(
      (currentValue) =>
        !currentValue
    );
  }

  const popup =
    isMounted &&
    isOpen
      ? createPortal(
          <div
            ref={popupRef}
            style={{
              position:
                "fixed",

              top:
                popupPosition.top,

              left:
                popupPosition.left,

              width:
                "288px",

              zIndex:
                9999,
            }}
            className="max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-3 shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <p className="px-1 text-sm font-semibold text-gray-800">
              Перенести завдання
            </p>

            {currentDate && (
              <p className="mt-1 px-1 text-xs text-gray-500">
                Поточна дата:{" "}
                {formatDisplayDate(
                  currentDate
                )}
              </p>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={
                  isSaving
                }
                onClick={() =>
                  saveNewDate(
                    getDateAfterDays(
                      0
                    )
                  )
                }
                className="rounded-lg border px-3 py-2 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60"
              >
                Сьогодні
              </button>

              <button
                type="button"
                disabled={
                  isSaving
                }
                onClick={() =>
                  saveNewDate(
                    getDateAfterDays(
                      1
                    )
                  )
                }
                className="rounded-lg border px-3 py-2 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60"
              >
                Завтра
              </button>

              <button
                type="button"
                disabled={
                  isSaving
                }
                onClick={() =>
                  saveNewDate(
                    getDateAfterDays(
                      7
                    )
                  )
                }
                className="rounded-lg border px-3 py-2 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60"
              >
                Через тиждень
              </button>
            </div>

            <div className="mt-3 border-t pt-3">
              <label className="text-xs font-medium text-gray-600">
                Конкретна дата
              </label>

              <input
                type="date"
                value={
                  customDate
                }
                onChange={(
                  event
                ) =>
                  setCustomDate(
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500"
              />

              <button
                type="button"
                disabled={
                  isSaving ||
                  !customDate
                }
                onClick={() =>
                  saveNewDate(
                    customDate
                  )
                }
                className="mt-2 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Збереження..."
                  : "Зберегти дату"}
              </button>
            </div>

            {errorMessage && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {
                  errorMessage
                }
              </p>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="inline-flex flex-col items-end">
        <button
          ref={buttonRef}
          type="button"
          disabled={
            isSaving
          }
          onClick={
            handleToggle
          }
          className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact
              ? "min-h-9 px-3 py-2 text-xs"
              : "min-h-10 px-4 py-2 text-sm"
          }`}
        >
          <span
            className="mr-1.5"
            aria-hidden="true"
          >
            📅
          </span>

          <span>
            {isSaving
              ? "Перенесення..."
              : "Перенести"}
          </span>
        </button>

        {!isOpen &&
          errorMessage && (
            <p className="mt-2 max-w-64 text-right text-xs text-red-600">
              {
                errorMessage
              }
            </p>
          )}

        {!isOpen &&
          successMessage && (
            <p className="mt-2 max-w-64 text-right text-xs text-green-700">
              {
                successMessage
              }
            </p>
          )}
      </div>

      {popup}
    </>
  );
}
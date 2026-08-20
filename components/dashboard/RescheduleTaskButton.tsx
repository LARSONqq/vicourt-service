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
    isMobile,
    setIsMobile,
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

    const mediaQuery =
      window.matchMedia(
        "(max-width: 639px)"
      );

    function updateMobileState() {
      setIsMobile(
        mediaQuery.matches
      );
    }

    updateMobileState();

    mediaQuery.addEventListener(
      "change",
      updateMobileState
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateMobileState
      );
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow =
        "";

      return;
    }

    if (isMobile) {
      document.body.style.overflow =
        "hidden";
    }

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [
    isOpen,
    isMobile,
  ]);

  function updatePopupPosition() {
    if (isMobile) {
      return;
    }

    const button =
      buttonRef.current;

    if (!button) {
      return;
    }

    const rect =
      button.getBoundingClientRect();

    const popupWidth =
      288;

    const viewportPadding =
      16;

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

    let top =
      rect.bottom + 8;

    const estimatedPopupHeight =
      390;

    if (
      top +
        estimatedPopupHeight >
      window.innerHeight -
        viewportPadding
    ) {
      top =
        Math.max(
          viewportPadding,
          rect.top -
            estimatedPopupHeight -
            8
        );
    }

    setPopupPosition({
      top,
      left,
    });
  }

  useEffect(() => {
    if (
      !isOpen ||
      isMobile
    ) {
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
  }, [
    isOpen,
    isMobile,
  ]);

  useEffect(() => {
    function handleOutsideClick(
      event: PointerEvent
    ) {
      if (!isOpen) {
        return;
      }

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
  }, [isOpen]);

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

      if (!compact) {
        setSuccessMessage(
          `Перенесено на ${formatDisplayDate(
            updatedTask.dueDate
          )}`
        );
      }

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

    if (
      !isOpen &&
      !isMobile
    ) {
      updatePopupPosition();
    }

    setIsOpen(
      (currentValue) =>
        !currentValue
    );
  }

  const popupContent = (
    <div
      ref={popupRef}
      className="w-full rounded-2xl border bg-white p-4 shadow-2xl sm:w-72 sm:rounded-xl sm:p-3"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-800 sm:text-sm">
            Перенести завдання
          </p>

          {currentDate && (
            <p className="mt-1 text-sm text-gray-500 sm:text-xs">
              Поточна дата:{" "}
              {formatDisplayDate(
                currentDate
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setIsOpen(false)
          }
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-500 hover:bg-gray-200 sm:hidden"
          aria-label="Закрити"
        >
          ×
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-3">
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
          className="rounded-lg border px-3 py-3 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60 sm:py-2"
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
          className="rounded-lg border px-3 py-3 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60 sm:py-2"
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
          className="rounded-lg border px-3 py-3 text-left text-sm transition hover:border-green-300 hover:bg-green-50 disabled:opacity-60 sm:py-2"
        >
          Через тиждень
        </button>
      </div>

      <div className="mt-4 border-t pt-4 sm:mt-3 sm:pt-3">
        <label className="text-sm font-medium text-gray-600 sm:text-xs">
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
              event.target.value
            )
          }
          className="mt-2 w-full rounded-lg border px-3 py-3 text-base outline-none focus:border-green-500 sm:py-2 sm:text-sm"
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
          className="mt-3 w-full rounded-lg bg-green-600 px-3 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-2 sm:py-2"
        >
          {isSaving
            ? "Збереження..."
            : "Зберегти дату"}
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );

  const popup =
    isMounted &&
    isOpen
      ? createPortal(
          isMobile ? (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto">
                {popupContent}
              </div>
            </div>
          ) : (
            <div
              style={{
                position:
                  "fixed",

                top:
                  popupPosition.top,

                left:
                  popupPosition.left,

                zIndex:
                  9999,
              }}
            >
              {popupContent}
            </div>
          ),
          document.body
        )
      : null;

  return (
    <>
      <div className="inline-flex w-fit flex-col items-start">
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

        {!compact &&
          !isOpen &&
          errorMessage && (
            <p className="mt-2 max-w-64 text-xs text-red-600">
              {errorMessage}
            </p>
          )}

        {!compact &&
          !isOpen &&
          successMessage && (
            <p className="mt-2 max-w-64 text-xs text-green-700">
              {successMessage}
            </p>
          )}
      </div>

      {popup}
    </>
  );
}
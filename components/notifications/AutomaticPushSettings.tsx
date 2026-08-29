"use client";

import {
  useState,
} from "react";
import {
  BellRing,
  Clock3,
} from "lucide-react";

import {
  savePushNotificationPreferences,
} from "@/app/actions/pushNotificationPreferenceActions";

import type {
  PushNotificationPreferences,
} from "@/types/pushNotificationPreference";

type Props = {
  initialPreferences: PushNotificationPreferences;
  showLowStock: boolean;
  showEquipmentMaintenance: boolean;
  showClientPayments: boolean;
};

type PreferenceToggleProps = {
  checked: boolean;
  description: string;
  label: string;
  onChange: (
    checked: boolean
  ) => void;
};

function PreferenceToggle({
  checked,
  description,
  label,
  onChange,
}: PreferenceToggleProps) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-green-200 hover:bg-green-50/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="mt-0.5 h-5 w-5 shrink-0 accent-green-600"
      />

      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">
          {label}
        </span>

        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
    </label>
  );
}

export default function AutomaticPushSettings({
  initialPreferences,
  showLowStock,
  showEquipmentMaintenance,
  showClientPayments,
}: Props) {
  const [preferences, setPreferences] =
    useState(
      initialPreferences
    );
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  function updatePreference<K extends keyof PushNotificationPreferences>(
    key: K,
    value: PushNotificationPreferences[K]
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleQuietHoursChange(
    enabled: boolean
  ) {
    setPreferences((current) => ({
      ...current,
      quiet_hours_enabled:
        enabled,
      quiet_start: enabled
        ? current.quiet_start ??
          "22:00"
        : current.quiet_start,
      quiet_end: enabled
        ? current.quiet_end ??
          "08:00"
        : current.quiet_end,
    }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await savePushNotificationPreferences(
          preferences
        );

      if (!result.success) {
        setErrorMessage(
          result.message
        );

        return;
      }

      setPreferences(
        result.preferences
      );
      setSuccessMessage(
        result.message
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти налаштування автоматичних сповіщень."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
          <BellRing
            aria-hidden="true"
            className="h-5 w-5"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-900">
            Автоматичні сповіщення
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-600">
            Оберіть важливі події, про які ViCourt повідомлятиме на всіх ваших підписаних пристроях.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <PreferenceToggle
          checked={
            preferences.overdue_tasks_enabled
          }
          label="Прострочені завдання"
          description="Повідомляти про призначені або доступні вам завдання, строк яких минув."
          onChange={(checked) =>
            updatePreference(
              "overdue_tasks_enabled",
              checked
            )
          }
        />

        <PreferenceToggle
          checked={
            preferences.supervision_enabled
          }
          label="Періодичні огляди"
          description="Повідомляти про огляди на сьогодні та прострочені огляди."
          onChange={(checked) =>
            updatePreference(
              "supervision_enabled",
              checked
            )
          }
        />

        {showLowStock && (
          <PreferenceToggle
            checked={
              preferences.low_stock_enabled
            }
            label="Низький залишок складу"
            description="Повідомляти, коли залишок матеріалу досягає мінімального рівня."
            onChange={(checked) =>
              updatePreference(
                "low_stock_enabled",
                checked
              )
            }
          />
        )}

        {showEquipmentMaintenance && (
          <PreferenceToggle
            checked={
              preferences.equipment_maintenance_enabled
            }
            label="ТО техніки"
            description="Повідомляти про планове ТО на сьогодні та прострочене обслуговування."
            onChange={(checked) =>
              updatePreference(
                "equipment_maintenance_enabled",
                checked
              )
            }
          />
        )}

        {showClientPayments && (
          <PreferenceToggle
            checked={
              preferences.client_payments_enabled
            }
            label="Платежі клієнтів"
            description="Повідомляти про платежі за графіком на сьогодні та прострочені етапи."
            onChange={(checked) =>
              updatePreference(
                "client_payments_enabled",
                checked
              )
            }
          />
        )}
      </div>

      <div className="mt-5 border-t pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <Clock3
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-gray-500"
          />

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              Тихі години
            </h3>

            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={
                  preferences.quiet_hours_enabled
                }
                onChange={(event) =>
                  handleQuietHoursChange(
                    event.target.checked
                  )
                }
                className="mt-0.5 h-5 w-5 shrink-0 accent-green-600"
              />

              <span>
                Не надсилати сповіщення у вибраний час
              </span>
            </label>

            {preferences.quiet_hours_enabled && (
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Початок

                  <input
                    type="time"
                    value={
                      preferences.quiet_start ??
                      ""
                    }
                    onChange={(event) =>
                      updatePreference(
                        "quiet_start",
                        event.target.value
                      )
                    }
                    required
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-gray-700">
                  Кінець

                  <input
                    type="time"
                    value={
                      preferences.quiet_end ??
                      ""
                    }
                    onChange={(event) =>
                      updatePreference(
                        "quiet_end",
                        event.target.value
                      )
                    }
                    required
                    className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600"
                  />
                </label>
              </div>
            )}

            <p className="mt-2 text-xs leading-5 text-gray-500">
              Час вказано за київським часом.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm leading-5 text-green-700"
        >
          {successMessage}
        </p>
      )}

      <div className="mt-4 border-t pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження…"
            : "Зберегти налаштування"}
        </button>
      </div>
    </section>
  );
}

"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  deleteUserAccount,
  setUserActiveStatus,
  updateUserProfile,
} from "@/app/actions/profileActions";

import type {
  Employee,
} from "@/types/employee";

import type {
  UserProfile,
  UserRole,
} from "@/types/userProfile";

import {
  getUserRoleLabel,
} from "@/types/userProfile";

type Props = {
  profiles?: UserProfile[];
  employees?: Employee[];
  currentUserId: string;
};

type UserRowProps = {
  profile: UserProfile;
  employees: Employee[];
  profiles: UserProfile[];
  currentUserId: string;
};

function getEmployeeName(
  employee: Employee
) {
  return [
    employee.first_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function UserRow({
  profile,
  employees,
  profiles,
  currentUserId,
}: UserRowProps) {
  const router =
    useRouter();

  const isCurrentUser =
    profile.id ===
    currentUserId;

  const [
    role,
    setRole,
  ] = useState<UserRole>(
    profile.role
  );

  const [
    employeeId,
    setEmployeeId,
  ] = useState(
    profile.employee_id
      ? String(
          profile.employee_id
        )
      : ""
  );

  const [
    isActive,
    setIsActive,
  ] = useState(
    profile.is_active
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isChangingStatus,
    setIsChangingStatus,
  ] = useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const linkedEmployee =
    employees.find(
      (employee) =>
        employee.id ===
        profile.employee_id
    ) || null;

  const displayName =
    profile.full_name?.trim() ||
    (
      linkedEmployee
        ? getEmployeeName(
            linkedEmployee
          )
        : ""
    ) ||
    profile.email ||
    "Користувач";

  const isBusy =
    isSubmitting ||
    isChangingStatus ||
    isDeleting;

  async function handleSubmit(
    formData: FormData
  ) {
    if (isBusy) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateUserProfile(
        formData
      );

      setSuccessMessage(
        "Зміни збережено."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти зміни."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange() {
    if (isBusy) {
      return;
    }

    const nextStatus =
      !isActive;

    if (!nextStatus) {
      const confirmed =
        window.confirm(
          `Заблокувати користувача "${displayName}"?`
        );

      if (!confirmed) {
        return;
      }
    }

    setIsChangingStatus(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setUserActiveStatus(
        profile.id,
        nextStatus
      );

      setIsActive(
        nextStatus
      );

      setSuccessMessage(
        nextStatus
          ? "Користувача розблоковано."
          : "Користувача заблоковано."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося змінити статус користувача."
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleDelete() {
    if (
      isBusy ||
      isCurrentUser
    ) {
      return;
    }

    const firstConfirmation =
      window.confirm(
        `Видалити акаунт "${displayName}"?`
      );

    if (!firstConfirmation) {
      return;
    }

    const secondConfirmation =
      window.confirm(
        "Цю дію не можна скасувати. Користувач буде повністю видалений із системи та більше не зможе увійти. Продовжити?"
      );

    if (!secondConfirmation) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteUserAccount(
        profile.id
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити користувача."
      );

      setIsDeleting(false);
    }
  }

  return (
    <article
      className={`min-w-0 rounded-xl border bg-white p-4 transition sm:p-5 ${
        !isActive
          ? "opacity-75"
          : ""
      }`}
    >
      {/* USER HEADER */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold text-gray-900">
              {displayName}
            </h3>

            {isCurrentUser && (
              <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                Це ви
              </span>
            )}

            {isActive ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                ● Активний
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                ● Заблокований
              </span>
            )}
          </div>

          <p className="mt-1 break-all text-sm text-gray-500">
            {profile.email ||
              "Email не вказано"}
          </p>

          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <span
              className={`max-w-full break-words rounded-full px-3 py-1 text-xs font-medium ${
                profile.role ===
                "admin"
                  ? "bg-green-100 text-green-700"
                  : profile.role ===
                      "object_manager"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {getUserRoleLabel(
                profile.role
              )}
            </span>

            {linkedEmployee ? (
              <span className="max-w-full break-words rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                👤{" "}
                {getEmployeeName(
                  linkedEmployee
                )}
              </span>
            ) : (
              <span className="max-w-full break-words rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                Не прив’язаний до
                працівника
              </span>
            )}
          </div>
        </div>

        {/* ACCOUNT ACTIONS */}
        <div className="flex min-w-0 flex-col gap-3 lg:w-[240px] lg:shrink-0 lg:items-end">
          <div className="min-w-0 rounded-lg bg-gray-50 p-3 text-xs text-gray-400 lg:w-full">
            <p>
              ID акаунта
            </p>

            <p className="mt-1 break-all font-mono leading-5 text-gray-500">
              {profile.id}
            </p>
          </div>

          {!isCurrentUser && (
            <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:justify-end">
              <button
                type="button"
                onClick={
                  handleStatusChange
                }
                disabled={
                  isBusy
                }
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                {isChangingStatus
                  ? "Збереження..."
                  : isActive
                    ? "Заблокувати"
                    : "Розблокувати"}
              </button>

              <button
                type="button"
                onClick={
                  handleDelete
                }
                disabled={
                  isBusy
                }
                className="min-h-10 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting
                  ? "Видалення..."
                  : "Видалити"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDIT FORM */}
      <form
        action={handleSubmit}
        className="mt-5 min-w-0 border-t pt-5"
      >
        <input
          type="hidden"
          name="profile_id"
          value={profile.id}
        />

        {isCurrentUser ? (
          <input
            type="hidden"
            name="role"
            value="admin"
          />
        ) : null}

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm leading-5 text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Роль
            </label>

            <select
              name={
                isCurrentUser
                  ? undefined
                  : "role"
              }
              value={role}
              disabled={
                isCurrentUser ||
                isBusy
              }
              onChange={(
                event
              ) =>
                setRole(
                  event.target
                    .value as UserRole
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="admin">
                Адміністратор
              </option>

              <option value="object_manager">
                Керівник об’єкта
              </option>

              <option value="worker">
                Працівник
              </option>
            </select>

            {isCurrentUser && (
              <p className="mt-2 text-xs leading-4 text-gray-400">
                Власну роль
                адміністратора змінити
                не можна.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Прив’язаний працівник
            </label>

            <select
              name="employee_id"
              value={employeeId}
              disabled={
                isBusy
              }
              onChange={(
                event
              ) =>
                setEmployeeId(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">
                Не прив’язувати
              </option>

              {employees.map(
                (employee) => {
                  const linkedToOther =
                    profiles.some(
                      (
                        otherProfile
                      ) =>
                        otherProfile.id !==
                          profile.id &&
                        otherProfile.employee_id ===
                          employee.id
                    );

                  return (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                      disabled={
                        linkedToOther
                      }
                    >
                      {getEmployeeName(
                        employee
                      )}

                      {employee.position
                        ? ` — ${employee.position}`
                        : ""}

                      {linkedToOther
                        ? " (вже прив’язаний)"
                        : ""}
                    </option>
                  );
                }
              )}
            </select>

            <p className="mt-2 text-xs leading-4 text-gray-400">
              Один працівник може бути
              прив’язаний тільки до
              одного акаунта.
            </p>
          </div>

          <div className="flex min-w-0 items-end">
            <button
              type="submit"
              disabled={
                isBusy
              }
              className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              {isSubmitting
                ? "Збереження..."
                : "Зберегти"}
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}

export default function UserManagement({
  profiles = [],
  employees = [],
  currentUserId,
}: Props) {
  const safeProfiles =
    Array.isArray(
      profiles
    )
      ? profiles
      : [];

  const safeEmployees =
    Array.isArray(
      employees
    )
      ? employees
      : [];

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState<
    UserRole | "all"
  >("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    | "all"
    | "active"
    | "blocked"
  >("all");

  const filteredProfiles =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return safeProfiles.filter(
        (profile) => {
          const employee =
            safeEmployees.find(
              (item) =>
                item.id ===
                profile.employee_id
            );

          const searchableText =
            [
              profile.email,
              profile.full_name,
              employee?.first_name,
              employee?.last_name,
              employee?.position,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !query ||
            searchableText.includes(
              query
            );

          const matchesRole =
            roleFilter ===
              "all" ||
            profile.role ===
              roleFilter;

          const matchesStatus =
            statusFilter ===
              "all" ||
            (
              statusFilter ===
                "active" &&
              profile.is_active
            ) ||
            (
              statusFilter ===
                "blocked" &&
              !profile.is_active
            );

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        }
      );
    }, [
      safeProfiles,
      safeEmployees,
      search,
      roleFilter,
      statusFilter,
    ]);

  const adminCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
          "admin" &&
        profile.is_active
    ).length;

  const managerCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
          "object_manager" &&
        profile.is_active
    ).length;

  const workerCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
          "worker" &&
        profile.is_active
    ).length;

  const blockedCount =
    safeProfiles.filter(
      (profile) =>
        !profile.is_active
    ).length;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Усього акаунтів
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {
              safeProfiles.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Адміністратори
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
            {adminCount}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Керівники об’єктів
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
            {managerCount}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Працівники
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-700 sm:text-3xl">
            {workerCount}
          </p>
        </div>

        <div
          className={`col-span-2 min-w-0 rounded-xl border bg-white p-3 sm:p-5 xl:col-span-1 ${
            blockedCount > 0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Заблоковані
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              blockedCount > 0
                ? "text-red-600"
                : "text-gray-900"
            }`}
          >
            {blockedCount}
          </p>
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Користувачі системи
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Ролі, статуси та зв’язок
            акаунтів із працівниками
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b bg-gray-50 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <input
              type="search"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Пошук за ім’ям або email"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />
          </div>

          <select
            value={
              roleFilter
            }
            onChange={(
              event
            ) =>
              setRoleFilter(
                event.target
                  .value as
                  | UserRole
                  | "all"
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="all">
              Усі ролі
            </option>

            <option value="admin">
              Адміністратори
            </option>

            <option value="object_manager">
              Керівники об’єктів
            </option>

            <option value="worker">
              Працівники
            </option>
          </select>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target
                  .value as
                  | "all"
                  | "active"
                  | "blocked"
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="all">
              Усі статуси
            </option>

            <option value="active">
              Активні
            </option>

            <option value="blocked">
              Заблоковані
            </option>
          </select>
        </div>

        <div className="border-b px-4 py-3 sm:px-5">
          <p className="text-sm text-gray-500">
            Знайдено:{" "}
            <span className="font-semibold text-gray-800">
              {
                filteredProfiles.length
              }
            </span>
          </p>
        </div>

        {filteredProfiles.length ===
        0 ? (
          <div className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              👤
            </div>

            <p className="mt-3 font-medium text-gray-700">
              Користувачів не
              знайдено
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Спробуй змінити пошук,
              роль або статус.
            </p>
          </div>
        ) : (
          <div className="space-y-3 bg-gray-50 p-3 sm:space-y-4 sm:p-5">
            {filteredProfiles.map(
              (profile) => (
                <UserRow
                  key={
                    profile.id
                  }
                  profile={
                    profile
                  }
                  employees={
                    safeEmployees
                  }
                  profiles={
                    safeProfiles
                  }
                  currentUserId={
                    currentUserId
                  }
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
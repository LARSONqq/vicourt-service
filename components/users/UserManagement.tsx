"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { updateUserProfile } from "@/app/actions/profileActions";

import type { Employee } from "@/types/employee";
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
  const router = useRouter();

  const isCurrentUser =
    profile.id === currentUserId;

  const [role, setRole] =
    useState<UserRole>(
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
    isSubmitting,
    setIsSubmitting,
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
    (linkedEmployee
      ? getEmployeeName(
          linkedEmployee
        )
      : "") ||
    profile.email ||
    "Користувач";

  async function handleSubmit(
    formData: FormData
  ) {
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

  return (
    <article className="rounded-xl border bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {displayName}
            </h3>

            {isCurrentUser && (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                Це ви
              </span>
            )}
          </div>

          <p className="mt-1 break-all text-sm text-gray-500">
            {profile.email ||
              "Email не вказано"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
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
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                👤{" "}
                {getEmployeeName(
                  linkedEmployee
                )}
              </span>
            ) : (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                Не прив’язаний до
                працівника
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-400">
          ID акаунта:
          <br />
          <span className="break-all">
            {profile.id}
          </span>
        </div>
      </div>

      <form
        action={handleSubmit}
        className="mt-5 border-t pt-5"
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_auto]">
          <div>
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
                isCurrentUser
              }
              onChange={(
                event
              ) =>
                setRole(
                  event.target
                    .value as UserRole
                )
              }
              className="w-full rounded-lg border bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
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
              <p className="mt-2 text-xs text-gray-400">
                Власну роль
                адміністратора змінити
                не можна.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Прив’язаний працівник
            </label>

            <select
              name="employee_id"
              value={employeeId}
              onChange={(
                event
              ) =>
                setEmployeeId(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white px-4 py-3"
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

            <p className="mt-2 text-xs text-gray-400">
              Один працівник може бути
              прив’язаний тільки до
              одного акаунта.
            </p>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
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
    Array.isArray(profiles)
      ? profiles
      : [];

  const safeEmployees =
    Array.isArray(employees)
      ? employees
      : [];

  const [search, setSearch] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState<
      UserRole | "all"
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

          const searchableText = [
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
            roleFilter === "all" ||
            profile.role ===
              roleFilter;

          return (
            matchesSearch &&
            matchesRole
          );
        }
      );
    }, [
      safeProfiles,
      safeEmployees,
      search,
      roleFilter,
    ]);

  const adminCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
        "admin"
    ).length;

  const managerCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
        "object_manager"
    ).length;

  const workerCount =
    safeProfiles.filter(
      (profile) =>
        profile.role ===
        "worker"
    ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Усього акаунтів
          </p>

          <p className="mt-2 text-3xl font-bold">
            {
              safeProfiles.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Адміністратори
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {adminCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Керівники об’єктів
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-700">
            {managerCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Працівники
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-700">
            {workerCount}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">
            Користувачі системи
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Ролі та зв’язок акаунтів
            із працівниками
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b bg-gray-50 p-4 md:grid-cols-[1fr_240px]">
          <input
            type="search"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Пошук за ім’ям або email"
            className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
          />

          <select
            value={roleFilter}
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
            className="w-full rounded-lg border bg-white px-4 py-3"
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
        </div>

        <div className="border-b px-5 py-3">
          <p className="text-sm text-gray-500">
            Знайдено:{" "}
            {
              filteredProfiles.length
            }
          </p>
        </div>

        {filteredProfiles.length ===
        0 ? (
          <div className="p-8 text-center text-gray-500">
            Користувачів не знайдено.
          </div>
        ) : (
          <div className="space-y-4 bg-gray-50 p-5">
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
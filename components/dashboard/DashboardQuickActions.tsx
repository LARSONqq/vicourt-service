import Link from "next/link";

import type {
  DashboardPermissions,
} from "@/types/dashboard";

type Props = {
  permissions: DashboardPermissions;
};

export default function DashboardQuickActions({
  permissions,
}: Props) {
  const actions = [
    permissions.canCreateObject
      ? {
          label: "+ Об’єкт",
          href: "/objects/new",
          primary: true,
        }
      : null,
    permissions.canCreateTask
      ? {
          label: "+ Завдання",
          href: "/task",
          primary: false,
        }
      : null,
    permissions.canCreatePurchase
      ? {
          label: "+ Закупівля",
          href: "/purchases#new-purchase",
          primary: false,
        }
      : null,
    permissions.canCreateEquipment
      ? {
          label: "+ Техніка",
          href: "/equipment",
          primary: false,
        }
      : null,
  ].filter(
    (
      action
    ): action is {
      label: string;
      href: string;
      primary: boolean;
    } => action !== null
  );

  if (actions.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Швидкі дії"
      className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end"
    >
      {actions.map(
        (action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`inline-flex min-h-10 min-w-0 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium transition sm:px-4 ${
              action.primary
                ? "bg-green-600 text-white hover:bg-green-700"
                : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {action.label}
          </Link>
        )
      )}
    </nav>
  );
}

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
          href: "/tasks",
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
            className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3.5 ${
              action.primary
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {action.label}
          </Link>
        )
      )}
    </nav>
  );
}

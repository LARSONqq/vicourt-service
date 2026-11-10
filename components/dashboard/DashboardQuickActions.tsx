import Link from "next/link";
import { ClipboardPlus, PackagePlus, Plus, Wrench } from "lucide-react";

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
          label: "Об’єкт",
          icon: Plus,
          href: "/objects/new",
          primary: true,
        }
      : null,
    permissions.canCreateTask
      ? {
          label: "Завдання",
          icon: ClipboardPlus,
          href: "/tasks",
          primary: false,
        }
      : null,
    permissions.canCreatePurchase
      ? {
          label: "Закупівля",
          icon: PackagePlus,
          href: "/purchases#new-purchase",
          primary: false,
        }
      : null,
    permissions.canCreateEquipment
      ? {
          label: "Техніка",
          icon: Wrench,
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
      icon: typeof Plus;
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
        (action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-10 ${
                action.primary
                  ? "border border-primary/35 bg-primary/90 text-primary-foreground hover:bg-primary"
                  : "border border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted/60"
              }`}
            >
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
              {action.label}
            </Link>
          );
        }
      )}
    </nav>
  );
}

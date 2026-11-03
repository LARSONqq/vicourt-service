import Link from "next/link";

import ObjectsList from "@/components/objects/ObjectsList";

import { getObjects } from "@/services/objectService";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";

export default async function ObjectsPage() {
  const objects =
    await getObjects();

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Робочий простір</p>
          <h1 className="vc-page-title mt-1 break-words">
            Об’єкти
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Керування об’єктами та
            виконаними роботами
          </p>
        </div>

        <Link
          href="/objects/new"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-fit"
        >
          + Новий об’єкт
        </Link>
      </header>

      <ObjectsList
        objects={objects}
        today={
          getKyivDateValue()
        }
      />
    </div>
  );
}

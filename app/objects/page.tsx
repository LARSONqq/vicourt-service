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
          <p className="text-sm font-medium text-green-700">Робочий простір</p>
          <h1 className="vc-page-title mt-1 break-words">
            Об’єкти
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            Керування об’єктами та
            виконаними роботами
          </p>
        </div>

        <Link
          href="/objects/new"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:w-fit"
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

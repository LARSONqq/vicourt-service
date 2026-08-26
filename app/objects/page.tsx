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
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Об’єкти
          </h1>

          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Керування об’єктами та
            виконаними роботами
          </p>
        </div>

        <Link
          href="/objects/new"
          className="w-full rounded-lg bg-green-600 px-5 py-3 text-center font-medium text-white transition hover:bg-green-700 sm:w-fit"
        >
          + Новий об’єкт
        </Link>
      </div>

      <ObjectsList
        objects={objects}
        today={
          getKyivDateValue()
        }
      />
    </div>
  );
}

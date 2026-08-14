import Link from "next/link";
import ObjectsList from "@/components/objects/ObjectsList";
import { getObjects } from "@/services/objectService";

export default async function ObjectsPage() {
  const objects = await getObjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Об’єкти</h1>

          <p className="mt-1 text-gray-500">
            Керування об’єктами та виконаними роботами
          </p>
        </div>

        <Link
          href="/objects/new"
          className="w-fit rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
        >
          + Новий об’єкт
        </Link>
      </div>

      <ObjectsList objects={objects} />
    </div>
  );
}
"use client";

import Link from "next/link";

type Props = {
  reset: () => void;
};

export default function WarehouseItemError({
  reset,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6"
      >
        <h1 className="text-xl font-semibold text-red-800">
          Не вдалося завантажити паспорт матеріалу
        </h1>
        <p className="mt-2 text-sm text-red-700">
          Спробуй завантажити дані ще раз або повернися до складу.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Спробувати ще раз
          </button>
          <Link
            href="/warehouse"
            className="flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Назад до складу
          </Link>
        </div>
      </section>
    </main>
  );
}

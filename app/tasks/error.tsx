"use client";

export default function TasksError({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-xl border bg-white p-6"><h2 className="font-semibold">Не вдалося завантажити завдання</h2><p className="mt-2 text-sm text-gray-600">Спробуйте ще раз. Дані завдань не змінено.</p><button type="button" onClick={reset} className="mt-4 rounded-lg bg-green-700 px-4 py-3 text-white">Повторити</button></div>;
}
